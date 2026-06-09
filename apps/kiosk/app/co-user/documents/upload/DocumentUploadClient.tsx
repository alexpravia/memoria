"use client";

// v1 document extraction — see future-implementations.md for known limitations.
// PDF: pdfjs-dist (client-side, digital PDFs only). TXT: FileReader. Images: stored without text extraction.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type FileStatus = "idle" | "uploading" | "extracting" | "embedding" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
  chunkCount?: number;
}

/** Chunk text into ~500-char segments at paragraph boundaries. */
function chunkText(text: string, maxLen = 500): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

/** Extract text from a PDF file using pdfjs-dist. Returns "" on failure. */
async function extractPdfText(file: File): Promise<string> {
  try {
    // Dynamic import avoids SSR issues.
    const pdfjsLib = await import("pdfjs-dist");
    // Use the CDN worker matching the installed version.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => {
          const it = item as { str?: string };
          return it.str ?? "";
        })
        .join(" ");
      if (pageText.trim()) pages.push(pageText);
    }
    return pages.join("\n\n");
  } catch {
    return "";
  }
}

/** Embed a text string via the `embed` Edge Function. Returns null on failure. */
async function embedText(text: string): Promise<number[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("embed", { body: { text } });
    if (error) return null;
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return Array.isArray(parsed?.embedding) ? parsed.embedding : null;
  } catch {
    return null;
  }
}

/** Process one file: upload → extract → chunk → embed → insert chunks. */
async function processFile(
  file: File,
  userId: string,
  onStatus: (s: FileStatus) => void
): Promise<{ chunkCount: number } | { error: string }> {
  // 1. Upload to storage
  onStatus("uploading");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const path = `${userId}/documents/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
  if (uploadErr) return { error: uploadErr.message };

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
  const fileUrl = urlData.publicUrl;

  // 2. Insert document row
  const { data: docRow, error: insertErr } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      file_url: fileUrl,
      file_name: file.name,
      file_type: ext,
      byte_size: file.size,
      processing_status: "processing",
    })
    .select("id")
    .single();
  if (insertErr || !docRow) return { error: insertErr?.message ?? "Insert failed" };
  const docId = (docRow as { id: string }).id;

  // 3. Extract text
  onStatus("extracting");
  let rawText = "";
  if (ext === "txt") {
    rawText = await file.text();
  } else if (ext === "pdf") {
    rawText = await extractPdfText(file);
    if (!rawText.trim()) {
      await supabase.from("documents").update({
        processing_status: "processed",
        summary: "Scanned PDF — text extraction not available in v1.",
      }).eq("id", docId);
      return { chunkCount: 0 };
    }
  } else {
    // Images and unsupported formats: stored but not extracted
    await supabase.from("documents").update({
      processing_status: "processed",
      summary: `${ext.toUpperCase()} file — text extraction not supported in v1.`,
    }).eq("id", docId);
    return { chunkCount: 0 };
  }

  // 4. Chunk + embed
  onStatus("embedding");
  const chunks = chunkText(rawText);
  let embedded = 0;
  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    const embedding = await embedText(text);
    const { error: chunkErr } = await supabase.from("document_chunks").insert({
      document_id: docId,
      user_id: userId,
      chunk_index: i,
      text,
      embedding: embedding ? JSON.stringify(embedding) : null,
    });
    if (!chunkErr) embedded++;
  }

  const summary = rawText.slice(0, 200).replace(/\s+/g, " ").trim() + (rawText.length > 200 ? "…" : "");
  await supabase.from("documents").update({
    processing_status: "processed",
    summary,
    processed_at: new Date().toISOString(),
  }).eq("id", docId);

  return { chunkCount: embedded };
}

const ACCEPTED_TYPES = ".txt,.pdf,.jpg,.jpeg,.png,.heic,.heif";

export default function DocumentUploadClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: FileEntry[] = Array.from(files).map((f) => ({ file: f, status: "idle" as FileStatus }));
    setEntries((prev) => [...prev, ...newEntries]);
  }

  function updateEntry(index: number, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  async function handleUpload() {
    if (!userId || entries.length === 0 || running) return;
    setRunning(true);

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status === "done") continue;
      updateEntry(i, { status: "uploading", error: undefined });
      const result = await processFile(entries[i].file, userId, (s) => updateEntry(i, { status: s }));
      if ("error" in result) {
        updateEntry(i, { status: "error", error: result.error });
      } else {
        updateEntry(i, { status: "done", chunkCount: result.chunkCount });
      }
    }

    setRunning(false);
    setDone(true);
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    if (done) setDone(false);
  }

  const statusLabel: Record<FileStatus, string> = {
    idle: "Ready",
    uploading: "Uploading…",
    extracting: "Extracting text…",
    embedding: "Embedding…",
    done: "Done",
    error: "Error",
  };

  const canUpload = !running && entries.some((e) => e.status === "idle" || e.status === "error");

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Upload Document"
        subtitle="Add reference documents for Memo to use"
        backHref="/co-user/documents"
        backLabel="Documents"
      />

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        style={{
          border: "2px dashed var(--color-surface-raised)",
          borderRadius: "var(--radius-xxl)",
          padding: "48px 32px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <Icon name="tip" size={40} color="var(--color-primary-soft)" />
        <p style={{ fontSize: "var(--type-lg)", color: "var(--color-fg-strong)", margin: "12px 0 4px" }}>
          Drop files here or click to browse
        </p>
        <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: 0 }}>
          Supports .txt and .pdf (digitally-created). Images stored without text extraction.
        </p>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {entries.map((entry, i) => (
            <div
              key={i}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-surface-raised)",
                borderRadius: "var(--radius-xl)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--type-md)", color: "var(--color-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.file.name}
                </div>
                <div style={{ fontSize: "var(--type-xs)", color: entry.status === "error" ? "var(--color-danger)" : entry.status === "done" ? "var(--color-success)" : "var(--color-fg-muted)", marginTop: 2 }}>
                  {entry.status === "error" ? entry.error : entry.status === "done" ? `Done${entry.chunkCount ? ` — ${entry.chunkCount} chunks` : " (no text extracted)"}` : statusLabel[entry.status]}
                </div>
              </div>
              {entry.status === "idle" && (
                <button
                  onClick={() => removeEntry(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                >
                  <Icon name="close" size={16} color="var(--color-fg-muted)" />
                </button>
              )}
              {entry.status === "done" && (
                <Icon name="check" size={18} color="var(--color-success)" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleUpload}
          disabled={!canUpload || entries.length === 0}
          style={{
            ...primaryBtnStyle,
            opacity: !canUpload || entries.length === 0 ? 0.5 : 1,
            cursor: !canUpload || entries.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {running ? "Processing…" : `Upload ${entries.filter((e) => e.status !== "done").length || entries.length} file${entries.length !== 1 ? "s" : ""}`}
        </button>
        {done && (
          <button onClick={() => router.push("/co-user/documents")} style={secondaryBtnStyle}>
            View Documents
          </button>
        )}
      </div>
    </main>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "12px 24px",
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-medium)",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  color: "var(--color-fg-muted)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "12px 24px",
  fontSize: "var(--type-md)",
  cursor: "pointer",
};
