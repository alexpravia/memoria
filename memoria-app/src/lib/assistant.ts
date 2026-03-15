import { supabase } from "./supabase";
import { SensitivityFilter } from "../types";

// ─── Provider-Agnostic LLM Interface ───
// Swap this one function to change providers (OpenAI → self-hosted, etc.)
// Everything else in the app stays the same.

interface AssistantResponse {
  answer: string;
  error?: string;
  photos?: string[];
}

interface UserContext {
  profile: {
    full_name: string;
    location: string | null;
    date_of_birth: string | null;
  } | null;
  lifeFacts: string[];
  people: { name: string; relationship: string; key_facts: string[]; emotional_notes: string | null }[];
  events: { title: string; description: string | null; event_date: string }[];
  media: Array<{
    id: string;
    file_url: string;
    description: string | null;
    tags: string[];
    taken_at: string | null;
    people: string[];
  }>;
}

// Fetch user context from Supabase, already filtered by sensitivity rules
export async function getUserContext(userId: string): Promise<UserContext> {
  // Fetch sensitivity filters first
  const { data: filters } = await supabase
    .from("sensitivity_filters")
    .select("*")
    .eq("user_id", userId);

  const sensitivityFilters: SensitivityFilter[] = filters || [];

  const filteredPersonIds = sensitivityFilters
    .filter((f) => f.filter_type === "person" && f.person_id)
    .map((f) => f.person_id);

  const filteredTopics = sensitivityFilters
    .filter((f) => f.filter_type === "topic")
    .map((f) => f.filter_value.toLowerCase());

  const filteredTimePeriods = sensitivityFilters
    .filter((f) => f.filter_type === "time_period")
    .map((f) => ({ start: f.start_date, end: f.end_date }));

  // Fetch profile
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, location, date_of_birth")
    .eq("id", userId)
    .single();

  // Fetch life facts and filter by topic
  const { data: factsData } = await supabase
    .from("life_facts")
    .select("fact")
    .eq("user_id", userId)
    .order("display_order");

  const lifeFacts = (factsData || [])
    .map((f) => f.fact)
    .filter((fact) => !filteredTopics.some((topic) => fact.toLowerCase().includes(topic)));

  // Fetch people, excluding filtered persons
  const { data: peopleData } = await supabase
    .from("people")
    .select("id, full_name, relationship, key_facts, emotional_notes")
    .eq("user_id", userId);

  const people = (peopleData || [])
    .filter((p) => !filteredPersonIds.includes(p.id))
    .filter((p) => !filteredTopics.some((topic) => p.full_name.toLowerCase().includes(topic)))
    .map((p) => ({
      name: p.full_name,
      relationship: p.relationship,
      key_facts: p.key_facts || [],
      emotional_notes: p.emotional_notes,
    }));

  // Fetch events, excluding filtered time periods
  const { data: eventsData } = await supabase
    .from("events")
    .select("title, description, event_date")
    .eq("user_id", userId)
    .order("event_date", { ascending: false })
    .limit(20);

  const events = (eventsData || [])
    .filter((e) => {
      const eventDate = e.event_date.split("T")[0];
      return !filteredTimePeriods.some((period) => {
        if (!period.start || !period.end) return false;
        return eventDate >= period.start && eventDate <= period.end;
      });
    })
    .filter((e) => !filteredTopics.some((topic) => e.title.toLowerCase().includes(topic)))
    .map((e) => ({
      title: e.title,
      description: e.description,
      event_date: e.event_date,
    }));

  // Fetch verified media
  const { data: mediaData } = await supabase
    .from("media")
    .select("id, file_url, description, ai_tags, taken_at")
    .eq("user_id", userId)
    .eq("verification_status", "verified")
    .order("taken_at", { ascending: false })
    .limit(50);

  const mediaPeopleMap: Record<string, string[]> = {};
  const mediaPersonIds: Record<string, string[]> = {};
  const mediaIds = (mediaData || []).map((m) => m.id);

  if (mediaIds.length > 0) {
    const { data: mediaPeopleData } = await supabase
      .from("media_people")
      .select("media_id, person_id, people(full_name)")
      .in("media_id", mediaIds);

    (mediaPeopleData || []).forEach((mp: any) => {
      if (!mediaPeopleMap[mp.media_id]) mediaPeopleMap[mp.media_id] = [];
      if (!mediaPersonIds[mp.media_id]) mediaPersonIds[mp.media_id] = [];
      const name = mp.people?.full_name;
      if (name) mediaPeopleMap[mp.media_id].push(name);
      if (mp.person_id) mediaPersonIds[mp.media_id].push(mp.person_id);
    });
  }

  const media = (mediaData || [])
    .filter((m) => {
      // Exclude photos linked to filtered people
      const personIds = mediaPersonIds[m.id] || [];
      if (personIds.some((pid) => filteredPersonIds.includes(pid))) {
        return false;
      }

      // Exclude photos whose description contains a filtered topic
      if (m.description && filteredTopics.some((topic) => m.description!.toLowerCase().includes(topic))) {
        return false;
      }

      // Exclude photos taken during filtered time periods
      if (m.taken_at) {
        const photoDate = m.taken_at.split("T")[0];
        if (filteredTimePeriods.some((period) => {
          if (!period.start || !period.end) return false;
          return photoDate >= period.start && photoDate <= period.end;
        })) {
          return false;
        }
      }

      return true;
    })
    .map((m) => ({
      id: m.id,
      file_url: m.file_url,
      description: m.description,
      tags: Array.isArray(m.ai_tags) ? m.ai_tags : [],
      taken_at: m.taken_at,
      people: mediaPeopleMap[m.id] || [],
    }));

  return { profile, lifeFacts, people, events, media };
}

// Build the system prompt with the user's context baked in
function buildSystemPrompt(context: UserContext): string {
  let prompt = `You are a warm, gentle memory assistant for a person with memory difficulties. Your name is Memoria.

RULES:
- ONLY answer using the context provided below. Never make things up.
- If you don't have enough information to answer, say "I don't have that information yet. Your helper can add it for you."
- Keep answers short, clear, and reassuring. Use simple language.
- Speak directly to the user in second person ("You", "Your").
- Be warm and kind. This person may be confused or scared.
- Never mention that you are filtering content or that certain things are hidden.

`;

  if (context.profile) {
    prompt += `USER'S PROFILE:\n`;
    prompt += `- Name: ${context.profile.full_name}\n`;
    if (context.profile.location) prompt += `- Lives in: ${context.profile.location}\n`;
    if (context.profile.date_of_birth) prompt += `- Date of birth: ${context.profile.date_of_birth}\n`;
    prompt += `\n`;
  }

  if (context.lifeFacts.length > 0) {
    prompt += `LIFE FACTS:\n`;
    context.lifeFacts.forEach((fact) => {
      prompt += `- ${fact}\n`;
    });
    prompt += `\n`;
  }

  if (context.people.length > 0) {
    prompt += `IMPORTANT PEOPLE:\n`;
    context.people.forEach((person) => {
      prompt += `- ${person.name} (${person.relationship})`;
      if (person.key_facts.length > 0) prompt += `: ${person.key_facts.join("; ")}`;
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  if (context.events.length > 0) {
    prompt += `EVENTS & SCHEDULE:\n`;
    context.events.forEach((event) => {
      const date = new Date(event.event_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      prompt += `- ${date}: ${event.title}`;
      if (event.description) prompt += ` — ${event.description}`;
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  if (context.media.length > 0) {
    prompt += `PHOTOS & MEMORIES:\n`;
    prompt += `The user has ${context.media.length} photos in their collection. Here are some of them:\n`;
    context.media.forEach((photo) => {
      const date = photo.taken_at
        ? new Date(photo.taken_at).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "Unknown date";
      prompt += `- Photo from ${date}`;
      if (photo.description) prompt += `: ${photo.description}`;
      if (photo.people.length > 0) prompt += `. People in photo: ${photo.people.join(", ")}`;
      if (photo.tags.length > 0) prompt += `. Tags: ${photo.tags.join(", ")}`;
      prompt += ` [PHOTO:${photo.file_url}]\n`;
    });
    prompt += `\nWhen the user asks to see photos, you can reference these. Include the photo URL in your response using this exact format: [PHOTO:url] so the app can display it.\n`;
    prompt += `\n`;
  }

  return prompt;
}

// ─── The LLM call ───
// This is the ONLY function you need to change to swap providers.
// Currently calls a Supabase Edge Function, which proxies to OpenAI.
// To switch to self-hosted: just change this to call your own endpoint.

export async function askAssistant(userId: string, question: string): Promise<AssistantResponse> {
  try {
    const context = await getUserContext(userId);
    const systemPrompt = buildSystemPrompt(context);

    const { data, error } = await supabase.functions.invoke("ask-assistant", {
      body: { question, systemPrompt },
    });

    if (error) {
      return { answer: "", error: error.message };
    }

    if (!data) {
      return { answer: "", error: "No data returned" };
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    let answer: string = parsed.answer || "I'm not sure how to answer that.";

    // Extract [PHOTO:url] references from the answer
    const photoRegex = /\[PHOTO:(.*?)\]/g;
    const photos: string[] = [];
    let match;
    while ((match = photoRegex.exec(answer)) !== null) {
      photos.push(match[1]);
    }
    answer = answer.replace(photoRegex, "").trim();

    return { answer, ...(photos.length > 0 && { photos }) };
  } catch (err: any) {
    return { answer: "", error: err.message || "Something went wrong." };
  }
}
