import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  FlatList,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function AddLifeFactsScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [fact, setFact] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addFact() {
    if (!fact.trim()) return;
    setFacts([...facts, fact.trim()]);
    setFact("");
  }

  function removeFact(index: number) {
    setFacts(facts.filter((_, i) => i !== index));
  }

  async function handleNext() {
    if (facts.length === 0) {
      navigation.navigate("AddPeople", { userId });
      return;
    }

    setLoading(true);
    try {
      const rows = facts.map((f, i) => ({
        user_id: userId,
        fact: f,
        display_order: i,
      }));

      const { error } = await supabase.from("life_facts").insert(rows);
      if (error) throw error;

      navigation.navigate("AddPeople", { userId });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Life Facts</Text>
      <Text style={styles.subtitle}>
        Add important things about their life that they should be reminded of
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder='e.g., "You retired from teaching in 2015"'
          placeholderTextColor="#888"
          value={fact}
          onChangeText={setFact}
          onSubmitEditing={addFact}
        />
        <TouchableOpacity style={styles.addButton} onPress={addFact}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {facts.map((f, index) => (
        <View key={index} style={styles.factItem}>
          <Text style={styles.factText}>{f}</Text>
          <TouchableOpacity onPress={() => removeFact(index)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={styles.button}
        onPress={handleNext}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {facts.length === 0 ? "Skip" : "Next"}
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
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#7c4dff",
    width: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
  },
  factItem: {
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factText: {
    color: "#e0e0e0",
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  removeText: {
    color: "#ff6b6b",
    fontSize: 18,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
