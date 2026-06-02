import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { supabase, embedAndStore } from "@memoria/core";
import { colors, radius } from "@memoria/core";
import { AnimatedEntrance } from "../../../motion/primitives";
import { Avatar } from "../../../motion/ui";
import Icon from "../../../components/Icon";
import {
  FlowNav, FlowHeader, FocusField, AddRow, FlowButton,
  SectionCard, SectionTitle, AddSubButton, MUTE,
} from "../FlowLayout";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

interface PersonEntry {
  full_name: string;
  relationship: string;
  key_facts: string[];
  emotional_notes: string;
}

export default function AddPeopleScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [people, setPeople] = useState<PersonEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyFacts, setKeyFacts] = useState<string[]>([]);
  const [emotionalNotes, setEmotionalNotes] = useState("");

  function addKeyFact() {
    const v = keyDraft.trim();
    if (!v) return;
    setKeyFacts((k) => [...k, v]);
    setKeyDraft("");
  }

  function addPerson() {
    if (!name.trim() || !relationship.trim()) {
      Alert.alert("Please enter at least a name and relationship");
      return;
    }
    setPeople((p) => [
      ...p,
      {
        full_name: name.trim(),
        relationship: relationship.trim(),
        key_facts: keyFacts,
        emotional_notes: emotionalNotes.trim(),
      },
    ]);
    setName("");
    setRelationship("");
    setKeyDraft("");
    setKeyFacts([]);
    setEmotionalNotes("");
  }

  async function handleNext() {
    if (people.length === 0) {
      navigation.navigate("AddEvents", { userId });
      return;
    }

    setLoading(true);
    try {
      const rows = people.map((p) => ({
        user_id: userId,
        full_name: p.full_name,
        relationship: p.relationship,
        key_facts: p.key_facts,
        emotional_notes: p.emotional_notes || null,
      }));

      const { data: inserted, error } = await supabase
        .from("people")
        .insert(rows)
        .select("id, full_name, relationship, key_facts, emotional_notes");
      if (error) throw error;

      (inserted || []).forEach((row: any) => {
        const text = [
          row.full_name,
          row.relationship,
          (row.key_facts || []).join(" "),
          row.emotional_notes || "",
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        void embedAndStore("people", row.id, text);
      });

      navigation.navigate("AddEvents", { userId });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FlowNav
        onBack={() => navigation.goBack()}
        onClose={() => navigation.navigate("CoUserHome")}
      />
      <AnimatedEntrance index={0}>
        <FlowHeader
          title="Important People"
          sub="The people in their life they should know"
        />
      </AnimatedEntrance>

      {/* Added people list */}
      {people.length > 0 && (
        <View style={styles.peopleList}>
          {people.map((p, i) => (
            <AnimatedEntrance key={p.full_name + i} index={i + 1}>
              <View style={styles.personCard}>
                <Avatar initial={p.full_name[0]} seed={p.full_name} size={44} />
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{p.full_name}</Text>
                  <Text style={styles.personRel}>{p.relationship}</Text>
                </View>
                <Icon name="check" size={18} color={colors.success} accentColor={colors.success} />
              </View>
            </AnimatedEntrance>
          ))}
        </View>
      )}

      {/* Add-person form card */}
      <AnimatedEntrance index={people.length + 2}>
        <SectionCard>
          <SectionTitle>
            {people.length === 0 ? "Add a person" : "Add another person"}
          </SectionTitle>

          <FocusField
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Robert"
          />
          <FocusField
            label="Relationship"
            value={relationship}
            onChange={setRelationship}
            placeholder="e.g. Son"
          />

          <Text style={styles.keyLabel}>Key Facts</Text>
          <AddRow
            value={keyDraft}
            onChange={setKeyDraft}
            onAdd={addKeyFact}
            placeholder="e.g. Lives in Portland"
          />
          {keyFacts.length > 0 && (
            <View style={styles.keyChips}>
              {keyFacts.map((f, i) => (
                <View key={f + i} style={styles.keyChip}>
                  <Text style={styles.keyChipText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          <FocusField
            label="Emotional Notes"
            value={emotionalNotes}
            onChange={setEmotionalNotes}
            placeholder="What they love talking about with this person"
            multiline
            style={{ marginTop: 2 }}
          />

          <AddSubButton label="Add this person" icon="addPerson" onPress={addPerson} />
        </SectionCard>
      </AnimatedEntrance>

      <AnimatedEntrance index={people.length + 4}>
        <FlowButton
          label={people.length === 0 ? "Skip for now" : "Next"}
          onPress={handleNext}
          disabled={loading}
        />
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
    padding: 20,
    paddingTop: 72,
    paddingBottom: 48,
  },
  peopleList: {
    marginTop: 18,
    gap: 10,
  },
  personCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.fg,
  },
  personRel: {
    fontSize: 13.5,
    color: MUTE,
    marginTop: 2,
  },
  keyLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginBottom: 7,
  },
  keyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  keyChip: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  keyChipText: {
    color: colors.fg,
    fontSize: 13.5,
  },
});
