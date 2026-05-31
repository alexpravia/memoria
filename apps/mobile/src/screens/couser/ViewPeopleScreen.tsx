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
import { supabase } from "@memoria/core";
import { useAuth } from "@memoria/core";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { Avatar, ShimmerButton } from "../../motion/ui";
import Icon from "../../components/Icon";
import { colors, radius } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface Person {
  id: string;
  full_name: string;
  relationship: string;
  key_facts: string[];
  emotional_notes: string | null;
}

export default function ViewPeopleScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadPeople();
    });
    return unsubscribe;
  }, [navigation, userId]);

  async function loadPeople() {
    if (!userId) return;
    const { data } = await supabase
      .from("people")
      .select("id, full_name, relationship, key_facts, emotional_notes")
      .eq("user_id", userId)
      .order("full_name");

    setPeople(data || []);
    setLoading(false);
  }

  function confirmDelete(person: Person) {
    Alert.alert(
      `Delete ${person.full_name}?`,
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePerson(person.id),
        },
      ]
    );
  }

  async function deletePerson(personId: string) {
    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", personId);

    if (error) {
      Alert.alert("Error", "Failed to delete. Please try again.");
      return;
    }

    setPeople((prev) => prev.filter((p) => p.id !== personId));
  }

  if (loading) {
    return (
      <View testID="view-people-loading" style={styles.centered}>
        <BrandLoader caption="Loading people…" />
      </View>
    );
  }

  return (
    <ScrollView testID="view-people-screen" style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="people-back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back from people list"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="back" size={22} color={colors.primarySoft} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title} testID="people-title">People</Text>
        <Text style={styles.subtitle} testID="people-subtitle">
          {people.length} {people.length === 1 ? "person" : "people"} saved
        </Text>
      </AnimatedEntrance>

      {people.length === 0 ? (
        <AnimatedEntrance index={1}>
          <View testID="people-empty-state">
            <AliveEmptyState
              message="No people yet"
              caption="Add the people who matter most in your loved one's life."
            />
          </View>
        </AnimatedEntrance>
      ) : (
        <>
          <AnimatedEntrance index={1}>
            <ShimmerButton
              icon="addPerson"
              label="Add a person"
              onPress={() => navigation.navigate("AddPeople", { userId })}
              style={styles.addButton}
            />
          </AnimatedEntrance>

          {people.map((p, index) => (
            <AnimatedEntrance key={p.id} index={index + 2} cardMode>
              <SpringPressable
                cardMode
                onPress={() => navigation.navigate("EditPerson", { personId: p.id })}
                onLongPress={() => confirmDelete(p)}
                style={styles.personCard}
              >
                <View
                  testID={`person-card-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${p.full_name}`}
                  style={styles.personRow}
                >
                  <Avatar initial={p.full_name[0] ?? "?"} seed={p.full_name} />
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{p.full_name}</Text>
                    {p.relationship ? (
                      <Text style={styles.personRelation} numberOfLines={1}>
                        {p.relationship}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    testID={`delete-person-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${p.full_name}`}
                    onPress={() => confirmDelete(p)}
                    hitSlop={10}
                    style={styles.deleteButton}
                  >
                    <Icon name="trash" size={18} color={colors.dangerAlt} />
                  </TouchableOpacity>
                  <Icon name="forward" size={20} color={colors.fgMuted} />
                </View>
              </SpringPressable>
            </AnimatedEntrance>
          ))}
        </>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.fg,
  },
  subtitle: {
    fontSize: 15,
    color: colors.fgMuted,
    marginTop: 4,
  },
  addButton: {
    marginTop: 16,
    marginBottom: 4,
  },
  personCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  personRow: {
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
  personRelation: {
    fontSize: 14,
    color: colors.fgMuted,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
});
