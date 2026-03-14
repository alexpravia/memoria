import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function EmergencyCardScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  useEffect(() => {
    loadEmergencyInfo();
  }, []);

  async function loadEmergencyInfo() {
    if (!userId) return;

    const { data: user } = await supabase
      .from("users")
      .select("full_name, location")
      .eq("id", userId)
      .single();

    if (user) {
      setName(user.full_name);
      setLocation(user.location || "");
    }

    // Get the co-user as emergency contact
    const { data: coUser } = await supabase
      .from("co_users")
      .select("full_name, relationship, phone")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (coUser) {
      setContactName(coUser.full_name);
      setContactRelation(coUser.relationship);
      setContactPhone(coUser.phone || "");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🆘</Text>

      <View style={styles.card}>
        <Text style={styles.label}>MY NAME IS</Text>
        <Text style={styles.value}>{name}</Text>

        {location ? (
          <>
            <Text style={styles.label}>I LIVE IN</Text>
            <Text style={styles.value}>{location}</Text>
          </>
        ) : null}

        {contactName ? (
          <>
            <Text style={styles.label}>MY EMERGENCY CONTACT</Text>
            <Text style={styles.contactValue} numberOfLines={1} adjustsFontSizeToFit>{contactName}</Text>
            <Text style={styles.relation}>({contactRelation})</Text>
            {contactPhone ? (
              <Text style={styles.phone}>{contactPhone}</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Go Back</Text>
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
  header: {
    fontSize: 60,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "#2a2a4a",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    borderWidth: 3,
    borderColor: "#7c4dff",
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#b388ff",
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  contactValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    minFontSize: 16,
  },
  relation: {
    fontSize: 18,
    color: "#e0e0e0",
    marginTop: 4,
  },
  phone: {
    fontSize: 20,
    color: "#7c4dff",
    marginTop: 8,
    fontWeight: "600",
    letterSpacing: 1,
  },
  backButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginTop: 40,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
