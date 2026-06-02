import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import * as Calendar from "expo-calendar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase, useAuth } from "@memoria/core";
import { colors, radius } from "@memoria/core";
import { SpringPressable } from "../../../motion/primitives";
import { ShimmerButton } from "../../../motion/ui";
import { FlowNav, FlowHeader, ObCheck, MUTE } from "../FlowLayout";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  notes: string;
  selected: boolean;
  alreadyImported: boolean;
  dayAbbrev: string;
}

function getDayAbbrev(dateStr: string): string {
  try {
    return new Date(dateStr)
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase()
      .slice(0, 3);
  } catch {
    return "---";
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function ImportCalendarScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "We need access to your calendar to import events. You can enable this in Settings."
      );
      setLoading(false);
      return;
    }

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    const calendarIds = calendars.map((c) => c.id);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    const calEvents = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );

    const { data: existingEvents } = await supabase
      .from("events")
      .select("title, event_date")
      .eq("user_id", userId);

    const existingKeys = new Set(
      (existingEvents || []).map(
        (e) => `${e.title.toLowerCase()}|${e.event_date}`
      )
    );

    const mapped: CalendarEvent[] = calEvents
      .filter((e) => e.title)
      .map((e) => {
        const key = `${(e.title || "").toLowerCase()}|${String(e.startDate)}`;
        return {
          id: e.id,
          title: e.title || "",
          startDate: String(e.startDate),
          endDate: String(e.endDate),
          notes: e.notes || "",
          selected: false,
          alreadyImported: existingKeys.has(key),
          dayAbbrev: getDayAbbrev(String(e.startDate)),
        };
      })
      .sort((a, b) => {
        if (a.alreadyImported !== b.alreadyImported)
          return a.alreadyImported ? 1 : -1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });

    setEvents(mapped);
    setLoading(false);
  }

  function toggleEvent(id: string) {
    setEvents((arr) =>
      arr.map((e) =>
        e.id === id && !e.alreadyImported ? { ...e, selected: !e.selected } : e
      )
    );
  }

  function selectAll() {
    const selectable = events.filter((e) => !e.alreadyImported);
    const allSelected =
      selectable.length > 0 && selectable.every((e) => e.selected);
    setEvents((arr) =>
      arr.map((e) => (e.alreadyImported ? e : { ...e, selected: !allSelected }))
    );
  }

  async function handleImport() {
    const selected = events.filter((e) => e.selected);
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const now = new Date();
      const rows = selected.map((e) => ({
        user_id: userId,
        title: e.title,
        description: e.notes || null,
        event_date: e.startDate,
        end_date: e.endDate || null,
        event_type: "one_time" as const,
        is_past: new Date(e.startDate) < now,
      }));

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;

      Alert.alert(
        "Imported!",
        `${selected.length} event${selected.length > 1 ? "s" : ""} imported.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = events.filter((e) => e.selected).length;
  const selectable = events.filter((e) => !e.alreadyImported);
  const allSelected =
    selectable.length > 0 && selectable.every((e) => e.selected);
  const now = new Date();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading calendar events…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
        <FlowNav
          onBack={() => navigation.goBack()}
          onClose={() => navigation.goBack()}
        />
        <FlowHeader
          title="Import Calendar"
          sub="Events from the last month and next three"
        />

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>{selectedCount} selected</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isPast = new Date(item.startDate) < now;
          return (
            <SpringPressable
              onPress={() => toggleEvent(item.id)}
              disabled={item.alreadyImported}
              style={[
                styles.eventRow,
                item.selected && styles.eventRowSelected,
                item.alreadyImported && styles.eventRowImported,
              ]}
            >
              {/* Day chip */}
              <View style={styles.dayChip}>
                <Text style={styles.dayChipText}>{item.dayAbbrev}</Text>
              </View>

              <View style={styles.eventInfo}>
                <Text
                  style={[
                    styles.eventTitle,
                    item.alreadyImported && styles.dimText,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.eventDate}>{formatDate(item.startDate)}</Text>
                {item.alreadyImported ? (
                  <Text style={styles.importedBadge}>Already imported</Text>
                ) : isPast ? (
                  <Text style={styles.pastBadge}>Past</Text>
                ) : null}
              </View>

              {!item.alreadyImported && <ObCheck on={!!item.selected} />}
            </SpringPressable>
          );
        }}
      />

      {/* Fixed import button */}
      {selectedCount > 0 && (
        <View style={styles.importWrap}>
          <ShimmerButton
            label={`Import ${selectedCount} event${selectedCount > 1 ? "s" : ""}`}
            onPress={handleImport}
            disabled={importing}
            hero
          />
        </View>
      )}
    </View>
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
  loadingText: {
    color: colors.fg,
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 4,
  },
  selectAllText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  countText: {
    color: MUTE,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  eventRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  eventRowSelected: {
    borderColor: colors.primary,
  },
  eventRowImported: {
    opacity: 0.5,
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayChipText: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16.5,
    fontWeight: "600",
    color: colors.fgStrong,
  },
  eventDate: {
    fontSize: 13,
    color: colors.primarySoft,
    marginTop: 3,
  },
  pastBadge: {
    fontSize: 12,
    color: MUTE,
    marginTop: 3,
    fontStyle: "italic",
  },
  importedBadge: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 3,
    fontStyle: "italic",
  },
  dimText: {
    color: MUTE,
  },
  importWrap: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
});
