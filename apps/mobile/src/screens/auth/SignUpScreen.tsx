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
import { useAuth } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!fullName || !email || !password) {
      Alert.alert("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, "co_user", fullName.trim());
      Alert.alert(
        "Check your email",
        "We sent you a confirmation link. Please verify your email to continue."
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      testID="signup-screen"
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.title}>Memoria</Text>
      <Text style={styles.subtitle}>Create your helper account</Text>

      <TextInput
        testID="signup-full-name-input"
        style={styles.input}
        placeholder="Your Full Name"
        placeholderTextColor="#888"
        value={fullName}
        onChangeText={setFullName}
        accessibilityLabel="Full name"
        accessibilityHint="Enter your name for your helper account"
      />

      <TextInput
        testID="signup-email-input"
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Email address"
        accessibilityHint="Enter the email address for your helper account"
      />

      <TextInput
        testID="signup-password-input"
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel="Password"
        accessibilityHint="Enter a password with at least 6 characters"
      />

      <TouchableOpacity
        testID="signup-submit-button"
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Creating helper account" : "Sign up as helper"}
        accessibilityHint="Creates your helper account and sends an email confirmation link"
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator
            testID="signup-loading-indicator"
            color="#fff"
            accessibilityLabel="Creating helper account"
          />
        ) : (
          <Text style={styles.buttonText}>Sign Up as Helper</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="signup-login-link"
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to log in"
        accessibilityHint="Returns to the log in screen"
      >
        <Text style={styles.linkText}>Already have an account? Log In</Text>
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
    fontSize: 48,
    fontWeight: "bold",
    color: "#b388ff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#fff",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  linkText: {
    color: "#b388ff",
    fontSize: 16,
    textAlign: "center",
  },
});
