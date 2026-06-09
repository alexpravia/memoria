"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, supabase } from "@memoria/core";
import { PageHeader } from "@/components/co-user/PageHeader";
import Icon from "@/components/Icon";

interface PersonRow {
  id: string;
  full_name: string;
  relationship: string;
  photo_url: string | null;
  emotional_notes: string | null;
  key_facts: string[];
  is_sensitive: boolean;
}

export default function PeopleClient() {
  const { userId } = useAuth();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("people")
      .select("id, full_name, relationship, photo_url, emotional_notes, key_facts, is_sensitive")
      .eq("user_id", userId)
      .order("full_name");
    setPeople((data as PersonRow[]) ?? []);
    setLoading(false);
  }

  async function deletePerson(id: string) {
    if (!confirm("Remove this person?")) return;
    await supabase.from("people").delete().eq("id", id);
    setPeople((p) => p.filter((x) => x.id !== id));
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px" }}>
      <PageHeader
        title="People"
        subtitle="Family, friends, and caregivers"
        action={
          <Link href="/co-user/people/add" style={addBtnStyle}>
            <Icon name="addPerson" size={18} color="white" />
            Add Person
          </Link>
        }
      />

      {loading ? (
        <p style={mutedText}>Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {people.map((p) => (
            <PersonCard key={p.id} person={p} onDelete={deletePerson} />
          ))}
        </div>
      )}
    </main>
  );
}

function PersonCard({
  person,
  onDelete,
}: {
  person: PersonRow;
  onDelete: (id: string) => void;
}) {
  const initials = person.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-surface-raised)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Avatar */}
      <div style={avatarStyle}>{initials}</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: "var(--type-md)",
              fontWeight: "var(--type-weight-medium)",
              color: "var(--color-fg-strong)",
            }}
          >
            {person.full_name}
          </span>
          {person.is_sensitive && (
            <span style={sensitiveChipStyle}>sensitive</span>
          )}
        </div>
        <div
          style={{
            fontSize: "var(--type-sm)",
            color: "var(--color-fg-muted)",
            marginTop: 2,
          }}
        >
          {person.relationship}
        </div>
        {person.emotional_notes && (
          <div
            style={{
              fontSize: "var(--type-sm)",
              color: "var(--color-fg-muted)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {person.emotional_notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link
          href={`/co-user/people/${person.id}/edit`}
          style={iconBtnStyle}
          title="Edit"
        >
          <Icon name="tip" size={16} color="var(--color-primary-soft)" />
        </Link>
        <button
          onClick={() => onDelete(person.id)}
          style={{ ...iconBtnStyle, cursor: "pointer", border: "none" }}
          title="Delete"
        >
          <Icon name="close" size={16} color="var(--color-danger)" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--color-fg-muted)",
      }}
    >
      <Icon name="contacts" size={48} color="var(--color-surface-raised)" />
      <p style={{ fontSize: "var(--type-lg)", marginTop: 16 }}>
        No people added yet
      </p>
      <p style={{ fontSize: "var(--type-sm)", marginTop: 6 }}>
        Add family members, friends, and caregivers so Memo can talk about them.
      </p>
      <Link href="/co-user/people/add" style={{ ...addBtnStyle, marginTop: 24 }}>
        Add the first person
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

const avatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "var(--radius-full)",
  background: "linear-gradient(135deg, #9c6bff, #7340d8)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "var(--type-md)",
  fontWeight: "var(--type-weight-bold)",
  flexShrink: 0,
};

const sensitiveChipStyle: React.CSSProperties = {
  fontSize: "var(--type-xxs)",
  background: "rgba(255,107,107,0.15)",
  color: "var(--color-danger)",
  borderRadius: "var(--radius-full)",
  padding: "2px 8px",
  letterSpacing: 0.5,
};

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "var(--radius-lg)",
  background: "var(--color-surface-raised)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};
