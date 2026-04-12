import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
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

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadPeople();
    });

    return unsubscribe;
  }, [navigation, userId]);

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

  function confirmDelete(person: Person) {
    Alert.alert(
      `Delete ${person.full_name}?`,
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePerson(person.id),
        },
      ]
    );
  }

  async function deletePerson(personId: string) {
    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", personId);

    if (error) {
      Alert.alert("Error", "Failed to delete. Please try again.");
      return;
    }

    setPeople((prev) => prev.filter((p) => p.id !== personId));
  }

  if (loading) {
    return (
      <View testID="view-people-loading" style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <ScrollView testID="view-people-screen" style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          testID="people-back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back from people list"
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title} testID="people-title">People</Text>
      <Text style={styles.subtitle} testID="people-subtitle">
        {people.length} {people.length === 1 ? "person" : "people"} saved
      </Text>

      {people.length === 0 ? (
        <View testID="people-empty-state" style={styles.emptyState}>
          <Text style={styles.emptyText}>No people added yet</Text>
        </View>
      ) : (
        people.map((p, index) => (
          <View key={p.id} testID={`person-card-${index}`} style={styles.personCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.personName}>{p.full_name}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  testID={`edit-person-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${p.full_name}`}
                  onPress={() => navigation.navigate("EditPerson", { personId: p.id })}
                  style={styles.editButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`delete-person-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${p.full_name}`}
                  onPress={() => confirmDelete(p)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
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
        testID="people-add-more"
        accessibilityRole="button"
        accessibilityLabel="Add more people"
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#3a3a5a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  editText: {
    color: "#e0e0e0",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    color: "#ff5252",
    fontSize: 14,
    fontWeight: "600",
  },
  personName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
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
