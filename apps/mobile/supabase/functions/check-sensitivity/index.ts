// Supabase Edge Function: check-sensitivity
// Intent-aware sensitivity classifier. Given a list of (id, kind, text)
// items and a set of rules describing what to AVOID, returns a per-item
// allow/block decision.
//
// Single LLM call per request — items are batched into one structured
// JSON-mode prompt. Hard cap: 50 items per request.

const LLM_API_URL = Deno.env.get("LLM_API_URL") || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

const MAX_ITEMS_PER_REQUEST = 50;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InputItem {
  id: string;
  kind: string;
  text: string;
}

interface InputRule {
  id: string;
  intent_text: string;
  filter_type: string;
  filter_value?: string;
}

interface Decision {
  id: string;
  allow: boolean;
  blocked_by_rule_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const items: InputItem[] = Array.isArray(body?.items) ? body.items : [];
    const rules: InputRule[] = Array.isArray(body?.rules) ? body.rules : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ decisions: [] }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (items.length > MAX_ITEMS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Too many items: ${items.length} > ${MAX_ITEMS_PER_REQUEST}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (!LLM_API_KEY) {
      return new Response(JSON.stringify({ error: "LLM API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // No rules → allow everything by default.
    if (rules.length === 0) {
      const decisions: Decision[] = items.map((it) => ({ id: it.id, allow: true }));
      return new Response(JSON.stringify({ decisions }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const renderedRules = rules
      .map((r) => {
        const text = r.intent_text || r.filter_value || "(no description)";
        return `- [rule_id=${r.id}] (${r.filter_type}) ${text}`;
      })
      .join("\n");

    const renderedItems = items
      .map((it) => `- [id=${it.id}] (${it.kind}) ${it.text}`)
      .join("\n");

    const systemPrompt =
      "You are a sensitivity classifier for a memory-care app called Memoria. " +
      "Decide if each item is safe to surface to a vulnerable user with cognitive impairment. " +
      "Respond with ONLY valid JSON — no markdown, no extra text. " +
      "Use this exact schema:\n" +
      "{\n" +
      '  "decisions": [\n' +
      '    { "id": "<item id>", "allow": true|false, "blocked_by_rule_id": "<rule id or omit>", "reason": "<short reason or omit>" }\n' +
      "  ]\n" +
      "}\n\n" +
      "Guidelines:\n" +
      "- Be intent-aware: if a rule says 'avoid Mom\\'s death', block oblique references like 'the funeral', 'her last days', 'Memorial Care Center'.\n" +
      "- Be precise: if a rule says 'avoid Robert' (a person), do NOT block 'Robert Frost' (a different Robert mentioned in a poem context).\n" +
      "- Default to ALLOW when nothing in the rules clearly applies.\n" +
      "- For each blocked item, set blocked_by_rule_id to the rule id that triggered the block and write a short reason.\n" +
      "- Return one decision per input item, with the exact id from the input.";

    const userPrompt =
      `Rules to enforce (these define what to AVOID):\n${renderedRules}\n\n` +
      `Items to classify:\n${renderedItems}`;

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
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `LLM error: ${errorText}` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let parsed: { decisions?: Decision[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: "classifier returned non-JSON", raw }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const decisions: Decision[] = Array.isArray(parsed?.decisions)
      ? parsed.decisions
          .filter((d) => d && typeof d.id === "string" && typeof d.allow === "boolean")
          .map((d) => ({
            id: d.id,
            allow: d.allow,
            blocked_by_rule_id: d.blocked_by_rule_id,
            reason: d.reason,
          }))
      : [];

    return new Response(JSON.stringify({ decisions }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
