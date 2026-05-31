import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, border, type } from "../../theme";
import Icon from "../../components/Icon";

// Format a phone number as (XXX) XXX-XXXX for 10-digit US numbers,
// or +1 (XXX) XXX-XXXX for 11-digit numbers starting with 1.
// Anything else is returned unchanged (international, extensions, etc.).
function formatPhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export default function EmergencyCardScreen({ navigation }: any) {
  const { userId } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    loadEmergencyInfo();
  }, []);

  async function loadEmergencyInfo() {
    if (!userId) return;

    setContactName("");
    setContactRelation("");
    setContactPhone("");
    setContactEmail("");

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
      .select("full_name, relationship, email, phone")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (coUser) {
      setContactName(coUser.full_name);
      setContactRelation(coUser.relationship);
      if (coUser.phone) setContactPhone(coUser.phone);
      if (coUser.email) setContactEmail(coUser.email);

      // Backward-compatible fallback for older rows where phone was stored in people.contact_info
      if (!coUser.phone) {
        const { data: person } = await supabase
          .from("people")
          .select("contact_info")
          .eq("user_id", userId)
          .eq("full_name", coUser.full_name)
          .limit(1)
          .single();

        if (person?.contact_info?.phone) {
          setContactPhone(person.contact_info.phone);
        }
      }
    }
  }

  return (
    <View testID="emergency-card-screen" style={styles.container}>
      <View style={styles.headerIcon}>
        <Icon name="whoAmI" size={32} color={colors.primarySoft} />
      </View>

      <View testID="emergency-card-info" style={styles.card}>
        <Text style={styles.label}>MY NAME IS</Text>
        <Text testID="emergency-card-name" style={styles.value}>{name}</Text>

        {location ? (
          <>
            <Text style={styles.label}>I LIVE IN</Text>
            <Text testID="emergency-card-location" style={styles.value}>{location}</Text>
          </>
        ) : null}

        {contactName ? (
          <View testID="emergency-card-contact-block">
            <Text style={styles.label}>MY EMERGENCY CONTACT</Text>
            <Text testID="emergency-card-contact-name" style={styles.contactValue} numberOfLines={1} adjustsFontSizeToFit>{contactName}</Text>
            <Text style={styles.relation}>({contactRelation})</Text>
            {contactPhone ? (
              <Text testID="emergency-card-contact-phone" style={styles.phone}>{formatPhone(contactPhone)}</Text>
            ) : null}
            {contactEmail ? (
              <Text testID="emergency-card-contact-email" style={styles.email}>{contactEmail}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        testID="emergency-card-back-button"
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
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: 32,
    width: "100%",
    borderWidth: border.emphatic,
    borderColor: colors.primary,
  },
  label: {
    fontSize: type.sm,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    letterSpacing: type.trackingLabel,
    marginTop: 20,
    marginBottom: 4,
  },
  value: {
    fontSize: type.bigBtn,
    fontWeight: type.weightBold,
    color: colors.fgStrong,
  },
  contactValue: {
    fontSize: type.h2,
    fontWeight: type.weightBold,
    color: colors.fgStrong,
  },
  relation: {
    fontSize: type.lg,
    color: colors.fg,
    marginTop: 4,
  },
  phone: {
    fontSize: type.xl,
    color: colors.primary,
    marginTop: 8,
    fontWeight: type.weightMedium,
    letterSpacing: 1,
  },
  email: {
    fontSize: type.lg,
    color: colors.primary,
    marginTop: 8,
    fontWeight: type.weightMedium,
    letterSpacing: 1,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: radius.md,
    marginTop: 40,
  },
  backButtonText: {
    fontSize: type.xl,
    fontWeight: type.weightMedium,
    color: colors.fgStrong,
  },
});
