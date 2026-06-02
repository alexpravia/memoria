import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { supabase, embedAndStore } from "@memoria/core";
import { colors } from "@memoria/core";
import { AnimatedEntrance } from "../../../motion/primitives";
import {
  FlowNav, FlowHeader, AddRow, FactChip, FlowButton,
} from "../FlowLayout";

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function AddLifeFactsScreen({ navigation, route }: Props) {
  const userId = route.params?.userId;
  const [draft, setDraft] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addFact() {
    const v = draft.trim();
    if (!v) return;
    setFacts((f) => [...f, v]);
    setDraft("");
  }

  function removeFact(index: number) {
    setFacts((f) => f.filter((_, i) => i !== index));
  }

  async function handleNext() {
    if (facts.length === 0) {
      navigation.navigate("AddPeople", { userId });
      return;
    }

    setLoading(true);
    try {
      const rows = facts.map((f, i) => ({
        user_id: userId,
        fact: f,
        display_order: i,
      }));

      const { data: inserted, error } = await supabase
        .from("life_facts")
        .insert(rows)
        .select("id, fact");
      if (error) throw error;

      (inserted || []).forEach((row: { id: string; fact: string }) => {
        void embedAndStore("life_facts", row.id, row.fact);
      });

      navigation.navigate("AddPeople", { userId });
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
          title="Life Facts"
          sub="Things they should be gently reminded of"
        />
      </AnimatedEntrance>

      <View style={styles.body}>
        <AnimatedEntrance index={1}>
          <AddRow
            value={draft}
            onChange={setDraft}
            onAdd={addFact}
            placeholder='e.g. "You retired from teaching in 2015"'
          />
        </AnimatedEntrance>

        <View>
          {facts.map((f, i) => (
            <AnimatedEntrance key={f + i} index={i + 2}>
              <FactChip text={f} onRemove={() => removeFact(i)} />
            </AnimatedEntrance>
          ))}
        </View>

        <AnimatedEntrance index={facts.length + 3}>
          <FlowButton
            label={
              facts.length === 0
                ? "Skip for now"
                : `Save ${facts.length} fact${facts.length > 1 ? "s" : ""}`
            }
            onPress={handleNext}
            disabled={loading}
          />
        </AnimatedEntrance>
      </View>
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
  body: {
    marginTop: 22,
  },
});
