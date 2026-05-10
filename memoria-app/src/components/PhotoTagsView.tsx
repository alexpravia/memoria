import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  description?: string | null;
  tags?: string[];
  peopleNames?: string[];
  /**
   * When true, render with dense/small styles suitable for an
   * overlay on top of an image. Defaults to false (full styling).
   */
  compact?: boolean;
}

/**
 * Pure display component for AI-generated photo metadata.
 * Renders an optional description paragraph, tag pills, and a list of
 * tagged people. Self-contained — receives all data as props.
 */
export default function PhotoTagsView({
  description,
  tags,
  peopleNames,
  compact = false,
}: Props) {
  const hasDescription = !!description && description.trim().length > 0;
  const hasTags = !!tags && tags.length > 0;
  const hasPeople = !!peopleNames && peopleNames.length > 0;

  if (!hasDescription && !hasTags && !hasPeople) {
    return null;
  }

  const s = compact ? compactStyles : styles;

  return (
    <View style={s.container}>
      {hasDescription && (
        <Text style={s.description}>{description}</Text>
      )}

      {hasTags && (
        <ScrollView
          horizontal
          // Show the indicator in compact mode so the user can see the
          // overflow slider when tags run past the overlay edge.
          showsHorizontalScrollIndicator={compact}
          indicatorStyle="white"
          contentContainerStyle={s.chipsRow}
        >
          {tags!.map((tag, i) => (
            <View key={`${tag}-${i}`} style={s.chip}>
              <Text style={s.chipText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {hasPeople && (
        <Text style={s.peopleLine}>
          People in this photo: {peopleNames!.join(", ")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  description: {
    color: "#e0e0e0",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: "#7c4dff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  peopleLine: {
    color: "#b388ff",
    fontSize: 14,
    marginTop: 12,
    fontStyle: "italic",
  },
});

const compactStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  description: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "#7c4dff",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  chipText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  peopleLine: {
    color: "#d1c4e9",
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
});
