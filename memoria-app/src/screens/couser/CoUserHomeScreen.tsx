import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function CoUserHomeScreen({ navigation }: Props) {
  const { userId, signOut } = useAuth();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    lifeFacts: 0,
    people: 0,
    events: 0,
  });

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  async function loadData() {
    const { data: user } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (user) setUserName(user.full_name);

    const { count: lifeFacts } = await supabase
      .from("life_facts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: people } = await supabase
      .from("people")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: events } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    setStats({
      lifeFacts: lifeFacts || 0,
      people: people || 0,
      events: events || 0,
    });
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Helper Dashboard</Text>
      <Text style={styles.subtitle}>
        Managing {userName ? userName + "'s" : "your loved one's"} experience
      </Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.lifeFacts}</Text>
          <Text style={styles.statLabel}>Life Facts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.people}</Text>
          <Text style={styles.statLabel}>People</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.events}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddLifeFacts", { userId })}
      >
        <Text style={styles.actionButtonText}>+ Add Life Facts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddPeople", { userId })}
      >
        <Text style={styles.actionButtonText}>+ Add People</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("AddEvents", { userId })}
      >
        <Text style={styles.actionButtonText}>+ Add Events</Text>
      </TouchableOpacity>

      {/* Import section */}
      <Text style={styles.sectionTitle}>Import From Device</Text>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportContacts")}
      >
        <Text style={styles.actionButtonText}>📇 Import Contacts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportCalendar")}
      >
        <Text style={styles.actionButtonText}>📅 Import Calendar Events</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.importButton}
        onPress={() => navigation.navigate("ImportPhotos")}
      >
        <Text style={styles.actionButtonText}>📸 Import Photos</Text>
      </TouchableOpacity>

      {/* Settings section */}
      <TouchableOpacity
        style={[styles.actionButton, styles.setupLoginButton]}
        onPress={() => navigation.navigate("SetupUserLogin")}
      >
        <Text style={styles.actionButtonText}>🔑 Set Up Their Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
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
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#7c4dff",
  },
  statLabel: {
    fontSize: 13,
    color: "#b388ff",
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#7c4dff",
  },
  actionButtonText: {
    fontSize: 18,
    color: "#e0e0e0",
    fontWeight: "600",
  },
  signOutButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#b388ff",
    marginTop: 24,
    marginBottom: 12,
  },
  importButton: {
    backgroundColor: "#2a2a4a",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#b388ff",
  },
  setupLoginButton: {
    borderLeftColor: "#b388ff",
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    color: "#ff6b6b",
  },
});
