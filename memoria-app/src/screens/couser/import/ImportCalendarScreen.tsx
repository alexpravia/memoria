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
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

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

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendarIds = calendars.map((c) => c.id);

    // Get events from past month to 3 months ahead
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    const calEvents = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );

    const mapped: CalendarEvent[] = calEvents
      .filter((e) => e.title)
      .map((e) => ({
        id: e.id,
        title: e.title || "",
        startDate: String(e.startDate),
        endDate: String(e.endDate),
        notes: e.notes || "",
        selected: false,
      }))
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

    setEvents(mapped);
    setLoading(false);
  }

  function toggleEvent(id: string) {
    setEvents(
      events.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  }

  function selectAll() {
    const allSelected = events.every((e) => e.selected);
    setEvents(events.map((e) => ({ ...e, selected: !allSelected })));
  }

  async function handleImport() {
    const selected = events.filter((e) => e.selected);
    if (selected.length === 0) {
      Alert.alert("Please select at least one event to import");
      return;
    }

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
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setImporting(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const selectedCount = events.filter((e) => e.selected).length;
  const now = new Date();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
        <Text style={styles.loadingText}>Loading calendar events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Calendar</Text>
        <Text style={styles.subtitle}>
          Import events from the past month and upcoming 3 months
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {events.every((e) => e.selected) ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>{selectedCount} selected</Text>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isPast = new Date(item.startDate) < now;
          return (
            <TouchableOpacity
              style={[
                styles.eventItem,
                item.selected && styles.eventItemSelected,
              ]}
              onPress={() => toggleEvent(item.id)}
            >
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDate}>
                  {formatDate(item.startDate)}
                </Text>
                {isPast && <Text style={styles.pastBadge}>Past</Text>}
              </View>
              <View
                style={[
                  styles.checkbox,
                  item.selected && styles.checkboxChecked,
                ]}
              >
                {item.selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {selectedCount > 0 && (
        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>
              Import {selectedCount} Event{selectedCount > 1 ? "s" : ""}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  centered: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#e0e0e0",
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectAllText: {
    color: "#7c4dff",
    fontSize: 16,
    fontWeight: "600",
  },
  countText: {
    color: "#888",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 40,
  },
  eventItem: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventItemSelected: {
    borderWidth: 2,
    borderColor: "#7c4dff",
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  eventDate: {
    fontSize: 14,
    color: "#b388ff",
    marginTop: 4,
  },
  pastBadge: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    fontStyle: "italic",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  checkboxChecked: {
    backgroundColor: "#7c4dff",
    borderColor: "#7c4dff",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  importButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 12,
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },
  cancelText: {
    fontSize: 16,
    color: "#888",
  },
});
