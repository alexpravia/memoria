import { supabase } from "./supabase";
import { SensitivityFilter } from "../types";

// ─── Provider-Agnostic LLM Interface ───
// Swap this one function to change providers (OpenAI → self-hosted, etc.)
// Everything else in the app stays the same.

interface AssistantResponse {
  answer: string;
  error?: string;
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

  return { profile, lifeFacts, people, events };
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
    return { answer: parsed.answer || "I'm not sure how to answer that." };
  } catch (err: any) {
    return { answer: "", error: err.message || "Something went wrong." };
  }
}
