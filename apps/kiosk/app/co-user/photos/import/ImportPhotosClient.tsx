"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, supabase, processPhotos } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

interface QueueItem {
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "processing" | "done" | "error";
  error?: string;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export default function ImportPhotosClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const items: QueueItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.he(ic|if)$/i.test(f.name))
      .map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        status: "waiting",
      }));
    setQueue((q) => [...q, ...items]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  async function handleImport() {
    if (!userId || queue.length === 0) return;
    setRunning(true);

    const toProcess: Array<{ mediaId: string; photoUrl: string }> = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== "waiting") continue;

      setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));

      try {
        const ext = item.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const safeExt = /^(jpg|jpeg|png|webp|gif|avif)$/.test(ext) ? ext : "jpg";
        const filename = `${Date.now()}_${randomSuffix()}.${safeExt}`;
        const path = `photos/${userId}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(path, item.file, { contentType: item.file.type || "image/jpeg" });

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        if (!publicUrl.startsWith("http")) {
          throw new Error("Could not get public URL for photo.");
        }

        const { data: row, error: insertError } = await supabase
          .from("media")
          .insert({
            user_id: userId,
            file_url: publicUrl,
            file_type: "photo",
            taken_at: item.file.lastModified
              ? new Date(item.file.lastModified).toISOString()
              : null,
            verification_status: "pending",
          })
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);

        toProcess.push({ mediaId: (row as { id: string }).id, photoUrl: publicUrl });
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: "processing" } : x)));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, status: "error", error: msg } : x)));
      }
    }

    if (toProcess.length > 0) {
      await processPhotos(toProcess, userId, (current, total) => {
        const processed = toProcess.slice(0, current).map((p) => p.mediaId);
        setQueue((q) =>
          q.map((x) => {
            if (x.status !== "processing") return x;
            // Mark done for the ones whose mediaId just finished
            return processed.includes(
              toProcess.find((_, idx) => idx === current - 1)?.mediaId ?? ""
            )
              ? { ...x, status: "done" }
              : x;
          })
        );
      });
      setQueue((q) => q.map((x) => (x.status === "processing" ? { ...x, status: "done" } : x)));
    }

    setRunning(false);
    setDone(true);
  }

  const waitingCount = queue.filter((q) => q.status === "waiting").length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Import Photos"
        subtitle="Upload photos from this device"
        backHref="/co-user/photos"
        backLabel="Photos"
      />

      {done ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <Icon name="photos" size={48} color="var(--color-success)" />
          <h2 style={{ fontSize: "var(--type-greeting)", color: "var(--color-fg-strong)", margin: "16px 0 8px" }}>
            Import complete
          </h2>
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--type-md)" }}>
            {doneCount} photo{doneCount !== 1 ? "s" : ""} imported
            {errorCount > 0 ? `, ${errorCount} failed` : ""}. AI processing started in the background.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button onClick={() => router.push("/co-user/photos")} style={primaryBtnStyle}>
              View Photos
            </button>
            <button onClick={() => { setQueue([]); setDone(false); }} style={secondaryBtnStyle}>
              Import More
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !running && inputRef.current?.click()}
            style={{
              border: "2px dashed var(--color-surface-raised)",
              borderRadius: "var(--radius-xxl)",
              padding: "40px 32px",
              textAlign: "center",
              cursor: running ? "not-allowed" : "pointer",
              marginBottom: 24,
              transition: "border-color 0.15s",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Icon name="photos" size={40} color="var(--color-primary-soft)" />
            <p style={{ fontSize: "var(--type-lg)", color: "var(--color-fg-strong)", margin: "12px 0 4px" }}>
              Drop photos here or click to browse
            </p>
            <p style={{ fontSize: "var(--type-sm)", color: "var(--color-fg-muted)", margin: 0 }}>
              JPG, PNG, WebP, HEIC — multiple files supported
            </p>
          </div>

          {/* Queue grid */}
          {queue.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 10,
                marginBottom: 24,
              }}
            >
              {queue.map((item, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: item.status === "error" ? "rgba(255,107,107,0.5)" : item.status === "done" ? "rgba(76,175,80,0.3)" : "rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.status === "uploading" && <span style={{ color: "white", fontSize: "var(--type-xs)" }}>↑</span>}
                    {item.status === "processing" && <span style={{ color: "white", fontSize: "var(--type-xs)" }}>AI</span>}
                    {item.status === "done" && <span style={{ color: "white", fontSize: "var(--type-lg)" }}>✓</span>}
                    {item.status === "error" && <span style={{ color: "white", fontSize: "var(--type-xs)" }}>!</span>}
                  </div>
                  {!running && item.status === "waiting" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setQueue((q) => q.filter((_, j) => j !== i)); }}
                      style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "var(--radius-full)", background: "rgba(0,0,0,0.7)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {queue.length > 0 && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={handleImport}
                disabled={running || waitingCount === 0}
                style={{
                  ...primaryBtnStyle,
                  opacity: running || waitingCount === 0 ? 0.5 : 1,
                  cursor: running || waitingCount === 0 ? "not-allowed" : "pointer",
                }}
              >
                {running
                  ? `Importing…`
                  : `Import ${waitingCount} photo${waitingCount !== 1 ? "s" : ""}`}
              </button>
              {!running && (
                <button onClick={() => setQueue([])} style={secondaryBtnStyle}>
                  Clear all
                </button>
              )}
            </div>
          )}
        </>
      )}
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
