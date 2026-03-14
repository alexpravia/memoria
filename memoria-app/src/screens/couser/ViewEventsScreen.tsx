import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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

  useEffect(() => {
    loadEvents();
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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Events</Text>
      <Text style={styles.subtitle}>{events.length} event{events.length !== 1 ? "s" : ""} saved</Text>

      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No events added yet</Text>
        </View>
      ) : (
        events.map((e) => (
          <View key={e.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{e.title}</Text>
              <Text style={styles.eventType}>
                {e.event_type.replace("_", " ")}
              </Text>
            </View>
            <Text style={styles.eventDate}>{formatDate(e.event_date)}</Text>
            {e.description ? (
              <Text style={styles.eventDescription}>{e.description}</Text>
            ) : null}
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddEvents", { userId })}
      >
        <Text style={styles.addButtonText}>+ Add More Events</Text>
      </TouchableOpacity>
    </ScrollView>
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
  content: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 60,
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
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 24,
  },
  emptyState: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
  eventCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  eventType: {
    fontSize: 12,
    color: "#b388ff",
    backgroundColor: "#3a3a5a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: "capitalize",
    overflow: "hidden",
    marginLeft: 8,
  },
  eventDate: {
    fontSize: 14,
    color: "#b388ff",
    marginTop: 6,
  },
  eventDescription: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
  addButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
});
