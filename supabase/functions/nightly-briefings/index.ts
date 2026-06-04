// Supabase Edge Function: nightly-briefings
//
// Called by pg_cron at 2 AM UTC every day. Finds all users who do not
// yet have a briefing for today's UTC date (or whose last attempt
// failed) and fires generate-briefing for each.
//
// Idempotency: users who already have a draft/approved/delivered
// briefing for the target date are skipped entirely — we never
// overwrite co-user edits or approvals.
//
// Auth: expects the Supabase service-role key in the Authorization
// header. The pg_cron job supplies this; the function rejects anything
// else so it cannot be triggered from the client.
//
// Output: { date, generated, skipped, failed, errors[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  // Only accept POST; ignore OPTIONS (pg_cron does not send preflight).
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate service-role auth. The pg_cron job supplies the key; the
  // mobile client never calls this function directly.
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedBearer = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (!SUPABASE_SERVICE_ROLE_KEY || authHeader !== expectedBearer) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const date = todayISO();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Find all user IDs ─────────────────────────────────────────────
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id");

  if (usersErr || !users) {
    return new Response(
      JSON.stringify({
        error: `failed to query users: ${usersErr?.message ?? "unknown"}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Find users who already have a good briefing for this date ─────
  // "Good" = draft / approved / delivered. We re-try failed ones.
  const { data: existing } = await supabase
    .from("briefings")
    .select("user_id, status")
    .eq("briefing_date", date)
    .in("status", ["draft", "approved", "delivered"]);

  const coveredIds = new Set(
    (existing ?? []).map((b: { user_id: string }) => b.user_id)
  );

  const toGenerate = users.filter(
    (u: { id: string }) => !coveredIds.has(u.id)
  );

  const results = {
    date,
    generated: 0,
    skipped: coveredIds.size,
    failed: 0,
    errors: [] as string[],
  };

  // ── Generate briefings sequentially to avoid hammering the LLM ───
  // For small user counts (personal app) sequential is fine. If this
  // ever needs to scale, switch to bounded parallel batches.
  for (const user of toGenerate) {
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ userId: user.id, date }),
        }
      );

      // generate-briefing returns 200 even on LLM failure (status='failed'),
      // so we check the body rather than the HTTP status.
      const data = await resp.json().catch(() => ({}));
      if (data?.briefing?.status === "draft" || data?.briefing?.status === "approved") {
        results.generated++;
      } else {
        results.failed++;
        const msg = data?.error ?? `HTTP ${resp.status}`;
        results.errors.push(`user ${user.id}: ${msg}`);
      }
    } catch (err: any) {
      results.failed++;
      results.errors.push(`user ${user.id}: ${err?.message ?? "fetch threw"}`);
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
