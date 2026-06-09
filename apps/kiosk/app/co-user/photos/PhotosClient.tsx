"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

type VerificationStatus = "pending" | "verified" | "hidden";
type FilterTab = "all" | "verified" | "pending";

interface PhotoRow {
  id: string;
  file_url: string;
  description: string | null;
  taken_at: string | null;
  verification_status: VerificationStatus;
  ai_tags: string[] | null;
}

export default function PhotosClient() {
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [lightbox, setLightbox] = useState<PhotoRow | null>(null);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("media")
      .select("id, file_url, description, taken_at, verification_status, ai_tags")
      .eq("user_id", userId)
      .neq("verification_status", "hidden")
      .order("taken_at", { ascending: false, nullsFirst: false });
    setPhotos((data as PhotoRow[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: VerificationStatus) {
    await supabase.from("media").update({ verification_status: status }).eq("id", id);
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, verification_status: status } : x)));
    if (lightbox?.id === id) setLightbox((prev) => prev ? { ...prev, verification_status: status } : null);
  }

  const filtered = filter === "all" ? photos : photos.filter((p) => p.verification_status === filter);
  const verifiedCount = photos.filter((p) => p.verification_status === "verified").length;
  const pendingCount = photos.filter((p) => p.verification_status === "pending").length;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="Photos"
        subtitle={`${photos.length} photos`}
        action={
          <Link href="/co-user/photos/import" style={addBtnStyle}>
            <Icon name="photos" size={18} color="white" />
            Import Photos
          </Link>
        }
      />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {([
          { key: "all", label: `All (${photos.length})` },
          { key: "verified", label: `Verified (${verifiedCount})` },
          { key: "pending", label: `Pending (${pendingCount})` },
        ] as { key: FilterTab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-pill)",
              border: "none",
              background: filter === tab.key ? "var(--color-primary)" : "var(--color-surface-raised)",
              color: filter === tab.key ? "white" : "var(--color-fg-muted)",
              fontSize: "var(--type-sm)",
              cursor: "pointer",
              fontWeight: filter === tab.key ? "var(--type-weight-medium)" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onClick={() => setLightbox(photo)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setLightbox(null)}
        >
          <button
            style={closeBtnStyle}
            onClick={() => setLightbox(null)}
          >
            <Icon name="close" size={20} color="white" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.file_url}
            alt={lightbox.description ?? ""}
            style={{
              maxWidth: "90vw",
              maxHeight: "70vh",
              objectFit: "contain",
              borderRadius: "var(--radius-xl)",
            }}
            onClick={(e) => e.stopPropagation()}
          />

          <div
            style={{
              marginTop: 16,
              background: "rgba(42,42,74,0.95)",
              borderRadius: "var(--radius-xl)",
              padding: "16px 20px",
              maxWidth: 600,
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.description && (
              <p style={{ color: "var(--color-fg)", fontSize: "var(--type-md)", margin: "0 0 12px" }}>
                {lightbox.description}
              </p>
            )}
            {lightbox.ai_tags && lightbox.ai_tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {lightbox.ai_tags.map((t) => (
                  <span key={t} style={tagChipStyle}>{t}</span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {lightbox.verification_status !== "verified" && (
                <button
                  onClick={() => updateStatus(lightbox.id, "verified")}
                  style={verifyBtnStyle}
                >
                  Verify
                </button>
              )}
              {lightbox.verification_status !== "pending" && (
                <button
                  onClick={() => updateStatus(lightbox.id, "pending")}
                  style={pendingBtnStyle}
                >
                  Mark Pending
                </button>
              )}
              <button
                onClick={async () => {
                  await updateStatus(lightbox.id, "hidden");
                  setLightbox(null);
                }}
                style={hideBtnStyle}
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PhotoTile({ photo, onClick }: { photo: PhotoRow; onClick: () => void }) {
  const badgeColor =
    photo.verification_status === "verified"
      ? "var(--color-success)"
      : "var(--color-fg-muted)";

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        cursor: "pointer",
        border: photo.verification_status === "pending" ? "2px solid #f59e0b" : "2px solid transparent",
      }}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.file_url}
        alt={photo.description ?? ""}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          width: 10,
          height: 10,
          borderRadius: "var(--radius-full)",
          background: badgeColor,
          border: "2px solid rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterTab }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-fg-muted)" }}>
      <Icon name="photos" size={48} color="var(--color-surface-raised)" />
      <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>
        {filter === "all" ? "No photos yet" : `No ${filter} photos`}
      </p>
      {filter === "all" && (
        <Link href="/co-user/photos/import" style={{ ...addBtnStyle, marginTop: 24 }}>
          Import photos
        </Link>
      )}
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

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  width: 44,
  height: 44,
  borderRadius: "var(--radius-full)",
  background: "rgba(255,255,255,0.1)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const tagChipStyle: React.CSSProperties = {
  fontSize: "var(--type-xxs)",
  background: "rgba(124,77,255,0.2)",
  color: "var(--color-primary-soft)",
  borderRadius: "var(--radius-full)",
  padding: "3px 10px",
};

const verifyBtnStyle: React.CSSProperties = {
  background: "var(--color-success)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};

const pendingBtnStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  color: "var(--color-fg-muted)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};

const hideBtnStyle: React.CSSProperties = {
  background: "rgba(255,107,107,0.15)",
  color: "var(--color-danger)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
};
