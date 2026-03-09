import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function CreateUserProfileScreen({ navigation }: Props) {
  const { session, setUserId } = useAuth();
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [location, setLocation] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!fullName.trim()) {
      Alert.alert("Please enter their name");
      return;
    }
    if (!relationship.trim()) {
      Alert.alert("Please enter your relationship to them");
      return;
    }

    setLoading(true);
    try {
      // Create the user (patient) profile
      const { data: user, error: userError } = await supabase
        .from("users")
        .insert({
          email: `${fullName.trim().toLowerCase().replace(/\s+/g, ".")}@memoria.placeholder`,
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth || null,
          location: location.trim() || null,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Create the co-user record linked to this user
      const { data: coUser, error: coUserError } = await supabase
        .from("co_users")
        .insert({
          auth_id: session!.user.id,
          email: session!.user.email!,
          full_name: session!.user.user_metadata?.full_name || session!.user.email!,
          user_id: user.id,
          relationship: relationship.trim(),
        })
        .select()
        .single();

      if (coUserError) throw coUserError;

      setUserId(user.id);
      navigation.navigate("AddLifeFacts", { userId: user.id });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set Up Their Profile</Text>
      <Text style={styles.subtitle}>
        Tell us about the person you're helping
      </Text>

      <Text style={styles.label}>Their Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Maria Garcia"
        placeholderTextColor="#888"
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>Date of Birth</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#888"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />

      <Text style={styles.label}>Where They Live</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Miami, FL"
        placeholderTextColor="#888"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Your Relationship to Them *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Daughter, Son, Caregiver"
        placeholderTextColor="#888"
        value={relationship}
        onChangeText={setRelationship}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Next</Text>
        )}
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
  label: {
    fontSize: 16,
    color: "#b388ff",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#fff",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
