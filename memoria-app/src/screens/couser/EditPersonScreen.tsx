import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { embedAndStore } from "../../lib/embeddings";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
} from "../../motion/primitives";
import { Avatar, ShimmerButton, Switch } from "../../motion/ui";
import Icon from "../../components/Icon";
import { colors, radius, type } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function EditPersonScreen({ navigation, route }: Props) {
  const personId: string | undefined = route.params?.personId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [emotionalNotes, setEmotionalNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [keyFacts, setKeyFacts] = useState<string[]>([]);
  const [keyFactInput, setKeyFactInput] = useState("");

  // Presentation-only: which input currently owns the focus glow.
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // Presentation-only toggle for the briefing-inclusion row (does not touch save).
  const [includeInBriefings, setIncludeInBriefings] = useState(true);
  // Best-effort display name of the linked user, for the header subtitle.
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadPerson();
  }, [personId]);

  async function loadPerson() {
    if (!personId) {
      Alert.alert("Error", "Missing person ID.");
      navigation.goBack();
      return;
    }

    const { data, error } = await supabase
      .from("people")
      .select("id, user_id, full_name, relationship, key_facts, emotional_notes, contact_info")
      .eq("id", personId)
      .single();

    if (error || !data) {
      Alert.alert("Error", "Failed to load this person.");
      navigation.goBack();
      return;
    }

    setFullName(data.full_name || "");
    setRelationship(data.relationship || "");
    setKeyFacts(Array.isArray(data.key_facts) ? data.key_facts : []);
    setEmotionalNotes(data.emotional_notes || "");
    setPhone(data.contact_info?.phone || "");
    setEmail(data.contact_info?.email || "");
    setLoading(false);

    // Best-effort: resolve the linked user's name for the header subtitle.
    // Fully guarded — any failure is ignored and does not affect the form.
    if (data.user_id) {
      try {
        const { data: u } = await supabase
          .from("users")
          .select("name")
          .eq("id", data.user_id)
          .single();
        if (u?.name) setUserName(u.name);
      } catch {
        // ignore — subtitle simply omits the user's name
      }
    }
  }

  function addKeyFact() {
    const value = keyFactInput.trim();
    if (!value) return;
    setKeyFacts((prev) => [...prev, value]);
    setKeyFactInput("");
  }

  function removeKeyFact(index: number) {
    setKeyFacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function savePerson() {
    if (!personId) return;
    if (!fullName.trim()) {
      Alert.alert("Please enter a name");
      return;
    }
    if (!relationship.trim()) {
      Alert.alert("Please enter a relationship");
      return;
    }

    setSaving(true);
    const contactInfo: Record<string, string> = {};
    if (phone.trim()) contactInfo.phone = phone.trim();
    if (email.trim()) contactInfo.email = email.trim();

    const { error } = await supabase
      .from("people")
      .update({
        full_name: fullName.trim(),
        relationship: relationship.trim(),
        key_facts: keyFacts,
        emotional_notes: emotionalNotes.trim() || null,
        contact_info: Object.keys(contactInfo).length > 0 ? contactInfo : null,
      })
      .eq("id", personId);

    if (error) {
      setSaving(false);
      Alert.alert("Error", error.message || "Failed to save changes.");
      return;
    }

    // Fire-and-forget: re-embed the updated person. Must NOT block the save.
    const embedText = [
      fullName.trim(),
      relationship.trim(),
      keyFacts.join(" "),
      emotionalNotes.trim(),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    void embedAndStore("people", personId, embedText);

    navigation.goBack();
  }

  if (loading) {
    return (
      <View testID="edit-person-loading" style={styles.centered}>
        <BrandLoader caption="Loading…" />
      </View>
    );
  }

  // Header subtitle: "{Name} — {user}'s {relationship}".
  const relLabel = relationship.trim().toLowerCase();
  const headerName = fullName.trim() || "This person";
  const subtitle = userName
    ? `${headerName} — ${userName}'s ${relLabel || "loved one"}`
    : relLabel
    ? `${headerName} — ${relLabel}`
    : headerName;

  const avatarInitial = (fullName.trim()[0] || "?").toUpperCase();

  // Returns the focus-glow style for a given field key.
  const fieldBox = (key: string) => [
    styles.fieldBox,
    focusedField === key && styles.fieldBoxFocused,
  ];

  return (
    <ScrollView
      testID="edit-person-screen"
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <AnimatedEntrance index={0}>
        <SpringPressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <View
            testID="edit-person-back"
            accessibilityRole="button"
            accessibilityLabel="Go back from edit person"
            style={styles.backInner}
          >
            <Icon name="back" size={22} color={colors.primarySoft} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </SpringPressable>

        <Text style={styles.title}>Edit Person</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </AnimatedEntrance>

      <AnimatedEntrance index={1}>
        <View style={styles.avatarWrap}>
          <Avatar initial={avatarInitial} seed={headerName} size={84} />
        </View>
      </AnimatedEntrance>

      {/* Name */}
      <AnimatedEntrance index={2}>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <View style={fieldBox("name")}>
            <TextInput
              testID="edit-person-name"
              accessibilityLabel="Full name"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={colors.fgMuted}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>
      </AnimatedEntrance>

      {/* Relationship */}
      <AnimatedEntrance index={3}>
        <View style={styles.field}>
          <Text style={styles.label}>Relationship</Text>
          <View style={fieldBox("relationship")}>
            <TextInput
              testID="edit-person-relationship"
              accessibilityLabel="Relationship"
              style={styles.input}
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g., Daughter"
              placeholderTextColor={colors.fgMuted}
              onFocus={() => setFocusedField("relationship")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>
      </AnimatedEntrance>

      {/* Phone */}
      <AnimatedEntrance index={4}>
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <View style={fieldBox("phone")}>
            <TextInput
              testID="edit-person-phone"
              accessibilityLabel="Phone"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g., (305) 555-0199"
              placeholderTextColor={colors.fgMuted}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>
      </AnimatedEntrance>

      {/* Email */}
      <AnimatedEntrance index={5}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={fieldBox("email")}>
            <TextInput
              testID="edit-person-email"
              accessibilityLabel="Email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g., maria@email.com"
              placeholderTextColor={colors.fgMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>
      </AnimatedEntrance>

      {/* Key Facts */}
      <AnimatedEntrance index={6}>
        <View style={styles.field}>
          <Text style={styles.label}>Key Facts</Text>
          <View style={styles.row}>
            <View style={[fieldBox("keyfact"), styles.rowInputBox]}>
              <TextInput
                style={styles.input}
                value={keyFactInput}
                onChangeText={setKeyFactInput}
                placeholder="Add a key fact"
                placeholderTextColor={colors.fgMuted}
                onSubmitEditing={addKeyFact}
                testID="edit-person-keyfact-input"
                accessibilityLabel="Add a key fact"
                onFocus={() => setFocusedField("keyfact")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <SpringPressable onPress={addKeyFact} style={styles.addFactButton}>
              <View
                testID="edit-person-keyfact-add"
                accessibilityRole="button"
                accessibilityLabel="Add key fact"
                style={styles.addFactInner}
              >
                <Icon name="add" size={24} color="#fff" accentColor="#fff" />
              </View>
            </SpringPressable>
          </View>

          {keyFacts.map((fact, index) => (
            <View key={`${fact}-${index}`} style={styles.factRow}>
              <Text style={styles.factText}>{fact}</Text>
              <SpringPressable onPress={() => removeKeyFact(index)}>
                <View
                  testID={`edit-person-keyfact-remove-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove key fact ${index + 1}`}
                  style={styles.factRemoveBtn}
                >
                  <Icon name="close" size={16} color={colors.danger} />
                </View>
              </SpringPressable>
            </View>
          ))}
        </View>
      </AnimatedEntrance>

      {/* Emotional Notes */}
      <AnimatedEntrance index={7}>
        <View style={styles.field}>
          <Text style={styles.label}>How they're connected</Text>
          <View style={[fieldBox("notes"), styles.notesBox]}>
            <TextInput
              testID="edit-person-notes"
              accessibilityLabel="Emotional notes"
              style={[styles.input, styles.notesInput]}
              value={emotionalNotes}
              onChangeText={setEmotionalNotes}
              placeholder="Warm details that help with memory and comfort"
              placeholderTextColor={colors.fgMuted}
              multiline
              onFocus={() => setFocusedField("notes")}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>
      </AnimatedEntrance>

      {/* Include in daily briefings */}
      <AnimatedEntrance index={8}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Include in daily briefings</Text>
            <Text style={styles.toggleSub}>
              {`Memo will mention ${headerName} in ${
                userName ? `${userName}'s` : "the"
              } morning briefing.`}
            </Text>
          </View>
          <Switch
            value={includeInBriefings}
            onToggle={() => setIncludeInBriefings((b) => !b)}
          />
        </View>
      </AnimatedEntrance>

      {/* Save */}
      <AnimatedEntrance index={9}>
        <ShimmerButton hero disabled={saving} onPress={savePerson} style={styles.saveButton}>
          <View
            testID="edit-person-save"
            accessibilityRole="button"
            accessibilityLabel="Save person changes"
            style={styles.saveInner}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save changes</Text>
            )}
          </View>
        </ShimmerButton>
      </AnimatedEntrance>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: type.base,
    fontWeight: type.weightMedium,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.fg,
    fontSize: type.base,
  },
  avatarWrap: {
    alignItems: "center",
    marginTop: 22,
    marginBottom: 22,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12.5,
    color: colors.primarySoft,
    marginBottom: 7,
    fontWeight: type.weightBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  fieldBoxFocused: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  input: {
    fontSize: 17,
    color: colors.fgStrong,
    paddingVertical: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowInputBox: {
    flex: 1,
  },
  addFactButton: {
    backgroundColor: colors.primary,
    width: 52,
    height: 52,
    borderRadius: radius.sm,
  },
  addFactInner: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  factRow: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factText: {
    color: colors.fg,
    fontSize: type.sm,
    flex: 1,
    paddingRight: 10,
  },
  factRemoveBtn: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  notesBox: {
    paddingVertical: 12,
  },
  notesInput: {
    minHeight: 84,
    textAlignVertical: "top",
    paddingVertical: 0,
    lineHeight: 22,
  },
  toggleRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16.5,
    fontWeight: type.weightMedium,
    color: colors.fg,
  },
  toggleSub: {
    fontSize: type.xs,
    color: colors.fgMuted,
    marginTop: 3,
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 8,
  },
  saveInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: type.lg,
    fontWeight: type.weightMedium,
  },
});
