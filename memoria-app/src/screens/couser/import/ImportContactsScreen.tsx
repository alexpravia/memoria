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
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

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

    // Fetch already-imported people to mark them
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
        if (a.alreadyImported !== b.alreadyImported) return a.alreadyImported ? 1 : -1;
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
    setContacts(
      contacts.map((c) =>
        c.id === id && !c.alreadyImported ? { ...c, selected: !c.selected } : c
      )
    );
  }

  function selectAll() {
    const selectable = contacts.filter((c) => !c.alreadyImported);
    const allSelected = selectable.length > 0 && selectable.every((c) => c.selected);
    setContacts(contacts.map((c) => c.alreadyImported ? c : { ...c, selected: !allSelected }));
  }

  async function handleImport() {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) {
      Alert.alert("Please select at least one contact to import");
      return;
    }

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
        `${selected.length} contact${selected.length > 1 ? "s" : ""} imported. You can edit their relationships and details from the dashboard.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = contacts.filter((c) => c.selected).length;

  const availableCount = contacts.filter((c) => !c.alreadyImported).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7c4dff" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>Contact Access Needed</Text>
        <Text style={styles.permissionText}>
          We need access to your contacts to import them. Please grant access in Settings.
        </Text>
        <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Contacts</Text>
        <Text style={styles.subtitle}>
          {availableCount === 0
            ? "All visible contacts have been imported. Grant access to more contacts in Settings."
            : "Select the people important to your loved one"}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {contacts.every((c) => c.selected) ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>{selectedCount} selected</Text>
        </View>

        <TouchableOpacity style={styles.grantMoreButton} onPress={openSettings}>
          <Text style={styles.grantMoreText}>Grant Access to More Contacts</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.contactItem,
              item.selected && styles.contactItemSelected,
              item.alreadyImported && styles.contactItemImported,
            ]}
            onPress={() => toggleContact(item.id)}
            disabled={item.alreadyImported}
          >
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, item.alreadyImported && styles.importedText]}>{item.name}</Text>
              {item.alreadyImported ? (
                <Text style={styles.importedBadge}>Already imported</Text>
              ) : item.phone ? (
                <Text style={styles.contactDetail}>{item.phone}</Text>
              ) : null}
            </View>
            {!item.alreadyImported && (
              <View
                style={[
                  styles.checkbox,
                  item.selected && styles.checkboxChecked,
                ]}
              >
                {item.selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {selectedCount > 0 && (
        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>
              Import {selectedCount} Contact{selectedCount > 1 ? "s" : ""}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  centered: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#e0e0e0",
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectAllText: {
    color: "#7c4dff",
    fontSize: 16,
    fontWeight: "600",
  },
  countText: {
    color: "#888",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 40,
  },
  contactItem: {
    backgroundColor: "#2a2a4a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contactItemSelected: {
    borderWidth: 2,
    borderColor: "#7c4dff",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  contactDetail: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  checkboxChecked: {
    backgroundColor: "#7c4dff",
    borderColor: "#7c4dff",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  importButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 12,
  },
  importButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },
  cancelText: {
    fontSize: 16,
    color: "#888",
  },
  contactItemImported: {
    opacity: 0.5,
  },
  importedText: {
    color: "#888",
  },
  importedBadge: {
    fontSize: 12,
    color: "#7c4dff",
    marginTop: 4,
    fontStyle: "italic",
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#b388ff",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  settingsButton: {
    backgroundColor: "#7c4dff",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  grantMoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  grantMoreText: {
    fontSize: 14,
    color: "#7c4dff",
    fontWeight: "600",
  },
});
