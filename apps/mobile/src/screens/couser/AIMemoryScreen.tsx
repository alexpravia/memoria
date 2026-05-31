import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@memoria/core";
import Icon from "../../components/Icon";
import { useIntensity } from "../../motion/IntensityContext";
import { colors, radius, type } from "@memoria/core";
import {
  listMemoriesForCoUser,
  updateMemoryStatus,
  deleteMemory,
  type AssistantMemory,
  type MemoryKind,
} from "@memoria/core";
import { logPreferenceSignal } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type StatusFilter = "all" | "active" | "pinned" | "suppressed";
type KindFilter = "all" | MemoryKind;

const KIND_LABELS: Record<MemoryKind, string> = {
  observation: "Observation",
  preference: "Preference",
  recurring_question: "Recurring Question",
  emotional_state: "Emotional State",
  factual_correction: "Factual Correction",
};

const KIND_FILTERS: Array<KindFilter> = [
  "all",
  "observation",
  "preference",
  "recurring_question",
  "emotional_state",
  "factual_correction",
];

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "pinned", "suppressed"];

const LEAVE_EASE = Easing.bezier(0.4, 0, 1, 0.6);

// ---------- MemoRow ----------
// A single learned-fact card. When `leaving` flips true the whole row
// animates OUT (opacity → 0, translateX → 40, vertical collapse) and then
// calls onLeft() so the parent can drop it from state / reload.
function MemoRow({
  m,
  index,
  leaving,
  onLeft,
  onPinToggle,
  onSuppressToggle,
  onDelete,
}: {
  m: AssistantMemory;
  index: number;
  leaving: boolean;
  onLeft: () => void;
  onPinToggle: () => void;
  onSuppressToggle: () => void;
  onDelete: () => void;
}) {
  const { on, speed } = useIntensity();
  const isPinned = m.status === "pinned";
  const isSuppressed = m.status === "suppressed";

  const opacity = useSharedValue(1);
  const tx = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!leaving) return;
    if (!on) {
      onLeft();
      return;
    }
    const dur = 460 / speed;
    opacity.value = withTiming(0, { duration: dur, easing: LEAVE_EASE });
    tx.value = withTiming(40, { duration: dur, easing: LEAVE_EASE });
    scale.value = withTiming(0.96, { duration: dur, easing: LEAVE_EASE }, (done) => {
      if (done) runOnJS(onLeft)();
    });
  }, [leaving, on, speed]);

  const leaveStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { scale: scale.value }],
  }));

  return (
    <AnimatedEntrance index={index} cardMode>
      <Animated.View
        style={[
          styles.card,
          isSuppressed && styles.cardSuppressed,
          leaveStyle,
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.kindLabel}>{KIND_LABELS[m.kind]}</Text>
          {isPinned || isSuppressed ? (
            <View style={styles.statusChip}>
              <Icon
                name={isPinned ? "pin" : "block"}
                size={13}
                color={colors.fgMuted}
              />
              <Text style={styles.statusChipText}>
                {isPinned ? "Pinned" : "Suppressed"}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.contentText}>{m.content}</Text>

        <View style={styles.actionRow}>
          <SpringPressable style={styles.actionBtn} onPress={onPinToggle}>
            <Icon name="pin" size={15} color={colors.primarySoft} />
            <Text style={styles.actionText}>{isPinned ? "Unpin" : "Pin"}</Text>
          </SpringPressable>
          <SpringPressable style={styles.actionBtn} onPress={onSuppressToggle}>
            <Icon name="block" size={15} color={colors.primarySoft} />
            <Text style={styles.actionText}>
              {isSuppressed ? "Restore" : "Suppress"}
            </Text>
          </SpringPressable>
          <SpringPressable style={styles.actionBtn} onPress={onDelete}>
            <Icon name="trash" size={15} color={colors.danger} />
            <Text style={[styles.actionText, styles.deleteAction]}>Delete</Text>
          </SpringPressable>
        </View>
      </Animated.View>
    </AnimatedEntrance>
  );
}

export default function AIMemoryScreen({ navigation }: Props) {
  const { userId, coUserId } = useAuth();
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  // Id of a row currently animating out before deletion.
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // Kind-row scroll affordance state
  const kindScrollRef = useRef<ScrollView>(null);
  const [kindOffsetX, setKindOffsetX] = useState(0);
  const [kindContentWidth, setKindContentWidth] = useState(0);
  const [kindLayoutWidth, setKindLayoutWidth] = useState(0);

  const handleKindScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setKindOffsetX(e.nativeEvent.contentOffset.x);
    },
    []
  );

  const scrollKindBy = useCallback(
    (delta: number) => {
      const maxX = Math.max(0, kindContentWidth - kindLayoutWidth);
      const nextX = Math.max(0, Math.min(maxX, kindOffsetX + delta));
      kindScrollRef.current?.scrollTo({ x: nextX, animated: true });
    },
    [kindOffsetX, kindContentWidth, kindLayoutWidth]
  );

  const showLeftArrow = kindOffsetX > 8;
  const showRightArrow =
    kindContentWidth > 0 &&
    kindLayoutWidth > 0 &&
    kindOffsetX + kindLayoutWidth < kindContentWidth - 8;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const rows = await listMemoriesForCoUser(userId);
    setMemories(rows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on focus — mirrors the pattern in ViewPeopleScreen.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const visible = memories.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (kindFilter !== "all" && m.kind !== kindFilter) return false;
    return true;
  });

  async function handlePinToggle(m: AssistantMemory) {
    const next = m.status === "pinned" ? "active" : "pinned";
    const res = await updateMemoryStatus(m.id, next);
    if (!res.ok) {
      Alert.alert("Error", res.error ?? "Failed to update.");
      return;
    }
    if (userId) {
      logPreferenceSignal({
        userId,
        coUserId,
        signalType: next === "pinned" ? "memory_pinned" : "memory_unpinned",
        referenceId: m.id,
        content: m.content,
        metadata: { kind: m.kind, importance: m.importance, previousStatus: m.status },
      });
    }
    load();
  }

  async function handleSuppressToggle(m: AssistantMemory) {
    const next = m.status === "suppressed" ? "active" : "suppressed";
    const res = await updateMemoryStatus(m.id, next);
    if (!res.ok) {
      Alert.alert("Error", res.error ?? "Failed to update.");
      return;
    }
    if (userId) {
      logPreferenceSignal({
        userId,
        coUserId,
        signalType: next === "suppressed" ? "memory_suppressed" : "memory_restored",
        referenceId: m.id,
        content: m.content,
        metadata: { kind: m.kind, importance: m.importance, previousStatus: m.status },
      });
    }
    load();
  }

  function confirmDelete(m: AssistantMemory) {
    Alert.alert(
      "Delete memory?",
      "This permanently removes Memo's memory of this. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await deleteMemory(m.id);
            if (!res.ok) {
              Alert.alert("Error", res.error ?? "Failed to delete.");
              return;
            }
            // Capture m.content here — the row is gone after deleteMemory.
            if (userId) {
              logPreferenceSignal({
                userId,
                coUserId,
                signalType: "memory_deleted",
                referenceId: m.id,
                content: m.content,
                metadata: { kind: m.kind, importance: m.importance, status: m.status },
              });
            }
            // Animate the row out, then reload once it has collapsed.
            setLeavingId(m.id);
          },
        },
      ]
    );
  }

  // Called by the leaving row once its exit animation completes.
  const handleRowLeft = useCallback(() => {
    setLeavingId(null);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Gathering Memo's notes…" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="ai-memory-screen"
    >
      <AnimatedEntrance index={0}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Helper dashboard</Text>
        <Text style={styles.title}>Memo's Notes</Text>
        <Text style={styles.subtitle}>
          Memo's memories and notes about your loved one.
        </Text>

        {/* Status filter pills */}
        <View style={styles.pillRow}>
          {STATUS_FILTERS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, statusFilter === s && styles.pillActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text
                style={[
                  styles.pillText,
                  statusFilter === s && styles.pillTextActive,
                ]}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Kind filter pills (compact second row, with scroll affordances) */}
        <View style={styles.kindScrollWrap}>
          <ScrollView
            ref={kindScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRowKind}
            onScroll={handleKindScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(w) => setKindContentWidth(w)}
            onLayout={(e) => setKindLayoutWidth(e.nativeEvent.layout.width)}
          >
            {KIND_FILTERS.map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.pillKind, kindFilter === k && styles.pillActive]}
                onPress={() => setKindFilter(k)}
              >
                <Text
                  style={[
                    styles.pillText,
                    kindFilter === k && styles.pillTextActive,
                  ]}
                >
                  {k === "all" ? "All kinds" : KIND_LABELS[k as MemoryKind]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showLeftArrow && (
            <TouchableOpacity
              style={[styles.arrowBtn, styles.arrowLeft]}
              onPress={() => scrollKindBy(-120)}
              accessibilityLabel="Scroll filters left"
            >
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          )}
          {showRightArrow && (
            <TouchableOpacity
              style={[styles.arrowBtn, styles.arrowRight]}
              onPress={() => scrollKindBy(120)}
              accessibilityLabel="Scroll filters right"
            >
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </AnimatedEntrance>

      {visible.length === 0 ? (
        <AnimatedEntrance index={1}>
          <AliveEmptyState
            drawCheck
            message="All caught up"
            caption={
              memories.length === 0
                ? "Memo hasn't noted anything yet."
                : "No notes match this filter."
            }
          />
        </AnimatedEntrance>
      ) : (
        visible.map((m, index) => (
          <MemoRow
            key={m.id}
            m={m}
            index={index}
            leaving={leavingId === m.id}
            onLeft={handleRowLeft}
            onPinToggle={() => handlePinToggle(m)}
            onSuppressToggle={() => handleSuppressToggle(m)}
            onDelete={() => confirmDelete(m)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: type.base,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: type.sm,
    color: colors.primarySoft,
    fontWeight: type.weightMedium,
    marginBottom: 4,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: type.sm,
    color: colors.fgMuted,
    marginBottom: 18,
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  pillRowKind: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  kindScrollWrap: {
    position: "relative",
  },
  arrowBtn: {
    position: "absolute",
    top: 4,
    width: 28,
    height: 28,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(26,26,46,0.85)",
    zIndex: 5,
  },
  arrowLeft: {
    left: 0,
  },
  arrowRight: {
    right: 0,
  },
  arrowText: {
    color: colors.fgStrong,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: type.weightMedium,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
  },
  pillKind: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    color: colors.primarySoft,
    fontSize: type.xs,
    fontWeight: type.weightMedium,
  },
  pillTextActive: {
    color: colors.fgStrong,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
  },
  cardSuppressed: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kindLabel: {
    fontSize: type.xxs,
    color: colors.primarySoft,
    fontWeight: type.weightBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  statusChipText: {
    fontSize: type.xs,
    color: colors.fgMuted,
    fontStyle: "italic" as const,
  },
  contentText: {
    fontSize: type.base,
    color: colors.fg,
    lineHeight: 23,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceSunk,
    borderRadius: 8,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  actionText: {
    color: colors.primarySoft,
    fontSize: type.xs,
    fontWeight: type.weightMedium,
  },
  deleteAction: {
    color: colors.danger,
  },
});
