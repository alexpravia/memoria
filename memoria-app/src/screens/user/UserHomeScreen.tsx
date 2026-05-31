import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { requestNotificationPermissions, scheduleEventReminders } from "../../lib/notifications";
import { colors, radius, type } from "../../theme";
import Icon from "../../components/Icon";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function UserHomeScreen({ navigation }: Props) {
  const { userId, signOut } = useAuth();

  useEffect(() => {
    async function setupReminders() {
      if (!userId) return;
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleEventReminders(userId);
      }
    }
    setupReminders();
  }, [userId]);

  return (
    <View testID="user-home-screen" style={styles.container}>
      <Text testID="user-home-greeting" style={styles.greeting}>Good Morning</Text>

      <TouchableOpacity
        testID="user-home-briefing-button"
        style={styles.startButton}
        onPress={() => navigation.navigate("Briefing")}
      >
        <Text style={styles.startButtonText}>Start My Day</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="user-home-assistant-button"
        style={styles.assistantButton}
        onPress={() => navigation.navigate("Assistant")}
      >
        <Icon name="memo" size={22} color={colors.primarySoft} />
        <Text style={styles.assistantButtonText}>Talk to Memo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="user-home-emergency-button"
        style={styles.emergencyButton}
        onPress={() => navigation.navigate("EmergencyCard")}
      >
        <Icon name="whoAmI" size={22} color={colors.fg} />
        <Text style={styles.emergencyButtonText}>Who Am I?</Text>
      </TouchableOpacity>

      <TouchableOpacity testID="user-home-signout-button" style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  greeting: {
    fontSize: type.greeting,
    fontWeight: type.weightBold,
    color: colors.fg,
    marginBottom: 60,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingVertical: 28,
    paddingHorizontal: 60,
    borderRadius: radius.xxl,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  startButtonText: {
    fontSize: type.bigBtn,
    fontWeight: type.weightBold,
    color: colors.fgStrong,
  },
  assistantButton: {
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: radius.lg,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  assistantButtonText: {
    fontSize: type.h3,
    fontWeight: type.weightMedium,
    color: colors.primarySoft,
  },
  emergencyButton: {
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: radius.lg,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emergencyButtonText: {
    fontSize: type.h3,
    fontWeight: type.weightMedium,
    color: colors.fg,
  },
  signOutButton: {
    paddingVertical: 16,
    marginTop: 40,
  },
  signOutText: {
    fontSize: type.base,
    color: colors.danger,
  },
});
