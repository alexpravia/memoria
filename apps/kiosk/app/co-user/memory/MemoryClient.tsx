"use client";

import { useEffect, useState } from "react";
import {
  useAuth,
  listMemoriesForCoUser,
  updateMemoryStatus,
  deleteMemory,
  type AssistantMemory,
  type MemoryKind,
} from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

const KIND_LABELS: Record<MemoryKind, string> = {
  observation: "Observation",
  preference: "Preference",
  recurring_question: "Recurring Question",
  emotional_state: "Emotional State",
  factual_correction: "Factual Correction",
};

const STATUS_COLORS: Record<string, string> = {
  active: "var(--color-primary-soft)",
  pinned: "#f59e0b",
  suppressed: "var(--color-fg-muted)",
};

export default function MemoryClient() {
  const { userId } = useAuth();
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<MemoryKind | "all">("all");

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const data = await listMemoriesForCoUser(userId);
    setMemories(data);
    setLoading(false);
  }

  async function handleStatus(id: string, status: AssistantMemory["status"]) {
    await updateMemoryStatus(id, status);
    setMemories((m) => m.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this memory?")) return;
    await deleteMemory(id);
    setMemories((m) => m.filter((x) => x.id !== id));
  }

  const allKinds = Array.from(new Set(memories.map((m) => m.kind))) as MemoryKind[];
  const filtered = filterKind === "all" ? memories : memories.filter((m) => m.kind === filterKind);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Memo's Notes"
        subtitle="Things Memo has learned about them"
      />

      {/* Kind filter */}
      {allKinds.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <FilterChip active={filterKind === "all"} onClick={() => setFilterKind("all")} label="All" />
          {allKinds.map((k) => (
            <FilterChip
              key={k}
              active={filterKind === k}
              onClick={() => setFilterKind(k)}
              label={KIND_LABELS[k]}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
          <Icon name="notes" size={48} color="var(--color-surface-raised)" />
          <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>No memories yet</p>
          <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
            Memo learns from conversations and stores notes here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        border: "none",
        background: active ? "var(--color-primary)" : "var(--color-surface-raised)",
        color: active ? "white" : "var(--color-fg-muted)",
        fontSize: "var(--type-sm)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function MemoryCard({
  memory,
  onStatus,
  onDelete,
}: {
  memory: AssistantMemory;
  onStatus: (id: string, s: AssistantMemory["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const importanceBar = Array.from({ length: 5 }, (_, i) => i < memory.importance);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        opacity: memory.status === "suppressed" ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: "var(--type-xxs)",
                background: "var(--color-surface-raised)",
                color: STATUS_COLORS[memory.status] ?? "var(--color-fg-muted)",
                borderRadius: "var(--radius-full)",
                padding: "2px 8px",
              }}
            >
              {KIND_LABELS[memory.kind]}
            </span>
            <span
              style={{
                fontSize: "var(--type-xxs)",
                color: STATUS_COLORS[memory.status] ?? "var(--color-fg-muted)",
              }}
            >
              {memory.status}
            </span>
            {/* Importance dots */}
            <div style={{ display: "flex", gap: 3 }}>
              {importanceBar.map((filled, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "var(--radius-full)",
                    background: filled ? "var(--color-primary)" : "var(--color-surface-raised)",
                  }}
                />
              ))}
            </div>
          </div>
          <p style={{ fontSize: "var(--type-md)", color: "var(--color-fg)", margin: 0 }}>
            {memory.content}
          </p>
          <p style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)", margin: "6px 0 0" }}>
            {new Date(memory.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {memory.status !== "pinned" && (
            <ActionBtn onClick={() => onStatus(memory.id, "pinned")} title="Pin">
              ★
            </ActionBtn>
          )}
          {memory.status !== "suppressed" && (
            <ActionBtn onClick={() => onStatus(memory.id, "suppressed")} title="Suppress">
              <Icon name="close" size={14} color="var(--color-fg-muted)" />
            </ActionBtn>
          )}
          {memory.status === "suppressed" && (
            <ActionBtn onClick={() => onStatus(memory.id, "active")} title="Restore">
              ↩
            </ActionBtn>
          )}
          <ActionBtn onClick={() => onDelete(memory.id)} title="Delete" danger>
            <Icon name="close" size={14} color="var(--color-danger)" />
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: "var(--radius-lg)",
        background: danger ? "rgba(255,107,107,0.1)" : "var(--color-surface-raised)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: danger ? "var(--color-danger)" : "var(--color-fg-muted)",
        fontSize: "var(--type-sm)",
      }}
    >
      {children}
    </button>
  );
}

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};
