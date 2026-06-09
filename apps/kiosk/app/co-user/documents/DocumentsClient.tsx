"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type DocStatus = "pending" | "processing" | "processed" | "failed" | "hidden";

interface DocumentRow {
  id: string;
  file_name: string | null;
  file_type: string | null;
  byte_size: number | null;
  summary: string | null;
  processing_status: DocStatus;
  created_at: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",    color: "var(--color-fg-muted)",  bg: "var(--color-surface-raised)" },
  processing: { label: "Processing", color: "#f59e0b",               bg: "rgba(245,158,11,0.12)" },
  processed:  { label: "Processed",  color: "var(--color-success)",  bg: "rgba(76,175,80,0.12)" },
  failed:     { label: "Failed",     color: "var(--color-danger)",   bg: "rgba(255,107,107,0.12)" },
  hidden:     { label: "Hidden",     color: "var(--color-fg-muted)", bg: "var(--color-surface-raised)" },
};

export default function DocumentsClient() {
  const { userId } = useAuth();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_type, byte_size, summary, processing_status, created_at")
      .eq("user_id", userId)
      .neq("processing_status", "hidden")
      .order("created_at", { ascending: false });
    setDocs((data as DocumentRow[]) ?? []);
    setLoading(false);
  }

  async function hideDoc(id: string) {
    await supabase.from("documents").update({ processing_status: "hidden" }).eq("id", id);
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Uploaded Documents"
        subtitle="Medical records, family histories, and other reference documents"
        backHref="/co-user"
        backLabel="Dashboard"
      />

      <div style={{ marginBottom: 24 }}>
        <Link href="/co-user/documents/upload" style={uploadBtnStyle}>
          <Icon name="add" size={18} color="white" />
          Upload Document
        </Link>
      </div>

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
          <Icon name="tip" size={48} color="var(--color-surface-raised)" />
          <p style={{ fontSize: "var(--type-lg)", marginTop: 16, color: "var(--color-fg)" }}>
            No documents uploaded yet
          </p>
          <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
            Upload medical records, family histories, or letters to give Memo more context.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((doc) => {
            const cfg = STATUS_CONFIG[doc.processing_status] ?? STATUS_CONFIG.pending;
            return (
              <div
                key={doc.id}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-surface-raised)",
                  borderRadius: "var(--radius-xl)",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-surface-raised)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="tip" size={20} color="var(--color-primary-soft)" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--type-md)", fontWeight: "var(--type-weight-medium)", color: "var(--color-fg-strong)" }}>
                      {doc.file_name ?? "Document"}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--type-xxs)",
                        background: cfg.bg,
                        color: cfg.color,
                        borderRadius: "var(--radius-full)",
                        padding: "2px 8px",
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {doc.summary && (
                    <p style={{ margin: "4px 0 0", fontSize: "var(--type-sm)", color: "var(--color-fg-muted)" }}>
                      {doc.summary}
                    </p>
                  )}
                  <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {doc.file_type && (
                      <span style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)" }}>
                        {doc.file_type.toUpperCase()}
                      </span>
                    )}
                    {doc.byte_size && (
                      <span style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)" }}>
                        {formatBytes(doc.byte_size)}
                      </span>
                    )}
                    <span style={{ fontSize: "var(--type-xs)", color: "var(--color-fg-muted)" }}>
                      {new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => hideDoc(doc.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-fg-muted)",
                    padding: 4,
                    flexShrink: 0,
                  }}
                  title="Remove"
                >
                  <Icon name="trash" size={18} color="var(--color-fg-muted)" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const uploadBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "11px 22px",
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-medium)",
  textDecoration: "none",
  cursor: "pointer",
};

const mutedText: React.CSSProperties = {
  color: "var(--color-fg-muted)",
  fontSize: "var(--type-md)",
  padding: "40px 0",
};
