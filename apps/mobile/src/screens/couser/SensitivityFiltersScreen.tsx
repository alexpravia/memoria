import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
  AliveEmptyState,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@memoria/core";
import { embedAndStore } from "@memoria/core";
import { useAuth } from "@memoria/core";
import Icon, { IconName } from "../../components/Icon";
import { colors, radius, type } from "@memoria/core";
import { SensitivityFilter, Person } from "@memoria/core";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type FilterType = "person" | "topic" | "time_period" | "intent";

// ---------- FocusField ----------
// A theme-token text input that blooms a purple focus glow when focused,
// mirroring the prototype's FormField. Wraps the same TextInput so all
// existing value/onChangeText/placeholder/multiline logic flows through.
interface FocusFieldProps {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
}

function FocusField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
}: FocusFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.fieldBox, focused && styles.fieldBoxFocus]}>
        <TextInput
          style={[
            styles.fieldInput,
            multiline && styles.fieldInputMultiline,
            minHeight ? { minHeight } : null,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.fgMutedDim}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

export default function SensitivityFiltersScreen({ navigation }: Props) {
  const { userId, coUserId } = useAuth();
  const [filters, setFilters] = useState<SensitivityFilter[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // New filter form state
  const [adding, setAdding] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("topic");
  const [filterValue, setFilterValue] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [intentText, setIntentText] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!userId) return;

    const { data: filtersData } = await supabase
      .from("sensitivity_filters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filtersData) setFilters(filtersData);

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .eq("user_id", userId);

    if (peopleData) setPeople(peopleData);

    setLoading(false);
  }

  async function addFilter() {
    if (!userId) return;

    if (filterType === "person" && !selectedPersonId) {
      Alert.alert("Select a person", "Choose which person to filter out.");
      return;
    }

    if (filterType === "topic" && !filterValue.trim()) {
      Alert.alert("Enter a topic", "Describe the topic to avoid.");
      return;
    }

    if (filterType === "time_period" && (!startDate.trim() || !endDate.trim())) {
      Alert.alert("Enter dates", "Provide both a start and end date (YYYY-MM-DD).");
      return;
    }

    if (filterType === "intent" && !intentText.trim()) {
      Alert.alert(
        "Describe the rule",
        "Write what to avoid in plain language (e.g., 'anything about Mom's death')."
      );
      return;
    }

    let value = filterValue.trim();
    if (filterType === "person") {
      const person = people.find((p) => p.id === selectedPersonId);
      value = person ? person.full_name : "Unknown";
    }
    if (filterType === "time_period") {
      value = `${startDate.trim()} to ${endDate.trim()}`;
    }
    if (filterType === "intent") {
      value = intentText.trim();
    }

    const { data: inserted, error } = await supabase
      .from("sensitivity_filters")
      .insert({
        user_id: userId,
        filter_type: filterType,
        filter_value: value,
        person_id: filterType === "person" ? selectedPersonId : null,
        start_date: filterType === "time_period" ? startDate.trim() : null,
        end_date: filterType === "time_period" ? endDate.trim() : null,
        notes: notes.trim() || null,
        created_by: coUserId,
        intent_text: filterType === "intent" ? intentText.trim() : null,
      })
      .select("id")
      .single();

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    // Fire-and-forget: embed the intent text so future semantic lookups
    // can use it. We intentionally don't await so the save flow stays
    // snappy even if the embed function is slow or fails.
    if (filterType === "intent" && inserted?.id) {
      embedAndStore(
        // `sensitivity_filters` is not in the EmbeddingKind union, so cast.
        "sensitivity_filters" as any,
        inserted.id as string,
        intentText.trim()
      ).catch(() => {
        /* intentionally swallowed — embed failures must not break save */
      });
    }

    // Reset form and reload
    setAdding(false);
    setFilterValue("");
    setSelectedPersonId(null);
    setStartDate("");
    setEndDate("");
    setNotes("");
    setIntentText("");
    loadData();
  }

  async function deleteFilter(id: string) {
    Alert.alert("Remove Filter", "Are you sure you want to remove this filter?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("sensitivity_filters").delete().eq("id", id);
          loadData();
        },
      },
    ]);
  }

  function getFilterIconName(filterType: FilterType): IconName {
    switch (filterType) {
      case "person":     return "addPerson";
      case "topic":      return "safety";
      case "time_period": return "calendar";
      case "intent":     return "memo";
    }
  }

  function getFilterLabel(type: FilterType) {
    switch (type) {
      case "person":
        return "Person";
      case "topic":
        return "Topic";
      case "time_period":
        return "Time Period";
      case "intent":
        return "Free-text";
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading filters…" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedEntrance index={0}>
        <SpringPressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="back" size={20} color={colors.primarySoft} />
          <Text style={styles.backText}>Back</Text>
        </SpringPressable>

        <Text style={styles.title}>Sensitivity Filters</Text>
        <Text style={styles.subtitle}>What Memo gently holds back</Text>
      </AnimatedEntrance>

      {/* Existing filters */}
      {filters.length === 0 && !adding && (
        <AnimatedEntrance index={1}>
          <AliveEmptyState
            message="No filters set yet"
            caption="Tap below to add a boundary for what the AI can show."
          />
        </AnimatedEntrance>
      )}

      {filters.map((filter, index) => {
        const ftype = filter.filter_type as FilterType;
        const isIntent = ftype === "intent";
        const intentText = (filter as any).intent_text as string | null | undefined;
        const displayValue = isIntent
          ? intentText || filter.filter_value
          : filter.filter_value;
        return (
          <AnimatedEntrance key={filter.id} index={index + 1} cardMode>
            <View style={styles.filterCard}>
              <View style={styles.filterIconBubble}>
                <Icon name={getFilterIconName(ftype)} size={20} color={colors.primarySoft} />
              </View>
              <View style={styles.filterInfo}>
                <Text style={styles.filterType}>{getFilterLabel(ftype)}</Text>
                <Text style={[styles.filterValue, isIntent && styles.intentValue]}>
                  {isIntent ? `Intent: ${displayValue}` : displayValue}
                </Text>
                {filter.notes && <Text style={styles.filterNotes}>{filter.notes}</Text>}
              </View>
              <SpringPressable onPress={() => deleteFilter(filter.id)} style={styles.deleteButton}>
                <Icon name="trash" size={20} color={colors.danger} />
              </SpringPressable>
            </View>
          </AnimatedEntrance>
        );
      })}

      {/* Add filter form */}
      {adding ? (
        <AnimatedEntrance index={filters.length + 1}>
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>New Filter</Text>

            {/* Type selector — pills */}
            <View style={styles.typeRow}>
              {(["topic", "person", "time_period", "intent"] as FilterType[]).map((typeOpt) => {
                const active = filterType === typeOpt;
                return (
                  <SpringPressable
                    key={typeOpt}
                    onPress={() => {
                      setFilterType(typeOpt);
                      setFilterValue("");
                      setSelectedPersonId(null);
                      setStartDate("");
                      setEndDate("");
                      setIntentText("");
                    }}
                    style={[styles.typePill, active && styles.typePillActive]}
                  >
                    <View style={styles.typePillInner}>
                      <Icon
                        name={getFilterIconName(typeOpt)}
                        size={14}
                        color={active ? colors.fgStrong : colors.primarySoft}
                      />
                      <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
                        {getFilterLabel(typeOpt)}
                      </Text>
                    </View>
                  </SpringPressable>
                );
              })}
            </View>

            {/* Type-specific input */}
            {filterType === "topic" && (
              <FocusField
                placeholder="e.g., the hospital, Uncle Robert"
                value={filterValue}
                onChangeText={setFilterValue}
              />
            )}

            {filterType === "person" && (
              <View>
                {people.length === 0 ? (
                  <Text style={styles.emptyText}>No people added yet. Add people first.</Text>
                ) : (
                  people.map((person) => {
                    const selected = selectedPersonId === person.id;
                    return (
                      <SpringPressable
                        key={person.id}
                        onPress={() => setSelectedPersonId(person.id)}
                        style={[styles.personOption, selected && styles.personOptionActive]}
                      >
                        <Text style={styles.personOptionText}>
                          {person.full_name} — {person.relationship}
                        </Text>
                        {selected && (
                          <Icon name="check" size={18} color={colors.primary} />
                        )}
                      </SpringPressable>
                    );
                  })
                )}
              </View>
            )}

            {filterType === "time_period" && (
              <View>
                <FocusField
                  placeholder="Start date (YYYY-MM-DD)"
                  value={startDate}
                  onChangeText={setStartDate}
                />
                <FocusField
                  placeholder="End date (YYYY-MM-DD)"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            )}

            {filterType === "intent" && (
              <FocusField
                placeholder="Describe what to avoid (e.g., 'anything about Mom's death' or 'don't bring up the hospital')."
                value={intentText}
                onChangeText={setIntentText}
                multiline
                minHeight={80}
              />
            )}

            {/* Notes */}
            <FocusField
              placeholder="Why? (optional — for your reference)"
              value={notes}
              onChangeText={setNotes}
              multiline
              minHeight={60}
            />

            {/* Actions */}
            <View style={styles.formActions}>
              <SpringPressable
                style={styles.cancelButton}
                onPress={() => {
                  setAdding(false);
                  setFilterValue("");
                  setSelectedPersonId(null);
                  setStartDate("");
                  setEndDate("");
                  setNotes("");
                  setIntentText("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </SpringPressable>
              <View style={styles.saveButtonWrap}>
                <ShimmerButton label="Save filter" icon="check" onPress={addFilter} />
              </View>
            </View>
          </View>
        </AnimatedEntrance>
      ) : (
        <AnimatedEntrance index={filters.length + 1} style={styles.addButtonWrap}>
          <ShimmerButton
            hero
            label="Add Sensitivity Filter"
            icon="add"
            onPress={() => setAdding(true)}
          />
        </AnimatedEntrance>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 40,
    paddingTop: 80,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.primarySoft,
    fontSize: type.base,
  },
  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.fgStrong,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: type.base,
    color: colors.fgMuted,
    marginBottom: 28,
    lineHeight: 22,
  },
  emptyText: {
    color: colors.fgMutedDim,
    fontSize: type.sm,
    textAlign: "center",
    marginVertical: 24,
  },

  // Filter card
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  filterIconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  filterInfo: {
    flex: 1,
  },
  filterType: {
    fontSize: type.xs,
    color: colors.primarySoft,
    fontWeight: type.weightBold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  filterValue: {
    fontSize: type.md,
    color: colors.fg,
    fontWeight: type.weightMedium,
  },
  filterNotes: {
    fontSize: type.xs,
    color: colors.fgMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  intentValue: {
    fontStyle: "italic",
  },
  deleteButton: {
    padding: 6,
  },

  // Form
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 16,
  },
  formTitle: {
    fontSize: type.xl,
    fontWeight: type.weightBold,
    color: colors.fgStrong,
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
  },
  typePillActive: {
    backgroundColor: colors.primary,
  },
  typePillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typePillText: {
    color: colors.fgMuted,
    fontSize: type.xs,
    fontWeight: type.weightMedium,
  },
  typePillTextActive: {
    color: colors.fgStrong,
  },

  // FocusField
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: type.xs,
    fontWeight: type.weightBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginBottom: 7,
  },
  fieldBox: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  fieldBoxFocus: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  fieldInput: {
    fontSize: type.base,
    color: colors.fgStrong,
    paddingVertical: 11,
  },
  fieldInputMultiline: {
    textAlignVertical: "top",
    paddingTop: 11,
  },

  // Person option
  personOption: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  personOptionActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  personOptionText: {
    color: colors.fg,
    fontSize: type.base,
    flex: 1,
  },

  // Form actions
  formActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
  },
  cancelButtonText: {
    color: colors.fgMuted,
    fontSize: type.base,
    fontWeight: type.weightMedium,
  },
  saveButtonWrap: {
    flex: 1,
  },

  addButtonWrap: {
    marginTop: 16,
  },
});
