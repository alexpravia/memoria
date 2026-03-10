// Supabase Edge Function: ask-assistant
// Proxies LLM requests. Currently uses OpenAI, but swap the URL and headers
// to point to any OpenAI-compatible API (self-hosted Llama, Mistral, etc.)

const LLM_API_URL = Deno.env.get("LLM_API_URL") || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { question, systemPrompt } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "No question provided" }), {
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

    // Call the LLM — any OpenAI-compatible endpoint works here
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
          { role: "user", content: question },
        ],
        max_tokens: 300,
        temperature: 0.7,
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
    const answer = data.choices?.[0]?.message?.content || "I'm not sure how to answer that.";

    return new Response(JSON.stringify({ answer }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
