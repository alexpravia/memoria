"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

interface LifeFact {
  id: string;
  fact: string;
  category: string | null;
  created_at: string;
}

export default function LifeFactsClient() {
  const { userId } = useAuth();
  const [facts, setFacts] = useState<LifeFact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("life_facts")
      .select("id, fact, category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setFacts((data as LifeFact[]) ?? []);
    setLoading(false);
  }

  async function deleteFact(id: string) {
    if (!confirm("Delete this fact?")) return;
    await supabase.from("life_facts").delete().eq("id", id);
    setFacts((f) => f.filter((x) => x.id !== id));
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Life Facts"
        subtitle="Important memories and facts about their life"
        action={
          <Link href="/co-user/life-facts/add" style={addBtnStyle}>
            <Icon name="tip" size={18} color="white" />
            Add Fact
          </Link>
        }
      />

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : facts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {facts.map((f) => (
            <FactCard key={f.id} fact={f} onDelete={deleteFact} />
          ))}
        </div>
      )}
    </main>
  );
}

function FactCard({ fact, onDelete }: { fact: LifeFact; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          background: "var(--color-primary-soft)",
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: "var(--type-md)", color: "var(--color-fg)" }}>
          {fact.fact}
        </span>
        {fact.category && (
          <span
            style={{
              marginLeft: 8,
              fontSize: "var(--type-xxs)",
              background: "var(--color-surface-raised)",
              color: "var(--color-fg-muted)",
              borderRadius: "var(--radius-full)",
              padding: "2px 8px",
            }}
          >
            {fact.category}
          </span>
        )}
      </div>
      <button
        onClick={() => onDelete(fact.id)}
        style={iconBtnStyle}
        title="Delete"
      >
        <Icon name="close" size={16} color="var(--color-danger)" />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
      <Icon name="tip" size={48} color="var(--color-surface-raised)" />
      <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>No life facts yet</p>
      <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
        Add facts so Memo can remind them of who they are.
      </p>
      <Link href="/co-user/life-facts/add" style={{ ...addBtnStyle, marginTop: 24 }}>
        Add the first fact
      </Link>
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--color-primary)",
  color: "white",
  borderRadius: "var(--radius-pill)",
  padding: "10px 20px",
  fontSize: "var(--type-sm)",
  fontWeight: "var(--type-weight-medium)",
  textDecoration: "none",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface-raised)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
};
