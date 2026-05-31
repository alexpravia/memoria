// Co-user briefing preview & approval screen (Phase E).
//
// Lets the co-user generate, review, edit, reorder, and approve the
// next morning's AI briefing before it ships to the user. Visual style
// mirrors `SensitivityFiltersScreen.tsx`.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import {
  approveBriefing,
  generateBriefing,
  getBriefingForDate,
  reorderSlides,
  resolveSlidePhotos,
  updateSlide,
  validateBriefing,
  type Briefing,
  type BriefingSlide,
} from "../../lib/briefing";
import { logPreferenceSignal } from "../../lib/preferenceSignals";
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import Icon from "../../components/Icon";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  // Avoid TZ surprises: parse the YYYY-MM-DD literally.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#7c4dff",
  approved: "#4caf50",
  delivered: "#2196f3",
  failed: "#ff6b6b",
};

export default function BriefingPreviewScreen({ navigation }: Props) {
  const { userId, coUserId } = useAuth();
  const [date, setDate] = useState(tomorrowISO());
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [slides, setSlides] = useState<BriefingSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIndices, setDirtyIndices] = useState<Set<number>>(new Set());
  const { open: openLightbox, lightbox } = usePhotoLightbox();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const b = await getBriefingForDate(userId, date);
    if (b) {
      const resolved = await resolveSlidePhotos(b.slides ?? []);
      setBriefing(b);
      setSlides(resolved);
    } else {
      setBriefing(null);
      setSlides([]);
    }
    setDirtyIndices(new Set());
    setLoading(false);
  }, [userId, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    if (!userId) return;
    // Regenerating over an existing briefing is an implicit rejection of the
    // prior draft — log it before generateBriefing overwrites the row.
    if (briefing) {
      logPreferenceSignal({
        userId,
        coUserId,
        signalType: "briefing_regenerated",
        referenceId: briefing.id,
        content: slides.map((s) => s.title).join(" | "),
        metadata: { date, slide_count: slides.length },
      });
    }
    setGenerating(true);
    setError(null);
    const out = await generateBriefing(userId, date);
    setGenerating(false);
    if (out.error) {
      setError(out.error);
      Alert.alert("Generation failed", out.error);
    }
    await load();
  }

  function markDirty(index: number) {
    setDirtyIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  function editField(index: number, field: keyof BriefingSlide, value: string) {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    markDirty(index);
  }

  async function moveSlide(index: number, direction: -1 | 1) {
    if (!briefing) return;
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;

    const newOrder = slides.map((_, i) => i);
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];

    // Optimistic local swap.
    const swapped = newOrder.map((i) => slides[i]);
    setSlides(swapped);

    const res = await reorderSlides(briefing.id, newOrder);
    if (!res.ok) {
      Alert.alert("Reorder failed", res.error ?? "Unknown error");
      load();
    } else {
      // Reordering invalidates per-index dirty marks; cleanest to clear.
      setDirtyIndices(new Set());
    }
  }

  function deleteSlide(index: number) {
    Alert.alert("Remove slide?", "This slide will be removed from the briefing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!briefing) return;
          // Snapshot the removed slide before setSlides drops it from state.
          const removed = slides[index];
          const newOrder = slides.map((_, i) => i).filter((i) => i !== index);
          const next = newOrder.map((i) => slides[i]);
          setSlides(next);
          const res = await reorderSlides(briefing.id, newOrder);
          if (!res.ok) {
            Alert.alert("Remove failed", res.error ?? "Unknown error");
            load();
          } else {
            if (userId) {
              logPreferenceSignal({
                userId,
                coUserId,
                signalType: "briefing_slide_deleted",
                referenceId: briefing.id,
                content: removed ? `${removed.kind}: ${removed.title}` : null,
                metadata: { index, kind: removed?.kind },
              });
            }
            setDirtyIndices(new Set());
          }
        },
      },
    ]);
  }

  async function handleSave() {
    if (!briefing) return;
    setSaving(true);
    let lastErr: string | null = null;
    for (const idx of dirtyIndices) {
      const slide = slides[idx];
      if (!slide) continue;
      // Strip resolved photo_url before persisting — only ids live in jsonb.
      const { photo_url: _omit, ...persist } = slide;
      void _omit;
      const res = await updateSlide(briefing.id, idx, persist as BriefingSlide);
      if (!res.ok) {
        lastErr = res.error ?? "Failed to save";
        break;
      }
    }
    setSaving(false);
    if (lastErr) {
      Alert.alert("Save failed", lastErr);
    } else {
      if (userId) {
        for (const idx of dirtyIndices) {
          const slide = slides[idx];
          if (!slide) continue;
          logPreferenceSignal({
            userId,
            coUserId,
            signalType: "briefing_slide_edited",
            referenceId: briefing.id,
            content: `${slide.kind}: ${slide.title}`,
            metadata: { index: idx },
          });
        }
      }
      setDirtyIndices(new Set());
      Alert.alert("Saved", "Your edits have been saved.");
      load();
    }
  }

  async function handleApprove() {
    if (!briefing || !coUserId) return;
    const v = validateBriefing(slides);
    if (!v.ok) {
      Alert.alert("Cannot approve", v.reason);
      return;
    }
    const res = await approveBriefing(briefing.id, coUserId);
    if (!res.ok) {
      Alert.alert("Approve failed", res.error ?? "Unknown error");
      return;
    }
    if (userId) {
      logPreferenceSignal({
        userId,
        coUserId,
        signalType: "briefing_approved",
        referenceId: briefing.id,
        content: slides.map((s) => s.title).join(" | "),
        metadata: { date: briefing.briefing_date, slide_count: slides.length },
      });
    }
    Alert.alert("Approved", "The briefing will be shown tomorrow.");
    load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  const status = briefing?.status ?? "none";
  const statusColor = STATUS_COLORS[status] ?? "#999";
  const validation = briefing ? validateBriefing(slides) : { ok: false, reason: "no briefing" };
  const canApprove =
    !!briefing && briefing.status === "draft" && validation.ok;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Briefing</Text>
      <Text style={styles.subtitle}>{formatDate(date)}</Text>

      {/* Date toggle — Today is for testing now; Tomorrow is the real morning briefing */}
      <View style={styles.dateToggleRow}>
        <TouchableOpacity
          style={[styles.dateToggle, date === todayISO() && styles.dateToggleActive]}
          onPress={() => setDate(todayISO())}
        >
          <Text style={[styles.dateToggleText, date === todayISO() && styles.dateToggleTextActive]}>
            Today (test)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateToggle, date === tomorrowISO() && styles.dateToggleActive]}
          onPress={() => setDate(tomorrowISO())}
        >
          <Text style={[styles.dateToggleText, date === tomorrowISO() && styles.dateToggleTextActive]}>
            Tomorrow
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status pill */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
          <Text style={styles.statusPillText}>{status.toUpperCase()}</Text>
        </View>
        {briefing ? (
          <Text style={styles.metaText}>
            {slides.length} slide{slides.length === 1 ? "" : "s"}
          </Text>
        ) : null}
      </View>

      {/* Generate / Regenerate */}
      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name={briefing ? "refresh" : "sparkle"} size={18} color="#ffffff" accentColor="#ffffff" />
            <Text style={styles.generateButtonText}>
              {briefing ? "Regenerate Briefing" : "Generate Briefing"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {briefing?.status === "failed" ? (
        <Text style={styles.errorText}>
          Generation failed previously. Try regenerating.
        </Text>
      ) : null}

      {!briefing && !generating ? (
        <Text style={styles.emptyText}>
          No briefing yet for tomorrow. Tap above to generate one.
        </Text>
      ) : null}

      {/* Slide cards */}
      {slides.map((slide, index) => {
        const isDirty = dirtyIndices.has(index);
        return (
          <View key={index} style={[styles.slideCard, isDirty && styles.slideCardDirty]}>
            <View style={styles.slideHeader}>
              <View style={styles.kindBadge}>
                <Text style={styles.kindBadgeText}>{slide.kind}</Text>
              </View>
              <Text style={styles.slideIndex}>#{index + 1}</Text>
              <View style={styles.slideActions}>
                <TouchableOpacity
                  onPress={() => moveSlide(index, -1)}
                  disabled={index === 0}
                  style={[
                    styles.iconButton,
                    index === 0 && styles.iconButtonDisabled,
                  ]}
                >
                  <Text style={styles.iconButtonText}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveSlide(index, 1)}
                  disabled={index === slides.length - 1}
                  style={[
                    styles.iconButton,
                    index === slides.length - 1 && styles.iconButtonDisabled,
                  ]}
                >
                  <Text style={styles.iconButtonText}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteSlide(index)}
                  style={styles.iconButton}
                >
                  <Text style={styles.deleteIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {slide.photo_url ? (
              <SlideThumbnail
                uri={slide.photo_url}
                onPress={() => openLightbox({ photoUrl: slide.photo_url! })}
              />
            ) : null}

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={slide.title}
              onChangeText={(v) => editField(index, "title", v)}
            />

            <Text style={styles.fieldLabel}>Body</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={slide.body}
              onChangeText={(v) => editField(index, "body", v)}
              multiline
            />

            <Text style={styles.fieldLabel}>Spoken (TTS)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={slide.tts_text}
              onChangeText={(v) => editField(index, "tts_text", v)}
              multiline
            />
          </View>
        );
      })}

      {/* Bottom actions */}
      {briefing ? (
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.saveButton, dirtyIndices.size === 0 && styles.disabled]}
            onPress={handleSave}
            disabled={dirtyIndices.size === 0 || saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Saving…" : "Save Changes"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveButton, !canApprove && styles.disabled]}
            onPress={handleApprove}
            disabled={!canApprove}
          >
            <Text style={styles.approveButtonText}>
              {briefing.status === "approved"
                ? "Approved"
                : briefing.status === "delivered"
                ? "Delivered"
                : "Approve"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!validation.ok && briefing ? (
        <Text style={styles.warnText}>{validation.reason}</Text>
      ) : null}
      {lightbox}
    </ScrollView>
  );
}

function SlideThumbnail({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  const handlePress = useTapToOpen(onPress);
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
      <Image source={{ uri }} style={styles.thumbnail} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 32,
    paddingTop: 80,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#999",
    marginBottom: 16,
  },
  dateToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  dateToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2a2a4a",
    borderWidth: 1,
    borderColor: "#444",
  },
  dateToggleActive: {
    backgroundColor: "#7c4dff",
    borderColor: "#7c4dff",
  },
  dateToggleText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  dateToggleTextActive: {
    color: "#fff",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  metaText: {
    color: "#999",
    fontSize: 13,
  },
  generateButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 12,
  },
  warnText: {
    color: "#ffb86b",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    textAlign: "center",
    marginVertical: 24,
  },
  slideCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  slideCardDirty: {
    borderLeftColor: "#ffb86b",
  },
  slideHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  kindBadge: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  kindBadgeText: {
    color: "#b388ff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  slideIndex: {
    color: "#666",
    fontSize: 12,
    flex: 1,
  },
  slideActions: {
    flexDirection: "row",
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  iconButtonDisabled: {
    opacity: 0.3,
  },
  iconButtonText: {
    color: "#b388ff",
    fontSize: 16,
  },
  deleteIcon: {
    color: "#ff6b6b",
    fontSize: 16,
  },
  thumbnail: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#1a1a2e",
  },
  fieldLabel: {
    color: "#999",
    fontSize: 12,
    marginBottom: 4,
    marginTop: 4,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#e0e0e0",
    marginBottom: 8,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#2a2a4a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#e0e0e0",
    fontSize: 16,
    fontWeight: "600",
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#4caf50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  approveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.4,
  },
});
