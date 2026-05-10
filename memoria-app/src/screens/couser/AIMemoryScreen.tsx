import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import {
  listMemoriesForCoUser,
  updateMemoryStatus,
  deleteMemory,
  type AssistantMemory,
  type MemoryKind,
} from "../../lib/memory";

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

export default function AIMemoryScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

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
    load();
  }

  async function handleSuppressToggle(m: AssistantMemory) {
    const next = m.status === "suppressed" ? "active" : "suppressed";
    const res = await updateMemoryStatus(m.id, next);
    if (!res.ok) {
      Alert.alert("Error", res.error ?? "Failed to update.");
      return;
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
            load();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="ai-memory-screen"
    >
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

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

      {visible.length === 0 ? (
        <Text style={styles.emptyText}>
          {memories.length === 0
            ? "Memo hasn't noted anything yet."
            : "No memories match this filter."}
        </Text>
      ) : (
        visible.map((m) => {
          const isRecurring = m.kind === "recurring_question";
          const isPinned = m.status === "pinned";
          const isSuppressed = m.status === "suppressed";
          return (
            <View
              key={m.id}
              style={[
                styles.card,
                isRecurring && styles.cardRecurring,
                isPinned && styles.cardPinned,
                isSuppressed && styles.cardSuppressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.kindBadge,
                    isRecurring && styles.kindBadgeRecurring,
                  ]}
                >
                  {KIND_LABELS[m.kind]}
                </Text>
                <Text style={styles.statusBadge}>
                  {isPinned
                    ? "📌 Pinned"
                    : isSuppressed
                      ? "🚫 Suppressed"
                      : "Active"}
                </Text>
              </View>

              <Text style={styles.contentText}>{m.content}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.importance}>
                  {"●".repeat(m.importance)}
                  {"○".repeat(5 - m.importance)}
                </Text>
                <Text style={styles.created}>
                  {new Date(m.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handlePinToggle(m)}
                >
                  <Text style={styles.actionText}>
                    {isPinned ? "Unpin" : "📌 Pin"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleSuppressToggle(m)}
                >
                  <Text style={styles.actionText}>
                    {isSuppressed ? "Restore" : "🚫 Suppress"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => confirmDelete(m)}
                >
                  <Text style={[styles.actionText, styles.deleteAction]}>
                    🗑️ Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 40,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#999",
    marginBottom: 24,
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
    marginBottom: 24,
  },
  kindScrollWrap: {
    position: "relative",
  },
  arrowBtn: {
    position: "absolute",
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
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
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "600",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#2a2a4a",
    borderRadius: 20,
  },
  pillKind: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#2a2a4a",
    borderRadius: 20,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: "#7c4dff",
  },
  pillText: {
    color: "#b388ff",
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#ffffff",
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    textAlign: "center",
    marginVertical: 24,
  },
  card: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  cardRecurring: {
    borderLeftColor: "#ffb74d",
    backgroundColor: "#3a2f1a",
  },
  cardPinned: {
    borderLeftColor: "#ffd54f",
  },
  cardSuppressed: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kindBadge: {
    fontSize: 11,
    color: "#b388ff",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kindBadgeRecurring: {
    color: "#ffb74d",
  },
  statusBadge: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  contentText: {
    fontSize: 16,
    color: "#e0e0e0",
    lineHeight: 22,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  importance: {
    color: "#ffd54f",
    fontSize: 14,
    letterSpacing: 2,
  },
  created: {
    color: "#666",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    alignItems: "center",
  },
  actionText: {
    color: "#b388ff",
    fontSize: 13,
    fontWeight: "600",
  },
  deleteAction: {
    color: "#ff6b6b",
  },
});
