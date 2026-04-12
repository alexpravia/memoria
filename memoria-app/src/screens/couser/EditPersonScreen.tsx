import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function EditPersonScreen({ navigation, route }: Props) {
  const personId: string | undefined = route.params?.personId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [emotionalNotes, setEmotionalNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [keyFacts, setKeyFacts] = useState<string[]>([]);
  const [keyFactInput, setKeyFactInput] = useState("");

  useEffect(() => {
    loadPerson();
  }, [personId]);

  async function loadPerson() {
    if (!personId) {
      Alert.alert("Error", "Missing person ID.");
      navigation.goBack();
      return;
    }

    const { data, error } = await supabase
      .from("people")
      .select("id, full_name, relationship, key_facts, emotional_notes, contact_info")
      .eq("id", personId)
      .single();

    if (error || !data) {
      Alert.alert("Error", "Failed to load this person.");
      navigation.goBack();
      return;
    }

    setFullName(data.full_name || "");
    setRelationship(data.relationship || "");
    setKeyFacts(Array.isArray(data.key_facts) ? data.key_facts : []);
    setEmotionalNotes(data.emotional_notes || "");
    setPhone(data.contact_info?.phone || "");
    setEmail(data.contact_info?.email || "");
    setLoading(false);
  }

  function addKeyFact() {
    const value = keyFactInput.trim();
    if (!value) return;
    setKeyFacts((prev) => [...prev, value]);
    setKeyFactInput("");
  }

  function removeKeyFact(index: number) {
    setKeyFacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function savePerson() {
    if (!personId) return;
    if (!fullName.trim()) {
      Alert.alert("Please enter a name");
      return;
    }
    if (!relationship.trim()) {
      Alert.alert("Please enter a relationship");
      return;
    }

    setSaving(true);
    const contactInfo: Record<string, string> = {};
    if (phone.trim()) contactInfo.phone = phone.trim();
    if (email.trim()) contactInfo.email = email.trim();

    const { error } = await supabase
      .from("people")
      .update({
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        key_facts: keyFacts,
        emotional_notes: emotionalNotes.trim() || null,
        contact_info: Object.keys(contactInfo).length > 0 ? contactInfo : null,
      })
      .eq("id", personId);

    if (error) {
      setSaving(false);
      Alert.alert("Error", error.message || "Failed to save changes.");
      return;
    }

    navigation.goBack();
  }

  if (loading) {
    return (
      <View testID="edit-person-loading" style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
      </View>
    );
  }

  return (
    <ScrollView testID="edit-person-screen" style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        testID="edit-person-back"
        accessibilityRole="button"
        accessibilityLabel="Go back from edit person"
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Edit Person</Text>
      <Text style={styles.subtitle}>Update relationship, notes, and contact details.</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        testID="edit-person-name"
        accessibilityLabel="Full name"
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Relationship *</Text>
      <TextInput
        testID="edit-person-relationship"
        accessibilityLabel="Relationship"
        style={styles.input}
        value={relationship}
        onChangeText={setRelationship}
        placeholder="e.g., Daughter"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        testID="edit-person-phone"
        accessibilityLabel="Phone"
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g., (305) 555-0199"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        testID="edit-person-email"
        accessibilityLabel="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="e.g., maria@email.com"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Key Facts</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.rowInput]}
          value={keyFactInput}
          onChangeText={setKeyFactInput}
          placeholder="Add a key fact"
          placeholderTextColor="#888"
          onSubmitEditing={addKeyFact}
          testID="edit-person-keyfact-input"
          accessibilityLabel="Add a key fact"
        />
        <TouchableOpacity
          style={styles.addFactButton}
          onPress={addKeyFact}
          testID="edit-person-keyfact-add"
          accessibilityRole="button"
          accessibilityLabel="Add key fact"
        >
          <Text style={styles.addFactButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {keyFacts.map((fact, index) => (
        <View key={`${fact}-${index}`} style={styles.factRow}>
          <Text style={styles.factText}>{fact}</Text>
          <TouchableOpacity
            testID={`edit-person-keyfact-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Remove key fact ${index + 1}`}
            onPress={() => removeKeyFact(index)}
          >
            <Text style={styles.factRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.label}>Emotional Notes</Text>
      <TextInput
        testID="edit-person-notes"
        accessibilityLabel="Emotional notes"
        style={[styles.input, styles.notesInput]}
        value={emotionalNotes}
        onChangeText={setEmotionalNotes}
        placeholder="Warm details that help with memory and comfort"
        placeholderTextColor="#888"
        multiline
      />

      <TouchableOpacity
        testID="edit-person-save"
        accessibilityRole="button"
        accessibilityLabel="Save person changes"
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={savePerson}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
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
  centered: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    color: "#b388ff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    color: "#e0e0e0",
    fontSize: 16,
    marginBottom: 24,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rowInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  addFactButton: {
    backgroundColor: "#7c4dff",
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addFactButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  factRow: {
    backgroundColor: "#3a3a5a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factText: {
    color: "#e0e0e0",
    fontSize: 14,
    flex: 1,
    paddingRight: 10,
  },
  factRemove: {
    color: "#ff6b6b",
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
