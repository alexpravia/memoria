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

interface PersonEntry {
  full_name: string;
  relationship: string;
  key_facts: string[];
  emotional_notes: string;
}

export default function AddPeopleScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [people, setPeople] = useState<PersonEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Current person being added
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [keyFact, setKeyFact] = useState("");
  const [keyFacts, setKeyFacts] = useState<string[]>([]);
  const [emotionalNotes, setEmotionalNotes] = useState("");

  function addKeyFact() {
    if (!keyFact.trim()) return;
    setKeyFacts([...keyFacts, keyFact.trim()]);
    setKeyFact("");
  }

  function addPerson() {
    if (!name.trim() || !relationship.trim()) {
      Alert.alert("Please enter at least a name and relationship");
      return;
    }
    setPeople([
      ...people,
      {
        full_name: name.trim(),
        relationship: relationship.trim(),
        key_facts: keyFacts,
        emotional_notes: emotionalNotes.trim(),
      },
    ]);
    // Reset form
    setName("");
    setRelationship("");
    setKeyFact("");
    setKeyFacts([]);
    setEmotionalNotes("");
  }

  async function handleNext() {
    if (people.length === 0) {
      navigation.navigate("AddEvents", { userId });
      return;
    }

    setLoading(true);
    try {
      const rows = people.map((p) => ({
        user_id: userId,
        full_name: p.full_name,
        relationship: p.relationship,
        key_facts: p.key_facts,
        emotional_notes: p.emotional_notes || null,
      }));

      const { error } = await supabase.from("people").insert(rows);
      if (error) throw error;

      navigation.navigate("AddEvents", { userId });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Important People</Text>
      <Text style={styles.subtitle}>
        Add the people in their life they should know about
      </Text>

      {/* People already added */}
      {people.map((p, index) => (
        <View key={index} style={styles.personCard}>
          <Text style={styles.personName}>{p.full_name}</Text>
          <Text style={styles.personRelation}>{p.relationship}</Text>
        </View>
      ))}

      {/* Add person form */}
      <View style={styles.formSection}>
        <Text style={styles.formTitle}>
          {people.length === 0 ? "Add a person" : "Add another person"}
        </Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Maria"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Relationship *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Daughter"
          placeholderTextColor="#888"
          value={relationship}
          onChangeText={setRelationship}
        />

        <Text style={styles.label}>Key Facts</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
            placeholder="e.g., Lives in New York"
            placeholderTextColor="#888"
            value={keyFact}
            onChangeText={setKeyFact}
            onSubmitEditing={addKeyFact}
          />
          <TouchableOpacity style={styles.addButton} onPress={addKeyFact}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {keyFacts.map((f, i) => (
          <View key={i} style={styles.factChip}>
            <Text style={styles.factChipText}>{f}</Text>
          </View>
        ))}

        <Text style={[styles.label, { marginTop: 16 }]}>Emotional Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          placeholder="e.g., She loves talking about cooking with this person"
          placeholderTextColor="#888"
          value={emotionalNotes}
          onChangeText={setEmotionalNotes}
          multiline
        />

        <TouchableOpacity style={styles.addPersonButton} onPress={addPerson}>
          <Text style={styles.addPersonButtonText}>
            + Add This Person
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
        disabled={loading}
      >
        <Text style={styles.nextButtonText}>
          {people.length === 0 ? "Skip" : "Next"}
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
  personCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  personName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  personRelation: {
    fontSize: 15,
    color: "#b388ff",
    marginTop: 4,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: "#7c4dff",
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  factChip: {
    backgroundColor: "#3a3a5a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  factChipText: {
    color: "#e0e0e0",
    fontSize: 14,
  },
  addPersonButton: {
    backgroundColor: "#5e35b1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  addPersonButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  nextButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  nextButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
