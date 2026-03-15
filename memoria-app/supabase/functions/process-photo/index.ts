// Supabase Edge Function: process-photo
// Analyzes uploaded photos using an AI vision model. Returns a structured
// description, tags, identified people, and a review flag for co-user triage.

const LLM_API_URL = Deno.env.get("LLM_API_URL") || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { photoUrl, mediaId, people } = await req.json();

    if (!photoUrl || !mediaId) {
      return new Response(JSON.stringify({ error: "photoUrl and mediaId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!LLM_API_KEY) {
      return new Response(JSON.stringify({ error: "LLM API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const knownPeople = (people || [])
      .map((p: { name: string; relationship: string }) => `- ${p.name} (${p.relationship})`)
      .join("\n");

    const systemPrompt =
      "You are a photo analysis assistant for a memory-care app called Memoria. " +
      "Your job is to describe photos in a warm, simple way and identify people and context. " +
      "Respond with ONLY valid JSON — no markdown, no extra text. " +
      "Use this exact schema:\n" +
      "{\n" +
      '  "description": "A warm, simple 1-2 sentence description of the photo",\n' +
      '  "tags": ["array", "of", "category", "strings"],\n' +
      '  "people_identified": [{ "name": "Person Name", "confidence": "high|medium|low" }],\n' +
      '  "needs_review": true/false,\n' +
      '  "review_reason": "reason string or null"\n' +
      "}\n\n" +
      "Tag categories to consider: family, friends, outdoors, indoors, birthday, holiday, " +
      "pets, food, travel, celebration, garden, home, medical, group, portrait, selfie.\n\n" +
      "Set needs_review to true if:\n" +
      "- You cannot clearly identify faces\n" +
      "- The photo may contain sensitive or distressing content\n" +
      "- You are unsure about the context or people\n" +
      "- The image quality is very poor";

    const userText = knownPeople
      ? `Analyze this photo. Here are the people you might recognize:\n${knownPeople}`
      : "Analyze this photo. No known people list was provided.";

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: photoUrl } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `LLM error: ${errorText}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      // AI returned non-JSON — flag for co-user review
      result = {
        description: raw || "Unable to analyze this photo.",
        tags: [],
        people_identified: [],
        needs_review: true,
        review_reason: "AI response could not be parsed as structured data",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
