import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SetupUserLoginScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetup() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // Store current session so we can restore it
      const { data: currentSession } = await supabase.auth.getSession();

      // Create a new auth account for the user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Failed to create account");

      const newUserId = data.user.id;

      // Restore the co-user's session
      if (currentSession?.session) {
        await supabase.auth.setSession({
          access_token: currentSession.session.access_token,
          refresh_token: currentSession.session.refresh_token,
        });
      }

      // Link this auth account to the existing user profile
      const { error: updateError } = await supabase
        .from("users")
        .update({ auth_id: newUserId, email: email.trim() })
        .eq("id", userId);

      if (updateError) throw updateError;

      Alert.alert(
        "Login Created!",
        `Your loved one can now log in with:\n\nEmail: ${email.trim()}\nPassword: (what you just set)\n\nKeep these credentials safe.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.title}>Set Up Their Login</Text>
      <Text style={styles.subtitle}>
        Create a simple email and password so your loved one can log into their
        own experience
      </Text>

      <Text style={styles.label}>Their Email</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., maria@email.com"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Their Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Something simple they can remember"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.hint}>
        💡 Keep it simple — they'll need to type this to log in. You can always
        help them.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSetup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    padding: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: "#e0e0e0",
    marginBottom: 32,
    lineHeight: 24,
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
  hint: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    color: "#888",
  },
});
