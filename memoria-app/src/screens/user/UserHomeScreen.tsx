import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function UserHomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Good Morning</Text>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => navigation.navigate("Briefing")}
      >
        <Text style={styles.startButtonText}>Start My Day</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.emergencyButton}
        onPress={() => navigation.navigate("EmergencyCard")}
      >
        <Text style={styles.emergencyButtonText}>🆘 Who Am I?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  greeting: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#e0e0e0",
    marginBottom: 60,
  },
  startButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 28,
    paddingHorizontal: 60,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  startButtonText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  emergencyButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#7c4dff",
  },
  emergencyButtonText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#e0e0e0",
  },
  signOutButton: {
    paddingVertical: 16,
    marginTop: 40,
  },
  signOutText: {
    fontSize: 16,
    color: "#ff6b6b",
  },
});
