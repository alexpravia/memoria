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

interface Person {
  id: string;
  full_name: string;
  relationship: string;
  key_facts: string[];
  emotional_notes: string | null;
}

export default function ViewPeopleScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPeople();
  }, []);

  async function loadPeople() {
    if (!userId) return;
    const { data } = await supabase
      .from("people")
      .select("id, full_name, relationship, key_facts, emotional_notes")
      .eq("user_id", userId)
      .order("full_name");

    setPeople(data || []);
    setLoading(false);
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

      <Text style={styles.title}>People</Text>
      <Text style={styles.subtitle}>{people.length} {people.length === 1 ? "person" : "people"} saved</Text>

      {people.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No people added yet</Text>
        </View>
      ) : (
        people.map((p) => (
          <View key={p.id} style={styles.personCard}>
            <Text style={styles.personName}>{p.full_name}</Text>
            <Text style={styles.personRelation}>{p.relationship}</Text>
            {p.key_facts && p.key_facts.length > 0 && (
              <View style={styles.factsContainer}>
                {p.key_facts.map((fact, i) => (
                  <View key={i} style={styles.factChip}>
                    <Text style={styles.factChipText}>{fact}</Text>
                  </View>
                ))}
              </View>
            )}
            {p.emotional_notes ? (
              <Text style={styles.emotionalNotes}>{p.emotional_notes}</Text>
            ) : null}
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddPeople", { userId })}
      >
        <Text style={styles.addButtonText}>+ Add More People</Text>
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
  personCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  personName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  personRelation: {
    fontSize: 15,
    color: "#b388ff",
    marginTop: 4,
  },
  factsContainer: {
    marginTop: 10,
    gap: 6,
  },
  factChip: {
    backgroundColor: "#3a3a5a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  factChipText: {
    color: "#e0e0e0",
    fontSize: 14,
  },
  emotionalNotes: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
    fontStyle: "italic",
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
