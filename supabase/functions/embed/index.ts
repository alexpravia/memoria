// Supabase Edge Function: embed
// Returns embeddings for a single string or a batch of strings.
// Uses an OpenAI-compatible embeddings endpoint; falls back to LLM_API_KEY
// so single-key deployments work out of the box.

const EMBEDDING_API_URL =
  Deno.env.get("EMBEDDING_API_URL") || "https://api.openai.com/v1/embeddings";
const EMBEDDING_API_KEY =
  Deno.env.get("EMBEDDING_API_KEY") || Deno.env.get("LLM_API_KEY") || "";
const EMBEDDING_MODEL =
  Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small";

const MAX_BATCH = 100;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const single: string | undefined =
      typeof body?.text === "string" ? body.text : undefined;
    const batch: string[] | undefined = Array.isArray(body?.texts)
      ? body.texts
      : undefined;

    if (!single && !batch) {
      return new Response(
        JSON.stringify({ error: "Provide `text` (string) or `texts` (string[])." }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (batch && batch.length > MAX_BATCH) {
      return new Response(
        JSON.stringify({ error: `Batch size exceeds ${MAX_BATCH}.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (!EMBEDDING_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Embedding API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const input: string | string[] = single ?? (batch as string[]);

    const response = await fetch(EMBEDDING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Embedding API error: ${errorText}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const data = await response.json();
    const items: Array<{ embedding: number[] }> = Array.isArray(data?.data)
      ? data.data
      : [];

    if (single !== undefined) {
      const embedding = items[0]?.embedding;
      if (!Array.isArray(embedding)) {
        return new Response(
          JSON.stringify({ error: "Embedding API returned no embedding." }),
          { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
      return new Response(JSON.stringify({ embedding }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const embeddings = items.map((it) => it.embedding);
    return new Response(JSON.stringify({ embeddings }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
