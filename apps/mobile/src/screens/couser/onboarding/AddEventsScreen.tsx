import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { supabase, embedAndStore } from "@memoria/core";
import { colors, radius } from "@memoria/core";
import { AnimatedEntrance } from "../../../motion/primitives";
import {
  FlowNav, FlowHeader, FocusField, FlowButton,
  SectionCard, SectionTitle, AddSubButton, TypeSegment, MUTE,
} from "../FlowLayout";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

type EventType = "one_time" | "recurring" | "routine";

interface EventEntry {
  title: string;
  description: string;
  event_date: string;
  event_type: EventType;
}

const TYPE_OPTIONS: { label: string; value: EventType }[] = [
  { label: "One time", value: "one_time" },
  { label: "Recurring", value: "recurring" },
  { label: "Routine", value: "routine" },
];

function typeLabel(t: EventType) {
  return TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export default function AddEventsScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("one_time");

  function addEvent() {
    if (!title.trim() || !eventDate.trim()) {
      Alert.alert("Please enter at least a title and date");
      return;
    }
    setEvents((e) => [
      ...e,
      {
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate.trim(),
        event_type: eventType,
      },
    ]);
    setTitle("");
    setEventDate("");
    setDescription("");
    setEventType("one_time");
  }

  async function handleFinish() {
    setLoading(true);
    try {
      if (events.length > 0) {
        const rows = events.map((e) => ({
          user_id: userId,
          title: e.title,
          description: e.description || null,
          event_date: e.event_date,
          event_type: e.event_type,
        }));

        const { data: inserted, error } = await supabase
          .from("events")
          .insert(rows)
          .select("id, title, description");
        if (error) throw error;

        (inserted || []).forEach(
          (row: { id: string; title: string; description: string | null }) => {
            const text = `${row.title} ${row.description ?? ""}`.trim();
            void embedAndStore("events", row.id, text);
          }
        );
      }

      navigation.navigate("CoUserHome");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FlowNav
        onBack={() => navigation.goBack()}
        onClose={() => navigation.navigate("CoUserHome")}
      />
      <AnimatedEntrance index={0}>
        <FlowHeader
          title="Events & Schedule"
          sub="Appointments, routines, and visits to come"
        />
      </AnimatedEntrance>

      {/* Added events list */}
      {events.length > 0 && (
        <View style={styles.eventList}>
          {events.map((e, i) => (
            <AnimatedEntrance key={e.title + i} index={i + 1}>
              <View style={styles.eventCard}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.eventDate}>{e.event_date}</Text>
                <Text style={styles.eventType}>{typeLabel(e.event_type)}</Text>
              </View>
            </AnimatedEntrance>
          ))}
        </View>
      )}

      {/* Add-event form card */}
      <AnimatedEntrance index={events.length + 2}>
        <SectionCard>
          <SectionTitle>
            {events.length === 0 ? "Add an event" : "Add another event"}
          </SectionTitle>

          <FocusField
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="e.g. Garden club"
          />
          <FocusField
            label="Date"
            value={eventDate}
            onChange={setEventDate}
            placeholder="e.g. Sat, Jun 6 · 10:00 AM"
          />
          <FocusField
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Any details about the event"
            multiline
          />

          <Text style={styles.typeLabel}>Type</Text>
          <TypeSegment
            value={eventType}
            options={TYPE_OPTIONS}
            onChange={setEventType}
          />

          <AddSubButton label="Add this event" icon="add" onPress={addEvent} />
        </SectionCard>
      </AnimatedEntrance>

      <AnimatedEntrance index={events.length + 4}>
        <FlowButton
          label={events.length === 0 ? "Skip & finish" : "Finish setup"}
          onPress={handleFinish}
          disabled={loading}
        />
      </AnimatedEntrance>
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
    paddingTop: 72,
    paddingBottom: 48,
  },
  eventList: {
    marginTop: 18,
    gap: 10,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.fg,
  },
  eventDate: {
    fontSize: 13.5,
    color: colors.primarySoft,
    marginTop: 4,
  },
  eventType: {
    fontSize: 12.5,
    color: MUTE,
    marginTop: 3,
    textTransform: "capitalize",
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginBottom: 7,
  },
});
