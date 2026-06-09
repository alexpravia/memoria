"use client";

import { useEffect, useState } from "react";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type FlagStatus = "pending" | "approved" | "rejected" | "hidden";

interface FlagRow {
  id: string;
  flag_type: string;
  description: string;
  status: FlagStatus;
  created_at: string;
  media?: { file_url: string; description: string | null } | null;
}

export default function FlagsClient() {
  const { userId } = useAuth();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewed, setShowReviewed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("flag_queue")
      .select(`
        id, flag_type, description, status, created_at,
        media:media_id ( file_url, description )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    // Supabase returns joined media as an array; normalize to the single object or null.
    const rows = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      media: Array.isArray(row.media) ? (row.media[0] ?? null) : (row.media ?? null),
    })) as FlagRow[];
    setFlags(rows);
    setLoading(false);
  }

  async function updateFlag(id: string, status: FlagStatus) {
    await supabase.from("flag_queue").update({ status }).eq("id", id);
    if (status !== "pending") {
      await supabase
        .from("media")
        .update({
          verification_status:
            status === "approved" ? "verified" : "hidden",
        })
        .eq(
          "id",
          flags.find((f) => f.id === id)?.media ? flags.find((f) => f.id === id)?.id : "__none__"
        );
    }
    setFlags((f) => f.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const pending = flags.filter((f) => f.status === "pending");
  const reviewed = flags.filter((f) => f.status !== "pending");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Review Queue"
        subtitle={`${pending.length} pending review`}
      />

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
          <Icon name="review" size={48} color="var(--color-surface-raised)" />
          <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>All caught up</p>
          <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
            No items need review right now.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <Section title={`Pending (${pending.length})`}>
              {pending.map((f) => (
                <FlagCard key={f.id} flag={f} onUpdate={updateFlag} />
              ))}
            </Section>
          )}

          {reviewed.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setShowReviewed((v) => !v)}
                style={toggleBtnStyle}
              >
                {showReviewed ? "Hide" : "Show"} reviewed ({reviewed.length})
              </button>
              {showReviewed && (
                <Section title="Reviewed">
                  {reviewed.map((f) => (
                    <FlagCard key={f.id} flag={f} onUpdate={updateFlag} />
                  ))}
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={sectionTitle}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function FlagCard({ flag, onUpdate }: { flag: FlagRow; onUpdate: (id: string, s: FlagStatus) => void }) {
  const isPending = flag.status === "pending";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        opacity: isPending ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", gap: 16, padding: "16px 20px" }}>
        {/* Photo thumbnail */}
        {flag.media?.file_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flag.media.file_url}
            alt=""
            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-lg)", flexShrink: 0 }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: "var(--type-xxs)",
                background: "var(--color-surface-raised)",
                color: "var(--color-fg-muted)",
                borderRadius: "var(--radius-full)",
                padding: "2px 8px",
              }}
            >
              {flag.flag_type}
            </span>
            <span
              style={{
                fontSize: "var(--type-xxs)",
                color:
                  flag.status === "pending"
                    ? "#f59e0b"
                    : flag.status === "approved"
                    ? "var(--color-success)"
                    : "var(--color-danger)",
              }}
            >
              {flag.status}
            </span>
          </div>
          <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg)", margin: 0 }}>
            {flag.description}
          </p>
        </div>
      </div>

      {isPending && (
        <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--color-surface-raised)" }}>
          <button onClick={() => onUpdate(flag.id, "approved")} style={approveBtnStyle}>
            Approve
          </button>
          <button onClick={() => onUpdate(flag.id, "rejected")} style={rejectBtnStyle}>
            Reject
          </button>
          <button onClick={() => onUpdate(flag.id, "hidden")} style={hideBtnStyle}>
            Hide
          </button>
        </div>
      )}
    </div>
  );
}

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--color-fg-muted)",
  letterSpacing: 2,
  textTransform: "uppercase",
  margin: "0 0 12px",
};

const toggleBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-primary-soft)",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
  padding: "0 0 12px",
};

const approveBtnStyle: React.CSSProperties = {
  background: "var(--color-success)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "7px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};

const rejectBtnStyle: React.CSSProperties = {
  background: "rgba(255,107,107,0.15)",
  color: "var(--color-danger)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "7px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};

const hideBtnStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  color: "var(--color-fg-muted)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "7px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};
