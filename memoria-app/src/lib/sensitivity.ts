// Semantic sensitivity classifier client.
//
// Replaces the keyword-substring filter inside `assistant.ts`. Calls the
// `check-sensitivity` Edge Function (gpt-4o-mini, JSON-mode) and caches
// each decision in `sensitivity_decisions` keyed by (item, rule_set_hash).
//
// ─── Fail policy ────────────────────────────────────────────────────
// `isAllowed` is a READ-PATH helper used by briefing/assistant pipelines.
// On any error or missing-decision case it FAILS OPEN (returns true).
//
// Rationale: silently hiding content is worse for the user than the
// inverse, because:
//   1) the verification queue (flag_queue) is the actual safety net for
//      content that's been processed and reviewed by a co-user, and
//   2) write-path screens can call `getOrClassify` proactively to fill
//      the cache before content is shown.
// If a decision isn't yet cached when `isAllowed` runs, that means the
// classifier hasn't been invoked for this (item, rule_set) — which is a
// bug, not a safety hazard, so we log a warning and allow.
//
// `classifyItems` and `getOrClassify` likewise NEVER throw on read paths.

import { supabase } from "./supabase";
import type { EmbeddingKind } from "./embeddings";

export interface SensitivityRule {
  id: string;
  filter_type: "person" | "topic" | "time_period" | "intent";
  intent_text?: string | null;
  filter_value?: string | null;
  person_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface SensitivityDecision {
  allow: boolean;
  blocked_by_rule_id?: string;
  reason?: string;
}

export interface SensitivityItem {
  id: string;
  kind: EmbeddingKind;
  text: string;
}

interface ClassifierResponse {
  decisions?: Array<{
    id: string;
    allow: boolean;
    blocked_by_rule_id?: string;
    reason?: string;
  }>;
  error?: string;
}

const MAX_BATCH = 50;

// ─── ruleSetHash ────────────────────────────────────────────────────
//
// Stable across rule order. Changes when any rule's intent_text or
// filter_value changes, or when rules are added/removed. The hash is
// used as the cache key — when the rule set changes, all cached
// decisions become "stale" (a different hash = a different cache key)
// and the classifier re-runs.
//
// Implementation: sort rules by id, build a canonical string, hash it
// with a deterministic 32-bit FNV-1a so it's stable across processes
// without needing crypto.

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit and zero-pad.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function ruleSetHash(rules: SensitivityRule[]): string {
  if (rules.length === 0) return "empty";
  const canonical = [...rules]
    .map((r) => ({
      id: r.id,
      type: r.filter_type,
      intent: (r.intent_text ?? "").trim(),
      value: (r.filter_value ?? "").trim(),
      person: r.person_id ?? "",
      start: r.start_date ?? "",
      end: r.end_date ?? "",
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (r) =>
        `${r.id}|${r.type}|${r.intent}|${r.value}|${r.person}|${r.start}|${r.end}`
    )
    .join("\n");
  return fnv1aHex(canonical);
}

// ─── classifyItems ──────────────────────────────────────────────────
//
// Calls the Edge Function in batches of MAX_BATCH and persists the
// returned decisions to `sensitivity_decisions`. Returns a Map from
// item id → SensitivityDecision. Items missing from the classifier
// response are omitted from the map (callers should treat missing as
// "no decision").

export async function classifyItems(
  userId: string,
  items: SensitivityItem[],
  rules: SensitivityRule[]
): Promise<Map<string, SensitivityDecision>> {
  const out = new Map<string, SensitivityDecision>();
  if (items.length === 0) return out;

  const hash = ruleSetHash(rules);

  // Slice into batches of MAX_BATCH.
  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const batch = items.slice(i, i + MAX_BATCH);

    let parsed: ClassifierResponse;
    try {
      const { data, error } = await supabase.functions.invoke(
        "check-sensitivity",
        {
          body: {
            items: batch.map((it) => ({ id: it.id, kind: it.kind, text: it.text })),
            rules: rules.map((r) => ({
              id: r.id,
              intent_text: r.intent_text ?? r.filter_value ?? "",
              filter_type: r.filter_type,
              filter_value: r.filter_value ?? undefined,
            })),
          },
        }
      );

      if (error) {
        console.warn("classifyItems: edge function error:", error.message);
        continue;
      }

      parsed = typeof data === "string" ? JSON.parse(data) : data;
    } catch (err: any) {
      console.warn("classifyItems: malformed JSON or invoke threw:", err?.message);
      continue;
    }

    if (!parsed || !Array.isArray(parsed.decisions)) {
      console.warn("classifyItems: classifier returned no decisions array");
      continue;
    }

    const rowsToInsert: Array<{
      user_id: string;
      item_kind: string;
      item_id: string;
      rule_set_hash: string;
      allow: boolean;
      blocked_by_rule_id: string | null;
      reason: string | null;
    }> = [];

    for (const d of parsed.decisions) {
      if (!d || typeof d.id !== "string" || typeof d.allow !== "boolean") continue;
      const item = batch.find((it) => it.id === d.id);
      if (!item) continue;
      const decision: SensitivityDecision = { allow: d.allow };
      if (d.blocked_by_rule_id) decision.blocked_by_rule_id = d.blocked_by_rule_id;
      if (d.reason) decision.reason = d.reason;
      out.set(d.id, decision);
      rowsToInsert.push({
        user_id: userId,
        item_kind: item.kind,
        item_id: item.id,
        rule_set_hash: hash,
        allow: d.allow,
        blocked_by_rule_id: d.blocked_by_rule_id ?? null,
        reason: d.reason ?? null,
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from("sensitivity_decisions")
        .upsert(rowsToInsert, {
          onConflict: "user_id,item_kind,item_id,rule_set_hash",
        });
      if (upsertErr) {
        console.warn(
          "classifyItems: failed to persist decisions:",
          upsertErr.message
        );
      }
    }
  }

  return out;
}

// ─── getOrClassify ──────────────────────────────────────────────────
//
// Looks up cached decisions for (item_id, rule_set_hash). Items without
// a cached decision are sent to `classifyItems`. Returns the merged map.

export async function getOrClassify(
  userId: string,
  items: SensitivityItem[],
  rules: SensitivityRule[]
): Promise<Map<string, SensitivityDecision>> {
  const out = new Map<string, SensitivityDecision>();
  if (items.length === 0) return out;

  const hash = ruleSetHash(rules);

  // Look up existing cached decisions for this rule set.
  const itemIds = items.map((it) => it.id);
  const { data: cached, error } = await supabase
    .from("sensitivity_decisions")
    .select("item_id, allow, blocked_by_rule_id, reason")
    .eq("user_id", userId)
    .eq("rule_set_hash", hash)
    .in("item_id", itemIds);

  if (error) {
    console.warn("getOrClassify: cache lookup failed:", error.message);
  }

  const cachedIds = new Set<string>();
  for (const row of (cached as any[]) ?? []) {
    cachedIds.add(row.item_id);
    const decision: SensitivityDecision = { allow: !!row.allow };
    if (row.blocked_by_rule_id) decision.blocked_by_rule_id = row.blocked_by_rule_id;
    if (row.reason) decision.reason = row.reason;
    out.set(row.item_id, decision);
  }

  const missing = items.filter((it) => !cachedIds.has(it.id));
  if (missing.length === 0) return out;

  const fresh = await classifyItems(userId, missing, rules);
  for (const [id, decision] of fresh.entries()) {
    out.set(id, decision);
  }

  return out;
}

// ─── isAllowed ──────────────────────────────────────────────────────
//
// Read-path helper. Returns true if there are no rules, or if the
// latest cached decision (against the current rule set hash) is allow.
// Returns false ONLY when a decision exists and explicitly says block.
// Fail-open on any error or missing decision (with a warning log).

export async function isAllowed(
  userId: string,
  kind: EmbeddingKind,
  itemId: string
): Promise<boolean> {
  try {
    // Fetch the user's current rule set to compute the hash.
    const { data: ruleRows, error: ruleErr } = await supabase
      .from("sensitivity_filters")
      .select("id, filter_type, intent_text, filter_value, person_id, start_date, end_date")
      .eq("user_id", userId);

    if (ruleErr) {
      console.warn("isAllowed: rule fetch failed:", ruleErr.message);
      return true;
    }

    const rules: SensitivityRule[] = (ruleRows as any[]) ?? [];
    if (rules.length === 0) return true;

    const hash = ruleSetHash(rules);

    const { data: decisionRow, error: decErr } = await supabase
      .from("sensitivity_decisions")
      .select("allow")
      .eq("user_id", userId)
      .eq("item_kind", kind)
      .eq("item_id", itemId)
      .eq("rule_set_hash", hash)
      .maybeSingle();

    if (decErr) {
      console.warn("isAllowed: decision fetch failed:", decErr.message);
      return true;
    }

    if (!decisionRow) {
      console.warn(
        `isAllowed: no decision for ${kind}:${itemId} (hash=${hash}); failing open`
      );
      return true;
    }

    return !!(decisionRow as { allow: boolean }).allow;
  } catch (err: any) {
    console.warn("isAllowed: threw:", err?.message);
    return true;
  }
}
