import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import Icon from "../../components/Icon";
import { colors, radius } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface LifeFact {
  id: string;
  fact: string;
  display_order: number;
}

export default function ViewLifeFactsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [facts, setFacts] = useState<LifeFact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFacts();
  }, []);

  async function loadFacts() {
    if (!userId) return;
    const { data } = await supabase
      .from("life_facts")
      .select("id, fact, display_order")
      .eq("user_id", userId)
      .order("display_order");

    setFacts(data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading life facts…" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={10}
          >
            <Icon name="back" size={20} color={colors.primarySoft} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.eyebrow}>Helper dashboard</Text>
        <Text style={styles.title}>Life Facts</Text>
        <Text style={styles.subtitle}>
          {facts.length} fact{facts.length !== 1 ? "s" : ""} saved
        </Text>
      </AnimatedEntrance>

      {facts.length === 0 ? (
        <AnimatedEntrance index={1}>
          <AliveEmptyState
            message="No life facts added yet"
            caption="Add important details your loved one should know about their life."
          />
        </AnimatedEntrance>
      ) : (
        <View style={styles.list}>
          {facts.map((f, index) => (
            <AnimatedEntrance key={f.id} index={index} cardMode>
              <SpringPressable cardMode>
                <View style={styles.factCard}>
                  <Text style={styles.factLabel}>Life fact</Text>
                  <Text style={styles.factText}>{f.fact}</Text>
                </View>
              </SpringPressable>
            </AnimatedEntrance>
          ))}
        </View>
      )}

      <AnimatedEntrance index={Math.max(facts.length, 1) + 1} style={styles.addWrap}>
        <ShimmerButton
          hero
          icon="add"
          label="Add More Life Facts"
          onPress={() => navigation.navigate("AddLifeFacts", { userId })}
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
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
    paddingTop: 64,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: 16,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 15,
    color: colors.primarySoft,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.fg,
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.fgMuted,
    marginBottom: 18,
  },
  list: {
    gap: 12,
  },
  factCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
  },
  factLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    fontWeight: "700",
    marginBottom: 8,
  },
  factText: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.fg,
  },
  addWrap: {
    marginTop: 20,
  },
});
