import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import * as Contacts from "expo-contacts";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase, useAuth } from "@memoria/core";
import { colors, radius } from "@memoria/core";
import { SpringPressable } from "../../../motion/primitives";
import { Avatar, ShimmerButton } from "../../../motion/ui";
import { FlowNav, FlowHeader, ObCheck, MUTE } from "../FlowLayout";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  selected: boolean;
  alreadyImported: boolean;
}

export default function ImportContactsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.Name,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
      ],
    });

    const { data: existingPeople } = await supabase
      .from("people")
      .select("full_name")
      .eq("user_id", userId);

    const existingNames = new Set(
      (existingPeople || []).map((p) => p.full_name.toLowerCase())
    );

    const mapped: ContactItem[] = data
      .filter((c) => c.name)
      .map((c) => ({
        id: c.id || Math.random().toString(),
        name: c.name || "",
        phone: c.phoneNumbers?.[0]?.number || "",
        email: c.emails?.[0]?.email || "",
        selected: false,
        alreadyImported: existingNames.has((c.name || "").toLowerCase()),
      }))
      .sort((a, b) => {
        if (a.alreadyImported !== b.alreadyImported)
          return a.alreadyImported ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    setContacts(mapped);
    setPermissionDenied(false);
    setLoading(false);
  }

  function openSettings() {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }

  function toggleContact(id: string) {
    setContacts((arr) =>
      arr.map((c) =>
        c.id === id && !c.alreadyImported ? { ...c, selected: !c.selected } : c
      )
    );
  }

  function selectAll() {
    const selectable = contacts.filter((c) => !c.alreadyImported);
    const allSelected =
      selectable.length > 0 && selectable.every((c) => c.selected);
    setContacts((arr) =>
      arr.map((c) => (c.alreadyImported ? c : { ...c, selected: !allSelected }))
    );
  }

  async function handleImport() {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const rows = selected.map((c) => ({
        user_id: userId,
        full_name: c.name,
        relationship: "Contact",
        contact_info: {
          phone: c.phone || undefined,
          email: c.email || undefined,
        },
        key_facts: [],
      }));

      const { error } = await supabase.from("people").insert(rows);
      if (error) throw error;

      Alert.alert(
        "Imported!",
        `${selected.length} contact${selected.length > 1 ? "s" : ""} imported. You can edit their details from People.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = contacts.filter((c) => c.selected).length;
  const selectable = contacts.filter((c) => !c.alreadyImported);
  const allSelected =
    selectable.length > 0 && selectable.every((c) => c.selected);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading contacts…</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>Contact Access Needed</Text>
        <Text style={styles.permText}>
          We need access to your contacts to import them. Please grant access in
          Settings.
        </Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={openSettings}>
          <Text style={styles.settingsBtnText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skipBtn}>
          <Text style={styles.skipText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
        <FlowNav
          onBack={() => navigation.goBack()}
          onClose={() => navigation.goBack()}
        />
        <FlowHeader
          title="Import Contacts"
          sub="Pick the people who matter to them"
        />

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>{selectedCount} selected</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <SpringPressable
            onPress={() => toggleContact(item.id)}
            disabled={item.alreadyImported}
            style={[
              styles.contactRow,
              item.selected && styles.contactRowSelected,
              item.alreadyImported && styles.contactRowImported,
            ]}
          >
            <Avatar initial={item.name[0]} seed={item.name} size={40} />
            <View style={styles.contactInfo}>
              <Text
                style={[
                  styles.contactName,
                  item.alreadyImported && styles.dimText,
                ]}
              >
                {item.name}
              </Text>
              {item.alreadyImported ? (
                <Text style={styles.importedBadge}>Already imported</Text>
              ) : item.phone ? (
                <Text style={styles.contactPhone}>{item.phone}</Text>
              ) : null}
            </View>
            {!item.alreadyImported && <ObCheck on={!!item.selected} />}
          </SpringPressable>
        )}
      />

      {/* Fixed import button */}
      {selectedCount > 0 && (
        <View style={styles.importWrap}>
          <ShimmerButton
            label={`Import ${selectedCount} contact${selectedCount > 1 ? "s" : ""}`}
            onPress={handleImport}
            disabled={importing}
            hero
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    color: colors.fg,
    fontSize: 16,
    marginTop: 12,
  },
  permTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primarySoft,
    marginBottom: 12,
    textAlign: "center",
  },
  permText: {
    fontSize: 16,
    color: colors.fg,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  settingsBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  settingsBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    color: MUTE,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 4,
  },
  selectAllText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  countText: {
    color: MUTE,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  contactRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  contactRowSelected: {
    borderColor: colors.primary,
  },
  contactRowImported: {
    opacity: 0.5,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16.5,
    fontWeight: "600",
    color: colors.fgStrong,
  },
  contactPhone: {
    fontSize: 13,
    color: MUTE,
    marginTop: 3,
  },
  importedBadge: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 3,
    fontStyle: "italic",
  },
  dimText: {
    color: MUTE,
  },
  importWrap: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
});
