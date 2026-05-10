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
      "Your job is to describe EVERY photo in a warm, simple way and tag what is literally visible. " +
      "Photos may show people, but they may also show landscapes, nature, animals, objects, food, " +
      "buildings, scenery, or anything else — describe and tag whatever is actually in the image. " +
      "Respond with ONLY valid JSON — no markdown, no extra text. " +
      "Use this exact schema:\n" +
      "{\n" +
      '  "description": "ONE short sentence (under 15 words). Warm and simple. Never more than one sentence.",\n' +
      '  "tags": ["array", "of", "category", "strings"],\n' +
      '  "people_identified": [{ "name": "Person Name", "confidence": "high|medium|low" }],\n' +
      '  "needs_review": true/false,\n' +
      '  "review_reason": "reason string or null"\n' +
      "}\n\n" +
      "DESCRIPTION — REQUIRED:\n" +
      "- Write exactly ONE sentence. Under 15 words.\n" +
      "- Never two sentences. Never a paragraph. No semicolons.\n" +
      "- Warm and simple language; no flowery prose.\n" +
      "- Examples of the right length: \"A misty field at dawn with trees in the distance.\" / \"A dog resting in the grass on a sunny day.\" / \"Three friends laughing at a birthday dinner.\"\n\n" +
      "TAGS — REQUIRED:\n" +
      "- ALWAYS produce between 3 and 8 tags. Never return an empty tags array.\n" +
      "- Tags must describe what is LITERALLY VISIBLE in the photo: objects, scenes, settings, " +
      "animals, landscape features, weather, colors, mood.\n" +
      "- If no people are present, tag the landscape, nature, buildings, animals, or objects you see " +
      "(for example: 'mountains', 'sunset', 'forest', 'beach', 'flowers', 'dog', 'building'). " +
      "Do NOT return an empty array just because the photo has no people.\n" +
      "- Prefer specific concrete nouns when you are confident ('oak tree', 'golden retriever', " +
      "'red brick house'). Generic nouns ('tree', 'dog', 'house') are also fine when uncertain.\n" +
      "- Suggested vocabulary (non-exhaustive — use other concrete nouns when they fit better): " +
      "family, friends, group, portrait, selfie, pets, animals, food, celebration, birthday, " +
      "holiday, travel, outdoors, indoors, garden, home, medical, nature, landscape, mountains, " +
      "beach, forest, sunset, sunrise, trees, flowers, water, sky, ocean, lake, river, snow, " +
      "building, architecture, street, city, vehicle, car, sports, music, art, document, screenshot.\n\n" +
      "people_identified:\n" +
      "- Only include people you can match with reasonable confidence to the known-people list (if provided).\n" +
      "- Use confidence values exactly: \"high\", \"medium\", or \"low\".\n" +
      "- If no people are visible or you cannot match any, return an empty array.\n\n" +
      "Set needs_review to true ONLY when:\n" +
      "- The photo clearly shows faces of people that you CANNOT match to the known-people list (i.e. unknown people are visible).\n" +
      "- The photo may contain sensitive, scary, or distressing content (death, injury, weapons, etc.).\n" +
      "- The image quality is very poor (extremely blurry, mostly black, etc.).\n" +
      "Do NOT set needs_review just because:\n" +
      "- The photo has no people in it (landscapes, nature, food, scenery, objects, pets are all FINE — set needs_review to false).\n" +
      "- The photo is a normal everyday scene with no recognizable faces.\n" +
      "When in doubt for an ordinary photo, leave needs_review as false.";

    const userText = knownPeople
      ? `Analyze this photo. Describe and tag what is visible even if no people are present. Here are the people you might recognize:\n${knownPeople}`
      : "Analyze this photo. Describe and tag what is visible even if no people are present. No known people list was provided.";

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
        max_tokens: 700,
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
