import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
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

export default function EmergencyContactSettingsScreen({ navigation }: Props) {
  const { coUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadContactPhone();
  }, [coUserId]);

  async function loadContactPhone() {
    if (!coUserId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("co_users")
      .select("phone")
      .eq("id", coUserId)
      .single();

    if (!error && data?.phone) {
      setPhone(data.phone);
    }
    setLoading(false);
  }

  async function savePhone() {
    if (!coUserId) return;
    if (!phone.trim()) {
      Alert.alert("Please enter a phone number.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("co_users")
      .update({ phone: phone.trim() })
      .eq("id", coUserId);
    setSaving(false);

    if (error) {
      Alert.alert("Error", error.message || "Failed to save phone number.");
      return;
    }

    Alert.alert("Saved", "Emergency phone number updated.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
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

      <Text style={styles.title}>Emergency Contact</Text>
      <Text style={styles.subtitle}>
        This phone number appears in "Who Am I?" above your email.
      </Text>

      <Text style={styles.label}>Your Phone Number *</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g., (305) 555-0199"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={savePhone}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Phone Number</Text>}
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
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 24,
    lineHeight: 24,
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
