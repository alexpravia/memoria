"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAuth,
  supabase,
  saveNarrative,
  embedAndStore,
  type NarrativeSuggestions,
} from "@memoria/core";
import Icon from "@/components/Icon";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toggleSet(s: Set<number>, i: number): Set<number> {
  const next = new Set(s);
  next.has(i) ? next.delete(i) : next.add(i);
  return next;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "2px solid var(--color-surface-raised)",
  borderRadius: "var(--radius-lg)",
  padding: "14px 18px",
  fontSize: "var(--type-lg)",
  color: "var(--color-fg)",
  outline: "none",
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "16px 32px",
  fontSize: "var(--type-lg)",
  fontWeight: "var(--type-weight-medium)",
  cursor: "pointer",
  width: "100%",
};

const disabledBtn: React.CSSProperties = {
  ...primaryBtn,
  opacity: 0.45,
  cursor: "not-allowed",
};

const skipBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  cursor: "pointer",
  padding: "10px 0",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p
      style={{
        fontSize: "var(--type-sm)",
        color: "var(--color-fg-muted)",
        letterSpacing: 0.8,
        textTransform: "uppercase",
        margin: "0 0 7px",
        fontWeight: "var(--type-weight-medium)",
      }}
    >
      {children}
      {required && (
        <span style={{ color: "var(--color-primary-soft)", marginLeft: 4 }}>*</span>
      )}
    </p>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        background: "rgba(255,107,107,0.1)",
        border: "1px solid rgba(255,107,107,0.3)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        color: "var(--color-danger)",
        fontSize: "var(--type-md)",
        marginTop: 16,
      }}
    >
      {msg}
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

const STEP_LABELS = ["Profile", "Story", "Facts", "People", "Events"];

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 10,
        }}
      >
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", flex: i < 4 ? 1 : 0 }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-full)",
                background:
                  i < step
                    ? "var(--color-primary)"
                    : i === step
                      ? "var(--color-primary)"
                      : "var(--color-surface-raised)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              {i < step ? (
                <Icon name="check" size={14} color="#fff" />
              ) : (
                <span
                  style={{
                    fontSize: "var(--type-xs)",
                    fontWeight: "var(--type-weight-bold)",
                    color: i === step ? "#fff" : "var(--color-fg-muted)",
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            {i < 4 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background:
                    i < step
                      ? "var(--color-primary)"
                      : "var(--color-surface-raised)",
                  transition: "background 0.2s",
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            style={{
              fontSize: "var(--type-xxs)",
              color: i === step ? "var(--color-primary-soft)" : "var(--color-fg-muted)",
              fontWeight: i === step ? "var(--type-weight-medium)" : undefined,
              flex: 1,
              textAlign: "center",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardClient() {
  const { session, setUserId } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patient identity captured after step 0
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");

  // ── Step 0 state ──────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");

  // ── Step 1 state ──────────────────────────────────────────────────
  const [narrativeText, setNarrativeText] = useState("");
  const [narrativePhase, setNarrativePhase] = useState<"write" | "processing" | "review">("write");
  const [suggestions, setSuggestions] = useState<NarrativeSuggestions | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [acceptedPeople, setAcceptedPeople] = useState(new Set<number>());
  const [acceptedFacts, setAcceptedFacts] = useState(new Set<number>());
  const [acceptedEvents, setAcceptedEvents] = useState(new Set<number>());

  // ── Step 2 state ──────────────────────────────────────────────────
  const [factDraft, setFactDraft] = useState("");
  const [facts, setFacts] = useState<string[]>([]);

  // ── Step 3 state ──────────────────────────────────────────────────
  const [pName, setPName] = useState("");
  const [pRel, setPRel] = useState("");
  const [people, setPeople] = useState<{ name: string; rel: string }[]>([]);

  // ── Step 4 state ──────────────────────────────────────────────────
  const [eTitle, setETitle] = useState("");
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState<"one_time" | "recurring" | "routine">("one_time");
  const [events, setEvents] = useState<{ title: string; date: string; type: string }[]>([]);

  // ── Step 0 handler ────────────────────────────────────────────────

  async function handleCreateProfile() {
    if (!fullName.trim() || !relationship.trim() || !phone.trim()) {
      setError("Please fill in their name, your relationship, and your phone number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: user, error: uErr } = await supabase
        .from("users")
        .insert({
          email: `${fullName.trim().toLowerCase().replace(/\s+/g, ".")}@memoria.placeholder`,
          full_name: fullName.trim(),
          date_of_birth: dob || null,
          location: location.trim() || null,
        })
        .select()
        .single();
      if (uErr) throw uErr;

      const { error: cErr } = await supabase.from("co_users").insert({
        auth_id: session!.user.id,
        email: session!.user.email!,
        full_name:
          (session!.user.user_metadata as { full_name?: string })?.full_name ??
          session!.user.email!,
        user_id: user.id,
        relationship: relationship.trim(),
        phone: phone.trim(),
      });
      if (cErr) throw cErr;

      setPatientId(user.id);
      setPatientName(fullName.trim());
      setUserId(user.id);
      setStep(1);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 1 handlers ───────────────────────────────────────────────

  async function handleProcessNarrative() {
    if (!narrativeText.trim() || !patientId) return;
    setNarrativePhase("processing");
    setNarrativeError(null);
    const result = await saveNarrative(patientId, narrativeText);
    if (!result.ok || !result.suggestions) {
      setNarrativePhase("write");
      setNarrativeError(result.error ?? "Processing failed — please try again.");
      return;
    }
    const s = result.suggestions;
    setSuggestions(s);
    setAcceptedPeople(new Set(s.people.map((_, i) => i)));
    setAcceptedFacts(new Set(s.life_facts.map((_, i) => i)));
    setAcceptedEvents(new Set(s.events.map((_, i) => i)));
    setNarrativePhase("review");
  }

  async function handleAcceptSuggestions() {
    if (!patientId || !suggestions) return;
    setSaving(true);
    setError(null);
    try {
      // People
      const toAddPeople = suggestions.people.filter((_, i) => acceptedPeople.has(i));
      if (toAddPeople.length > 0) {
        const { data: ins } = await supabase
          .from("people")
          .insert(
            toAddPeople.map((p) => ({
              user_id: patientId,
              full_name: p.name,
              relationship: p.relationship ?? "",
              key_facts: [],
              emotional_notes: p.notes ?? null,
            }))
          )
          .select("id, full_name, relationship, emotional_notes");
        for (const row of (ins ?? []) as { id: string; full_name: string; relationship: string; emotional_notes: string | null }[]) {
          const text = [row.full_name, row.relationship, row.emotional_notes]
            .filter(Boolean)
            .join(" ");
          void embedAndStore("people", row.id, text);
        }
      }

      // Life facts
      const toAddFacts = suggestions.life_facts.filter((_, i) => acceptedFacts.has(i));
      if (toAddFacts.length > 0) {
        const { data: ins } = await supabase
          .from("life_facts")
          .insert(toAddFacts.map((f) => ({ user_id: patientId, fact: f.fact, category: f.category ?? null })))
          .select("id, fact");
        for (const row of (ins ?? []) as { id: string; fact: string }[]) {
          void embedAndStore("life_facts", row.id, row.fact);
        }
      }

      // Events (default date to today since suggestions have no date)
      const toAddEvents = suggestions.events.filter((_, i) => acceptedEvents.has(i));
      if (toAddEvents.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: ins } = await supabase
          .from("events")
          .insert(
            toAddEvents.map((e) => ({
              user_id: patientId,
              title: e.title,
              description: e.description ?? null,
              event_date: today,
              event_type: e.event_type,
              recurrence_rule: e.recurrence_rule ?? null,
              is_past: false,
              people_involved: [],
            }))
          )
          .select("id, title, description");
        for (const row of (ins ?? []) as { id: string; title: string; description: string | null }[]) {
          const text = `${row.title} ${row.description ?? ""}`.trim();
          void embedAndStore("events", row.id, text);
        }
      }

      setStep(2);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 2 handler ────────────────────────────────────────────────

  async function handleSaveFacts() {
    if (facts.length === 0) { setStep(3); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: ins } = await supabase
        .from("life_facts")
        .insert(facts.map((f) => ({ user_id: patientId, fact: f })))
        .select("id, fact");
      for (const row of (ins ?? []) as { id: string; fact: string }[]) {
        void embedAndStore("life_facts", row.id, row.fact);
      }
      setStep(3);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 3 handler ────────────────────────────────────────────────

  async function handleSavePeople() {
    if (people.length === 0) { setStep(4); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: ins } = await supabase
        .from("people")
        .insert(people.map((p) => ({
          user_id: patientId,
          full_name: p.name,
          relationship: p.rel,
          key_facts: [],
          emotional_notes: null,
        })))
        .select("id, full_name, relationship");
      for (const row of (ins ?? []) as { id: string; full_name: string; relationship: string }[]) {
        void embedAndStore("people", row.id, `${row.full_name} ${row.relationship}`);
      }
      setStep(4);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 4 handler ────────────────────────────────────────────────

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      if (events.length > 0 && patientId) {
        const { data: ins } = await supabase
          .from("events")
          .insert(events.map((e) => ({
            user_id: patientId,
            title: e.title,
            description: null,
            event_date: e.date,
            event_type: e.type,
            is_past: false,
            people_involved: [],
          })))
          .select("id, title");
        for (const row of (ins ?? []) as { id: string; title: string }[]) {
          void embedAndStore("events", row.id, row.title);
        }
      }
      router.replace("/co-user");
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 32px 80px" }}>
      <ProgressIndicator step={step} />

      {/* ── Step 0: Profile ───────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <h1 style={{ fontSize: "var(--type-greeting)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
            Set Up Their Profile
          </h1>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", margin: "0 0 36px", lineHeight: 1.6 }}>
            Tell us about the person you&apos;re caring for so Memo can get to know them.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <Label required>Their Full Name</Label>
              <input style={inputStyle} placeholder="e.g., Maria Garcia" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <input type="date" style={inputStyle} value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <Label>Where They Live</Label>
              <input style={inputStyle} placeholder="e.g., Miami, FL" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div
              style={{
                height: 1,
                background: "var(--color-surface-raised)",
                margin: "4px 0",
              }}
            />
            <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-sm)", margin: 0 }}>
              About you — used for the emergency card and to link your account.
            </p>

            <div>
              <Label required>Your Relationship to Them</Label>
              <input style={inputStyle} placeholder="e.g., Daughter, Son, Caregiver" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
            </div>
            <div>
              <Label required>Your Phone (Emergency Contact)</Label>
              <input type="tel" style={inputStyle} placeholder="e.g., (305) 555-0199" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {error && <ErrorBanner msg={error} />}

          <div style={{ marginTop: 32 }}>
            <button
              style={saving || !fullName.trim() ? disabledBtn : primaryBtn}
              disabled={saving || !fullName.trim()}
              onClick={() => void handleCreateProfile()}
            >
              {saving ? "Setting up…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Narrative ─────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h1 style={{ fontSize: "var(--type-greeting)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
            Tell Memo About {patientName}
          </h1>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", margin: "0 0 28px", lineHeight: 1.6 }}>
            Write anything Memo should know — their life story, personality, favorite memories, important people, daily routines. The more you share, the better Memo can help.
          </p>

          {narrativePhase === "write" && (
            <>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 200,
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                }}
                placeholder={`${patientName} was born in… she loves… her closest family members are… she worked as…`}
                value={narrativeText}
                onChange={(e) => setNarrativeText(e.target.value)}
              />
              {narrativeError && <ErrorBanner msg={narrativeError} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
                <button
                  style={!narrativeText.trim() ? disabledBtn : primaryBtn}
                  disabled={!narrativeText.trim()}
                  onClick={() => void handleProcessNarrative()}
                >
                  Process with Memo →
                </button>
                <button style={skipBtn} onClick={() => setStep(2)}>
                  Skip this step
                </button>
              </div>
            </>
          )}

          {narrativePhase === "processing" && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "var(--color-fg-muted)",
              }}
            >
              <Icon name="sparkle" size={40} color="var(--color-primary-soft)" />
              <p style={{ marginTop: 16, fontSize: "var(--type-lg)" }}>
                Memo is reading {patientName}&apos;s story…
              </p>
              <p style={{ fontSize: "var(--type-md)", marginTop: 8 }}>
                This takes about 10–15 seconds.
              </p>
            </div>
          )}

          {narrativePhase === "review" && suggestions && (
            <SuggestionReview
              suggestions={suggestions}
              acceptedPeople={acceptedPeople}
              setAcceptedPeople={setAcceptedPeople}
              acceptedFacts={acceptedFacts}
              setAcceptedFacts={setAcceptedFacts}
              acceptedEvents={acceptedEvents}
              setAcceptedEvents={setAcceptedEvents}
              saving={saving}
              error={error}
              onAccept={() => void handleAcceptSuggestions()}
              onSkip={() => setStep(2)}
            />
          )}
        </div>
      )}

      {/* ── Step 2: Life Facts ────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h1 style={{ fontSize: "var(--type-greeting)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
            Key Facts About {patientName || "Them"}
          </h1>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", margin: "0 0 28px", lineHeight: 1.6 }}>
            Short facts Memo should always know — job history, hometowns, hobbies, languages, achievements.
          </p>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="e.g., Worked as a nurse for 30 years"
              value={factDraft}
              onChange={(e) => setFactDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && factDraft.trim()) {
                  setFacts((f) => [...f, factDraft.trim()]);
                  setFactDraft("");
                }
              }}
            />
            <button
              style={{
                background: "var(--color-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-lg)",
                padding: "0 22px",
                fontSize: "var(--type-lg)",
                cursor: factDraft.trim() ? "pointer" : "not-allowed",
                opacity: factDraft.trim() ? 1 : 0.45,
                flexShrink: 0,
              }}
              disabled={!factDraft.trim()}
              onClick={() => {
                if (!factDraft.trim()) return;
                setFacts((f) => [...f, factDraft.trim()]);
                setFactDraft("");
              }}
            >
              <Icon name="add" size={22} color="#fff" />
            </button>
          </div>

          {facts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {facts.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-surface-raised)",
                    borderRadius: "var(--radius-pill)",
                    padding: "8px 14px",
                    fontSize: "var(--type-sm)",
                    color: "var(--color-fg)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-primary-soft)",
                      flexShrink: 0,
                    }}
                  />
                  {f}
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--color-fg-muted)" }}
                    onClick={() => setFacts((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={14} color="var(--color-fg-muted)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              style={saving ? disabledBtn : primaryBtn}
              disabled={saving}
              onClick={() => void handleSaveFacts()}
            >
              {saving
                ? "Saving…"
                : facts.length > 0
                  ? `Save ${facts.length} fact${facts.length !== 1 ? "s" : ""} →`
                  : "Continue →"}
            </button>
            {facts.length === 0 && (
              <button style={skipBtn} onClick={() => setStep(3)}>
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: People ────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h1 style={{ fontSize: "var(--type-greeting)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
            Important People
          </h1>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", margin: "0 0 28px", lineHeight: 1.6 }}>
            Family members and close friends {patientName || "they"} should recognize. You can add more and edit details later.
          </p>

          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-surface-raised)",
              borderRadius: "var(--radius-xl)",
              padding: "20px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <Label required>Full Name</Label>
              <input style={inputStyle} placeholder="e.g., Carlos Garcia" value={pName} onChange={(e) => setPName(e.target.value)} />
            </div>
            <div>
              <Label required>Relationship</Label>
              <input style={inputStyle} placeholder="e.g., Son, Best Friend, Neighbor" value={pRel} onChange={(e) => setPRel(e.target.value)} />
            </div>
            <button
              style={!pName.trim() || !pRel.trim() ? { ...primaryBtn, opacity: 0.45, cursor: "not-allowed" } : primaryBtn}
              disabled={!pName.trim() || !pRel.trim()}
              onClick={() => {
                if (!pName.trim() || !pRel.trim()) return;
                setPeople((prev) => [...prev, { name: pName.trim(), rel: pRel.trim() }]);
                setPName("");
                setPRel("");
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="addPerson" size={20} color="#fff" />
                Add this person
              </span>
            </button>
          </div>

          {people.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {people.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-surface-raised)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-primary-deep)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "var(--type-md)",
                      fontWeight: "var(--type-weight-bold)",
                      color: "var(--color-primary-soft)",
                      flexShrink: 0,
                    }}
                  >
                    {p.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--type-md)", color: "var(--color-fg-strong)", fontWeight: "var(--type-weight-medium)" }}>{p.name}</div>
                    <div style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>{p.rel}</div>
                  </div>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => setPeople((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={16} color="var(--color-fg-muted)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              style={saving ? disabledBtn : primaryBtn}
              disabled={saving}
              onClick={() => void handleSavePeople()}
            >
              {saving
                ? "Saving…"
                : people.length > 0
                  ? `Save ${people.length} person${people.length !== 1 ? "s" : ""} →`
                  : "Continue →"}
            </button>
            {people.length === 0 && (
              <button style={skipBtn} onClick={() => setStep(4)}>
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Events ────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <h1 style={{ fontSize: "var(--type-greeting)", fontWeight: "var(--type-weight-bold)", color: "var(--color-fg-strong)", margin: "0 0 8px" }}>
            Upcoming Events
          </h1>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", margin: "0 0 28px", lineHeight: 1.6 }}>
            Appointments, family visits, recurring routines — anything {patientName || "they"} should be reminded about.
          </p>

          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-surface-raised)",
              borderRadius: "var(--radius-xl)",
              padding: "20px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <Label required>Event Title</Label>
              <input style={inputStyle} placeholder="e.g., Doctor's appointment" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" style={inputStyle} value={eDate} onChange={(e) => setEDate(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["one_time", "recurring", "routine"] as const).map((t) => (
                  <button
                    key={t}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: "var(--radius-lg)",
                      border: `2px solid ${eType === t ? "var(--color-primary)" : "var(--color-surface-raised)"}`,
                      background: eType === t ? "var(--color-primary-deep)" : "var(--color-surface)",
                      color: eType === t ? "var(--color-primary-soft)" : "var(--color-fg-muted)",
                      fontSize: "var(--type-sm)",
                      cursor: "pointer",
                      fontWeight: eType === t ? "var(--type-weight-medium)" : undefined,
                    }}
                    onClick={() => setEType(t)}
                  >
                    {t === "one_time" ? "One time" : t === "recurring" ? "Recurring" : "Routine"}
                  </button>
                ))}
              </div>
            </div>
            <button
              style={!eTitle.trim() ? { ...primaryBtn, opacity: 0.45, cursor: "not-allowed" } : primaryBtn}
              disabled={!eTitle.trim()}
              onClick={() => {
                if (!eTitle.trim()) return;
                setEvents((prev) => [
                  ...prev,
                  { title: eTitle.trim(), date: eDate, type: eType },
                ]);
                setETitle("");
                setEDate("");
                setEType("one_time");
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="calendar" size={20} color="#fff" />
                Add this event
              </span>
            </button>
          </div>

          {events.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {events.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-surface-raised)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 16px",
                  }}
                >
                  <Icon name="calendar" size={20} color="var(--color-primary-soft)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--type-md)", color: "var(--color-fg-strong)", fontWeight: "var(--type-weight-medium)" }}>{e.title}</div>
                    {e.date && <div style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>{e.date}</div>}
                  </div>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => setEvents((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={16} color="var(--color-fg-muted)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <ErrorBanner msg={error} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              style={saving ? disabledBtn : primaryBtn}
              disabled={saving}
              onClick={() => void handleFinish()}
            >
              {saving ? "Finishing up…" : "Finish Setup →"}
            </button>
            {events.length === 0 && (
              <button style={skipBtn} onClick={() => void handleFinish()}>
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Suggestion review panel ──────────────────────────────────────────────────

function SuggestionReview({
  suggestions,
  acceptedPeople,
  setAcceptedPeople,
  acceptedFacts,
  setAcceptedFacts,
  acceptedEvents,
  setAcceptedEvents,
  saving,
  error,
  onAccept,
  onSkip,
}: {
  suggestions: NarrativeSuggestions;
  acceptedPeople: Set<number>;
  setAcceptedPeople: (s: Set<number>) => void;
  acceptedFacts: Set<number>;
  setAcceptedFacts: (s: Set<number>) => void;
  acceptedEvents: Set<number>;
  setAcceptedEvents: (s: Set<number>) => void;
  saving: boolean;
  error: string | null;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const totalAccepted =
    acceptedPeople.size + acceptedFacts.size + acceptedEvents.size;
  const hasSuggestions =
    suggestions.people.length > 0 ||
    suggestions.life_facts.length > 0 ||
    suggestions.events.length > 0;

  if (!hasSuggestions) {
    return (
      <div>
        <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", marginBottom: 24 }}>
          Memo read the story but didn&apos;t find specific people, facts, or events to suggest — that&apos;s okay. The narrative is saved and Memo will use it as context.
        </p>
        <button style={skipBtn} onClick={onSkip}>
          Continue →
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)", marginBottom: 24, lineHeight: 1.6 }}>
        Memo found the following in the story. Uncheck anything you don&apos;t want to add — the rest will be saved automatically.
      </p>

      {suggestions.people.length > 0 && (
        <SuggestionGroup title="People" icon="contacts">
          {suggestions.people.map((p, i) => (
            <SuggestionRow
              key={i}
              checked={acceptedPeople.has(i)}
              onToggle={() => setAcceptedPeople(toggleSet(acceptedPeople, i))}
              primary={p.name}
              secondary={p.relationship ?? undefined}
            />
          ))}
        </SuggestionGroup>
      )}

      {suggestions.life_facts.length > 0 && (
        <SuggestionGroup title="Life Facts" icon="tip">
          {suggestions.life_facts.map((f, i) => (
            <SuggestionRow
              key={i}
              checked={acceptedFacts.has(i)}
              onToggle={() => setAcceptedFacts(toggleSet(acceptedFacts, i))}
              primary={f.fact}
              secondary={f.category ?? undefined}
            />
          ))}
        </SuggestionGroup>
      )}

      {suggestions.events.length > 0 && (
        <SuggestionGroup title="Events" icon="calendar">
          {suggestions.events.map((e, i) => (
            <SuggestionRow
              key={i}
              checked={acceptedEvents.has(i)}
              onToggle={() => setAcceptedEvents(toggleSet(acceptedEvents, i))}
              primary={e.title}
              secondary={e.event_type === "recurring" ? "Recurring" : e.event_type === "routine" ? "Routine" : undefined}
            />
          ))}
        </SuggestionGroup>
      )}

      {suggestions.sensitivity_hints.length > 0 && (
        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: "var(--type-sm)", color: "#f59e0b", margin: "0 0 8px", fontWeight: "var(--type-weight-medium)" }}>
            Sensitive topics noted
          </p>
          {suggestions.sensitivity_hints.map((h, i) => (
            <p key={i} style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: "2px 0" }}>
              • {h.intent_text}
            </p>
          ))}
          <p style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)", marginTop: 8, marginBottom: 0 }}>
            You can add these as sensitivity filters later from the Safety &amp; Filters page.
          </p>
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <button
          style={saving ? disabledBtn : primaryBtn}
          disabled={saving}
          onClick={onAccept}
        >
          {saving
            ? "Saving…"
            : totalAccepted > 0
              ? `Save ${totalAccepted} item${totalAccepted !== 1 ? "s" : ""} →`
              : "Continue without saving →"}
        </button>
        <button style={skipBtn} onClick={onSkip}>
          Skip suggestions
        </button>
      </div>
    </div>
  );
}

function SuggestionGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: import("@/components/Icon").IconName;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon name={icon} size={16} color="var(--color-primary-soft)" />
        <span style={{ fontSize: "var(--type-sm)", fontWeight: "var(--type-weight-medium)", color: "var(--color-fg-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function SuggestionRow({
  checked,
  onToggle,
  primary,
  secondary,
}: {
  checked: boolean;
  onToggle: () => void;
  primary: string;
  secondary?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        opacity: checked ? 1 : 0.45,
        transition: "opacity 0.15s",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer", flexShrink: 0 }}
      />
      <div>
        <span style={{ fontSize: "var(--type-md)", color: "var(--color-fg-strong)" }}>{primary}</span>
        {secondary && (
          <span style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", marginLeft: 8 }}>{secondary}</span>
        )}
      </div>
    </label>
  );
}
