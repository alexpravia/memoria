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
  ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@memoria/core";
import { useAuth } from "@memoria/core";
import Icon from "../../components/Icon";
import { AnimatedEntrance } from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import { colors, radius, type } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SetupUserLoginScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AnimatedEntrance index={0}>
          <Text style={styles.title}>Set Up Their Login</Text>
          <Text style={styles.subtitle}>
            Create a simple email and password so your loved one can log into
            their own experience
          </Text>
        </AnimatedEntrance>

        <AnimatedEntrance index={1}>
          <Text style={styles.label}>Their Email</Text>
          <View
            style={[styles.inputWrap, emailFocus && styles.inputWrapFocused]}
          >
            <TextInput
              style={styles.input}
              placeholder="e.g., maria@email.com"
              placeholderTextColor={colors.fgMuted}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance index={2}>
          <Text style={styles.label}>Their Password</Text>
          <View
            style={[styles.inputWrap, passwordFocus && styles.inputWrapFocused]}
          >
            <TextInput
              style={styles.input}
              placeholder="Something simple they can remember"
              placeholderTextColor={colors.fgMuted}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
              secureTextEntry
            />
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance index={3}>
          <View style={styles.hintRow}>
            <Icon name="tip" size={18} color={colors.fgMuted} />
            <Text style={styles.hint}>
              Keep it simple — they'll need to type this to log in. You can
              always help them.
            </Text>
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance index={4}>
          <ShimmerButton
            hero
            disabled={loading}
            onPress={handleSetup}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color={colors.fgStrong} />
            ) : (
              <Text style={styles.buttonText}>Create Login</Text>
            )}
          </ShimmerButton>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>Cancel</Text>
          </TouchableOpacity>
        </AnimatedEntrance>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: type.md,
    color: colors.fg,
    marginBottom: 32,
    lineHeight: 24,
  },
  label: {
    fontSize: type.xs,
    fontWeight: type.weightBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginBottom: 7,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  inputWrapFocused: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: type.md,
    color: colors.fgStrong,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 24,
  },
  hint: {
    flex: 1,
    fontSize: type.sm,
    color: colors.fgMuted,
    lineHeight: 20,
  },
  button: {
    marginBottom: 16,
  },
  buttonText: {
    fontSize: type.lg,
    fontWeight: type.weightMedium,
    color: colors.fgStrong,
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  backText: {
    fontSize: type.base,
    color: colors.fgMuted,
  },
});
