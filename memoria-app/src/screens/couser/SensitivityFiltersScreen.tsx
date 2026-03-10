import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { SensitivityFilter, Person } from "../../types";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type FilterType = "person" | "topic" | "time_period";

export default function SensitivityFiltersScreen({ navigation }: Props) {
  const { userId, coUserId } = useAuth();
  const [filters, setFilters] = useState<SensitivityFilter[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // New filter form state
  const [adding, setAdding] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("topic");
  const [filterValue, setFilterValue] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!userId) return;

    const { data: filtersData } = await supabase
      .from("sensitivity_filters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filtersData) setFilters(filtersData);

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userId);

    if (peopleData) setPeople(peopleData);

    setLoading(false);
  }

  async function addFilter() {
    if (!userId) return;

    if (filterType === "person" && !selectedPersonId) {
      Alert.alert("Select a person", "Choose which person to filter out.");
      return;
    }

    if (filterType === "topic" && !filterValue.trim()) {
      Alert.alert("Enter a topic", "Describe the topic to avoid.");
      return;
    }

    if (filterType === "time_period" && (!startDate.trim() || !endDate.trim())) {
      Alert.alert("Enter dates", "Provide both a start and end date (YYYY-MM-DD).");
      return;
    }

    let value = filterValue.trim();
    if (filterType === "person") {
      const person = people.find((p) => p.id === selectedPersonId);
      value = person ? person.full_name : "Unknown";
    }
    if (filterType === "time_period") {
      value = `${startDate.trim()} to ${endDate.trim()}`;
    }

    const { error } = await supabase.from("sensitivity_filters").insert({
      user_id: userId,
      filter_type: filterType,
      filter_value: value,
      person_id: filterType === "person" ? selectedPersonId : null,
      start_date: filterType === "time_period" ? startDate.trim() : null,
      end_date: filterType === "time_period" ? endDate.trim() : null,
      notes: notes.trim() || null,
      created_by: coUserId,
    });

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    // Reset form and reload
    setAdding(false);
    setFilterValue("");
    setSelectedPersonId(null);
    setStartDate("");
    setEndDate("");
    setNotes("");
    loadData();
  }

  async function deleteFilter(id: string) {
    Alert.alert("Remove Filter", "Are you sure you want to remove this filter?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("sensitivity_filters").delete().eq("id", id);
          loadData();
        },
      },
    ]);
  }

  function getFilterIcon(type: FilterType) {
    switch (type) {
      case "person":
        return "👤";
      case "topic":
        return "🚫";
      case "time_period":
        return "📅";
    }
  }

  function getFilterLabel(type: FilterType) {
    switch (type) {
      case "person":
        return "Person";
      case "topic":
        return "Topic";
      case "time_period":
        return "Time Period";
    }
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
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Sensitivity Filters</Text>
      <Text style={styles.subtitle}>
        Set boundaries for what the AI can show or mention. These apply everywhere — briefings, conversations, and reminders.
      </Text>

      {/* Existing filters */}
      {filters.length === 0 && !adding && (
        <Text style={styles.emptyText}>No filters set yet. Tap below to add one.</Text>
      )}

      {filters.map((filter) => (
        <View key={filter.id} style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterIcon}>{getFilterIcon(filter.filter_type as FilterType)}</Text>
            <View style={styles.filterInfo}>
              <Text style={styles.filterType}>{getFilterLabel(filter.filter_type as FilterType)}</Text>
              <Text style={styles.filterValue}>{filter.filter_value}</Text>
              {filter.notes && <Text style={styles.filterNotes}>{filter.notes}</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={() => deleteFilter(filter.id)}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add filter form */}
      {adding ? (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>New Filter</Text>

          {/* Type selector */}
          <View style={styles.typeRow}>
            {(["topic", "person", "time_period"] as FilterType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, filterType === type && styles.typeButtonActive]}
                onPress={() => {
                  setFilterType(type);
                  setFilterValue("");
                  setSelectedPersonId(null);
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <Text style={[styles.typeButtonText, filterType === type && styles.typeButtonTextActive]}>
                  {getFilterIcon(type)} {getFilterLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Type-specific input */}
          {filterType === "topic" && (
            <TextInput
              style={styles.input}
              placeholder="e.g., the hospital, Uncle Robert"
              placeholderTextColor="#666"
              value={filterValue}
              onChangeText={setFilterValue}
            />
          )}

          {filterType === "person" && (
            <View>
              {people.length === 0 ? (
                <Text style={styles.emptyText}>No people added yet. Add people first.</Text>
              ) : (
                people.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    style={[
                      styles.personOption,
                      selectedPersonId === person.id && styles.personOptionActive,
                    ]}
                    onPress={() => setSelectedPersonId(person.id)}
                  >
                    <Text style={styles.personOptionText}>
                      {person.full_name} — {person.relationship}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {filterType === "time_period" && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Start date (YYYY-MM-DD)"
                placeholderTextColor="#666"
                value={startDate}
                onChangeText={setStartDate}
              />
              <TextInput
                style={styles.input}
                placeholder="End date (YYYY-MM-DD)"
                placeholderTextColor="#666"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          )}

          {/* Notes */}
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Why? (optional — for your reference)"
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {/* Actions */}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setAdding(false);
                setFilterValue("");
                setSelectedPersonId(null);
                setStartDate("");
                setEndDate("");
                setNotes("");
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={addFilter}>
              <Text style={styles.saveButtonText}>Add Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setAdding(true)}>
          <Text style={styles.addButtonText}>+ Add Sensitivity Filter</Text>
        </TouchableOpacity>
      )}
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#999",
    marginBottom: 28,
    lineHeight: 22,
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    textAlign: "center",
    marginVertical: 24,
  },
  filterCard: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#ff6b6b",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  filterIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  filterInfo: {
    flex: 1,
  },
  filterType: {
    fontSize: 12,
    color: "#ff6b6b",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  filterValue: {
    fontSize: 17,
    color: "#e0e0e0",
    fontWeight: "600",
  },
  filterNotes: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  deleteText: {
    color: "#ff6b6b",
    fontSize: 20,
    paddingLeft: 12,
  },
  formContainer: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#e0e0e0",
    marginBottom: 16,
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
    backgroundColor: "#1a1a2e",
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#7c4dff",
  },
  typeButtonText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  input: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  personOption: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  personOptionActive: {
    borderWidth: 2,
    borderColor: "#7c4dff",
  },
  personOptionText: {
    color: "#e0e0e0",
    fontSize: 16,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#ff6b6b",
  },
  addButtonText: {
    fontSize: 18,
    color: "#e0e0e0",
    fontWeight: "600",
  },
});
