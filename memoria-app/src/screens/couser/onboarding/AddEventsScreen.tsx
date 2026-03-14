import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

interface EventEntry {
  title: string;
  description: string;
  event_date: string;
  event_type: "one_time" | "recurring" | "routine";
}

export default function AddEventsScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<"one_time" | "recurring" | "routine">("one_time");

  function addEvent() {
    if (!title.trim() || !eventDate.trim()) {
      Alert.alert("Please enter at least a title and date");
      return;
    }
    setEvents([
      ...events,
      {
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate.trim(),
        event_type: eventType,
      },
    ]);
    setTitle("");
    setDescription("");
    setEventDate("");
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

        const { error } = await supabase.from("events").insert(rows);
        if (error) throw error;
      }

      navigation.navigate("CoUserHome");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  const typeOptions: { label: string; value: "one_time" | "recurring" | "routine" }[] = [
    { label: "One Time", value: "one_time" },
    { label: "Recurring", value: "recurring" },
    { label: "Routine", value: "routine" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("CoUserHome")}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Events & Schedule</Text>
      <Text style={styles.subtitle}>
        Add appointments, routines, and upcoming events
      </Text>

      {/* Events already added */}
      {events.map((e, index) => (
        <View key={index} style={styles.eventCard}>
          <Text style={styles.eventTitle}>{e.title}</Text>
          <Text style={styles.eventDate}>{e.event_date}</Text>
          <Text style={styles.eventType}>{e.event_type.replace("_", " ")}</Text>
        </View>
      ))}

      {/* Add event form */}
      <View style={styles.formSection}>
        <Text style={styles.formTitle}>
          {events.length === 0 ? "Add an event" : "Add another event"}
        </Text>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Doctor's appointment"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#888"
          value={eventDate}
          onChangeText={setEventDate}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: "top" }]}
          placeholder="Any details about the event"
          placeholderTextColor="#888"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {typeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.typeButton,
                eventType === opt.value && styles.typeButtonActive,
              ]}
              onPress={() => setEventType(opt.value)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  eventType === opt.value && styles.typeButtonTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addEventButton} onPress={addEvent}>
          <Text style={styles.addEventButtonText}>+ Add This Event</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.finishButton}
        onPress={handleFinish}
        disabled={loading}
      >
        <Text style={styles.finishButtonText}>
          {events.length === 0 ? "Skip & Finish" : "Finish Setup"}
        </Text>
      </TouchableOpacity>
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
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#e0e0e0",
    marginBottom: 24,
  },
  eventCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  eventDate: {
    fontSize: 14,
    color: "#b388ff",
    marginTop: 4,
  },
  eventType: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  formSection: {
    backgroundColor: "#22223a",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e0e0e0",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#b388ff",
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 14,
  },
  typeRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a4a",
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#7c4dff",
  },
  typeButtonText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  addEventButton: {
    backgroundColor: "#5e35b1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  addEventButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  finishButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  finishButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    fontWeight: "600",
  },
  exitText: {
    color: "#ff6b6b",
    fontSize: 20,
    fontWeight: "bold",
  },
});
