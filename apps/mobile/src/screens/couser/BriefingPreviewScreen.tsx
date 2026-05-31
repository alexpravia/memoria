// Co-user briefing preview & approval screen (Phase E).
//
// Lets the co-user generate, review, edit, reorder, and approve the
// next morning's AI briefing before it ships to the user. Visual style
// follows the design-handoff PreviewScreen prototype (memoria-forms.jsx):
// a shimmer "Generate" button, a breathing flower while assembling,
// shimmer placeholder bars while loading, and slides revealed one-by-one
// as numbered rows with a green check.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import { useIntensity } from "../../motion/IntensityContext";
import { Logo } from "../../components/Logo";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@memoria/core";
import {
  generateBriefing,
  getBriefingForDate,
  reorderSlides,
  resolveSlidePhotos,
  updateSlide,
  validateBriefing,
  type Briefing,
  type BriefingSlide,
} from "@memoria/core";
import { logPreferenceSignal } from "@memoria/core";
// logPreferenceSignal is retained for briefing_regenerated and briefing_slide_* signals.
import { usePhotoLightbox, useTapToOpen } from "../../components/usePhotoLightbox";
import Icon from "../../components/Icon";
import { colors, radius, type as typeScale } from "@memoria/core";

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

// Status pill fill colors. Draft uses the brand purple; approved/delivered/
// failed map to the design-handoff status palette.
const STATUS_COLORS: Record<string, string> = {
  draft: colors.primary,
  approved: colors.success,
  delivered: colors.info,
  failed: colors.danger,
  none: colors.surfaceRaised,
};

// A small breathing forget-me-not used inside the Generate button while
// the briefing assembles. Mirrors the prototype's m-breathe glyph.
function BreathingLogo({ size = 22 }: { size?: number }) {
  const { on, speed } = useIntensity();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!on) {
      scale.value = 1;
      return;
    }
    const dur = 1400 / Math.max(speed, 0.5);
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(scale);
  }, [on, speed]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={aStyle}>
      <Logo size={size} />
    </Animated.View>
  );
}

// Shimmer placeholder bar shown while a briefing loads. The bar sweeps a
// soft lavender highlight across a sunk track (prototype ShimmerBar).
function ShimmerBar({ width }: { width: number | `${number}%` }) {
  const { on, speed } = useIntensity();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!on) {
      x.value = 0;
      return;
    }
    const dur = 1400 / Math.max(speed, 0.5);
    x.value = withRepeat(withTiming(1.8, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => cancelAnimation(x);
  }, [on, speed]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${x.value * 100}%` }, { skewX: "-12deg" }],
  }));

  return (
    <View style={[styles.shimmerBar, { width }]}>
      {on ? (
        <Animated.View style={[styles.shimmerBarSweep, sweepStyle]} pointerEvents="none" />
      ) : null}
    </View>
  );
}

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


  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading briefing…" />
      </View>
    );
  }

  const status = briefing?.status ?? "none";
  const statusColor = STATUS_COLORS[status] ?? colors.surfaceRaised;
  const validation = briefing ? validateBriefing(slides) : { ok: false, reason: "no briefing" };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backRow}
          accessibilityLabel="Go back"
        >
          <Icon name="back" size={20} color={colors.primarySoft} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Briefing Preview</Text>
        <Text style={styles.subtitle}>{formatDate(date)}</Text>

        {/* Date toggle — Today is for testing now; Tomorrow is the real morning briefing */}
        <View style={styles.dateToggleRow}>
          <SpringPressable
            onPress={() => setDate(todayISO())}
            style={[styles.dateToggle, date === todayISO() && styles.dateToggleActive]}
          >
            <Text style={[styles.dateToggleText, date === todayISO() && styles.dateToggleTextActive]}>
              Today (test)
            </Text>
          </SpringPressable>
          <SpringPressable
            onPress={() => setDate(tomorrowISO())}
            style={[styles.dateToggle, date === tomorrowISO() && styles.dateToggleActive]}
          >
            <Text style={[styles.dateToggleText, date === tomorrowISO() && styles.dateToggleTextActive]}>
              Tomorrow
            </Text>
          </SpringPressable>
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
      </AnimatedEntrance>

      {/* Generate / Regenerate */}
      <AnimatedEntrance index={1}>
        <ShimmerButton
          hero
          disabled={generating}
          onPress={handleGenerate}
          style={styles.generateButton}
        >
          <View style={styles.generateInner}>
            {generating ? (
              <BreathingLogo size={22} />
            ) : (
              <Icon
                name={briefing ? "refresh" : "sparkle"}
                size={20}
                color="#ffffff"
                accentColor="#ffffff"
              />
            )}
            <Text style={styles.generateButtonText}>
              {generating
                ? "Assembling…"
                : briefing
                ? "Regenerate"
                : "Generate now"}
            </Text>
          </View>
        </ShimmerButton>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {briefing?.status === "failed" ? (
          <Text style={styles.errorText}>
            Generation failed previously. Try regenerating.
          </Text>
        ) : null}
      </AnimatedEntrance>

      {/* Idle / empty card — shown when no briefing exists yet for this date */}
      {!briefing && !generating ? (
        <AnimatedEntrance index={2} cardMode>
          <View style={styles.idleCard}>
            <AliveEmptyState
              message="No briefing yet for this date"
              caption="Memo generates the briefing automatically at 2 AM. You can also generate one now using the button above."
            />
          </View>
        </AnimatedEntrance>
      ) : null}

      {/* Loading placeholder — shimmer bars while assembling */}
      {generating ? (
        <AnimatedEntrance index={2} cardMode>
          <View style={styles.loadingCard}>
            <ShimmerBar width="70%" />
            <ShimmerBar width="92%" />
            <ShimmerBar width="84%" />
            <ShimmerBar width="60%" />
          </View>
        </AnimatedEntrance>
      ) : null}

      {/* Slide cards — each is an editable, reorderable, removable card,
          revealed one-by-one with a numbered chip + green check. */}
      {slides.length > 0 ? (
        <AnimatedEntrance index={2} cardMode>
          <Text style={styles.readyLabel}>
            {slides.length} card{slides.length === 1 ? "" : "s"} ready
          </Text>
        </AnimatedEntrance>
      ) : null}

      {slides.map((slide, index) => {
        const isDirty = dirtyIndices.has(index);
        return (
          <AnimatedEntrance key={index} index={index + 3} cardMode>
            <View style={[styles.slideCard, isDirty && styles.slideCardDirty]}>
              <View style={styles.slideHeader}>
                <View style={styles.numberChip}>
                  <Text style={styles.numberChipText}>{index + 1}</Text>
                </View>
                <View style={styles.kindBadge}>
                  <Text style={styles.kindBadgeText}>{slide.kind}</Text>
                </View>
                <Icon name="check" size={18} color={colors.success} />
                <View style={styles.slideActions}>
                  <SpringPressable
                    onPress={() => moveSlide(index, -1)}
                    disabled={index === 0}
                    style={[styles.iconButton, index === 0 && styles.iconButtonDisabled]}
                  >
                    <Icon name="back" size={16} color={colors.primarySoft} />
                  </SpringPressable>
                  <SpringPressable
                    onPress={() => moveSlide(index, 1)}
                    disabled={index === slides.length - 1}
                    style={[
                      styles.iconButton,
                      index === slides.length - 1 && styles.iconButtonDisabled,
                    ]}
                  >
                    <Icon name="forward" size={16} color={colors.primarySoft} />
                  </SpringPressable>
                  <SpringPressable
                    onPress={() => deleteSlide(index)}
                    style={styles.iconButton}
                  >
                    <Icon name="close" size={16} color={colors.danger} />
                  </SpringPressable>
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
                placeholderTextColor={colors.fgMuted}
                onChangeText={(v) => editField(index, "title", v)}
              />

              <Text style={styles.fieldLabel}>Body</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={slide.body}
                placeholderTextColor={colors.fgMuted}
                onChangeText={(v) => editField(index, "body", v)}
                multiline
              />

              <Text style={styles.fieldLabel}>Spoken (TTS)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={slide.tts_text}
                placeholderTextColor={colors.fgMuted}
                onChangeText={(v) => editField(index, "tts_text", v)}
                multiline
              />
            </View>
          </AnimatedEntrance>
        );
      })}

      {/* Bottom actions — save edits only; no approval required */}
      {briefing && dirtyIndices.size > 0 ? (
        <AnimatedEntrance index={slides.length + 3} cardMode>
          <SpringPressable
            disabled={saving}
            onPress={handleSave}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Saving…" : "Save Changes"}
            </Text>
          </SpringPressable>
          {!validation.ok ? (
            <Text style={styles.warnText}>{validation.reason}</Text>
          ) : null}
        </AnimatedEntrance>
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
    backgroundColor: colors.bg,
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
    backgroundColor: colors.bg,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: typeScale.base,
  },
  title: {
    fontSize: typeScale.title,
    fontWeight: typeScale.weightBold,
    color: colors.primarySoft,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typeScale.base,
    color: colors.fgMuted,
    marginBottom: 18,
  },
  dateToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  dateToggle: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  dateToggleActive: {
    backgroundColor: colors.primary,
  },
  dateToggleText: {
    color: colors.fgMuted,
    fontSize: typeScale.xs,
    fontWeight: typeScale.weightMedium,
  },
  dateToggleTextActive: {
    color: colors.fgStrong,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.sm,
    marginRight: 12,
  },
  statusPillText: {
    color: colors.fgStrong,
    fontSize: typeScale.xxs,
    fontWeight: typeScale.weightBold,
    letterSpacing: 0.6,
  },
  metaText: {
    color: colors.fgMuted,
    fontSize: typeScale.xs,
  },
  generateButton: {
    marginBottom: 8,
  },
  generateInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  generateButtonText: {
    color: colors.fgStrong,
    fontSize: typeScale.lg,
    fontWeight: typeScale.weightMedium,
  },
  errorText: {
    color: colors.danger,
    fontSize: typeScale.sm,
    marginTop: 12,
  },
  warnText: {
    color: colors.primarySoft,
    fontSize: typeScale.xs,
    marginTop: 12,
    textAlign: "center",
  },
  idleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 18,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginTop: 18,
  },
  shimmerBar: {
    position: "relative",
    overflow: "hidden",
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceSunk,
    marginBottom: 14,
  },
  shimmerBarSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: colors.primarySoft + "33",
  },
  readyLabel: {
    fontSize: typeScale.xs,
    fontWeight: typeScale.weightBold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginTop: 20,
    marginBottom: 12,
  },
  slideCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  slideCardDirty: {
    borderLeftColor: colors.primarySoft,
  },
  slideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  numberChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  numberChipText: {
    color: colors.primarySoft,
    fontSize: typeScale.xs,
    fontWeight: typeScale.weightBold,
  },
  kindBadge: {
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  kindBadgeText: {
    color: colors.primarySoft,
    fontSize: typeScale.xxs,
    fontWeight: typeScale.weightBold,
    textTransform: "uppercase",
  },
  slideActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 2,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  iconButtonDisabled: {
    opacity: 0.3,
  },
  thumbnail: {
    width: "100%",
    height: 140,
    borderRadius: radius.sm,
    marginBottom: 12,
    backgroundColor: colors.bg,
  },
  fieldLabel: {
    color: colors.primarySoft,
    fontSize: typeScale.xxs,
    fontWeight: typeScale.weightBold,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: typeScale.base,
    color: colors.fgStrong,
    marginBottom: 8,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  saveButtonText: {
    color: colors.fg,
    fontSize: typeScale.lg,
    fontWeight: typeScale.weightMedium,
  },
  disabled: {
    opacity: 0.4,
  },
});
