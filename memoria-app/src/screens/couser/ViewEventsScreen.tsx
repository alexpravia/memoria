import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import Icon from "../../components/Icon";
import { colors, radius, type } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
}

export default function ViewEventsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
    loadUserName();
  }, []);

  async function loadEvents() {
    if (!userId) return;
    const { data } = await supabase
      .from("events")
      .select("id, title, description, event_date, event_type")
      .eq("user_id", userId)
      .order("event_date", { ascending: false });

    setEvents(data || []);
    setLoading(false);
  }

  // Lightweight, guarded name lookup for the header subtitle. Never affects the
  // events flow and silently falls back if the column/row is unavailable.
  async function loadUserName() {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      const name = (data as { name?: string } | null)?.name;
      if (name) setUserName(name);
    } catch {
      // ignore — subtitle gracefully degrades
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Three-letter uppercase weekday node label (TUE / THU / …) from a real date.
  function weekdayAbbrev(dateStr: string) {
    const d = new Date(dateStr);
    return d
      .toLocaleDateString("en-US", { weekday: "short" })
      .slice(0, 3)
      .toUpperCase();
  }

  // Index of the soonest upcoming event (today or later). That node glows purple.
  function soonestUpcomingId(): string | null {
    const now = Date.now();
    let bestId: string | null = null;
    let bestDelta = Infinity;
    for (const e of events) {
      const t = new Date(e.event_date).getTime();
      if (isNaN(t)) continue;
      const delta = t - now;
      if (delta >= -86400000 && delta < bestDelta) {
        bestDelta = delta;
        bestId = e.id;
      }
    }
    return bestId;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading events…" />
      </View>
    );
  }

  const soonId = soonestUpcomingId();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <View style={styles.headerRow}>
          <SpringPressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="back" size={22} color={colors.primarySoft} />
          </SpringPressable>
        </View>
        <Text style={styles.title}>Events</Text>
        <Text style={styles.subtitle}>
          What's coming up{userName ? ` for ${userName}` : ""}
        </Text>
      </AnimatedEntrance>

      <AnimatedEntrance index={1}>
        <ShimmerButton
          icon="add"
          label="Add an event"
          onPress={() => navigation.navigate("AddEvents", { userId })}
          style={styles.addButton}
        />
      </AnimatedEntrance>

      {events.length === 0 ? (
        <AnimatedEntrance index={2}>
          <AliveEmptyState
            message="No events added yet"
            caption="Add birthdays, anniversaries, and meaningful moments."
          />
        </AnimatedEntrance>
      ) : (
        <View style={styles.timeline}>
          {events.map((e, index) => {
            const isSoon = e.id === soonId;
            const isLast = index === events.length - 1;
            return (
              <AnimatedEntrance key={e.id} index={index + 2} cardMode>
                <View style={styles.row}>
                  <View style={styles.nodeColumn}>
                    <View
                      style={[
                        styles.node,
                        isSoon ? styles.nodeSoon : styles.nodeRest,
                      ]}
                    >
                      <Text
                        style={[
                          styles.nodeText,
                          isSoon ? styles.nodeTextSoon : styles.nodeTextRest,
                        ]}
                      >
                        {weekdayAbbrev(e.event_date)}
                      </Text>
                    </View>
                    {!isLast ? <View style={styles.connector} /> : null}
                  </View>

                  <SpringPressable
                    cardMode
                    onPress={() =>
                      navigation.navigate("AddEvents", { userId, eventId: e.id })
                    }
                    style={styles.cardWrap}
                  >
                    <View style={styles.eventCard}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      <Text style={styles.eventSub}>{formatDate(e.event_date)}</Text>
                      {e.description ? (
                        <Text style={styles.eventDescription}>{e.description}</Text>
                      ) : null}
                    </View>
                  </SpringPressable>
                </View>
              </AnimatedEntrance>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: type.sm,
    color: colors.fgMuted,
    marginBottom: 18,
  },
  addButton: {
    marginBottom: 22,
  },
  timeline: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
  },
  nodeColumn: {
    width: 46,
    alignItems: "center",
  },
  node: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeSoon: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  nodeRest: {
    backgroundColor: colors.surfaceSunk,
  },
  nodeText: {
    fontSize: 12,
    fontWeight: type.weightBold,
    letterSpacing: 0.5,
  },
  nodeTextSoon: {
    color: colors.fgStrong,
  },
  nodeTextRest: {
    color: colors.primarySoft,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    marginTop: 2,
    marginBottom: 2,
  },
  cardWrap: {
    flex: 1,
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eventTitle: {
    fontSize: type.md,
    fontWeight: type.weightMedium,
    color: colors.fg,
  },
  eventSub: {
    fontSize: type.xs,
    color: colors.fgMuted,
    marginTop: 3,
  },
  eventDescription: {
    fontSize: type.sm,
    color: colors.fgMuted,
    marginTop: 8,
  },
});
