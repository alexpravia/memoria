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

interface LifeFact {
  id: string;
  fact: string;
  display_order: number;
}

export default function ViewLifeFactsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [facts, setFacts] = useState<LifeFact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFacts();
  }, []);

  async function loadFacts() {
    if (!userId) return;
    const { data } = await supabase
      .from("life_facts")
      .select("id, fact, display_order")
      .eq("user_id", userId)
      .order("display_order");

    setFacts(data || []);
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

      <Text style={styles.title}>Life Facts</Text>
      <Text style={styles.subtitle}>{facts.length} fact{facts.length !== 1 ? "s" : ""} saved</Text>

      {facts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No life facts added yet</Text>
        </View>
      ) : (
        facts.map((f, index) => (
          <View key={f.id} style={styles.factCard}>
            <Text style={styles.factNumber}>{index + 1}</Text>
            <Text style={styles.factText}>{f.fact}</Text>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddLifeFacts", { userId })}
      >
        <Text style={styles.addButtonText}>+ Add More Life Facts</Text>
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
  factCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  factNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7c4dff",
    marginRight: 14,
    minWidth: 24,
  },
  factText: {
    fontSize: 16,
    color: "#e0e0e0",
    flex: 1,
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
