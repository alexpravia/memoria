/**
 * Shared layout primitives for the Add & Import flow screens.
 * Matches the memoria-motion.html "Add & Import" design group exactly.
 */

import React, { ReactNode, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SpringPressable } from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import Icon from "../../components/Icon";
import { colors, radius } from "@memoria/core";

// Slightly purple-tinted muted colour used in the design for subtitles / counts.
export const MUTE = "#9a9ab0";

// ── FlowNav ──────────────────────────────────────────────────────────────────
// Back chevron (lavender) + close X (muted) as circular icon buttons.

interface FlowNavProps {
  onBack: () => void;
  onClose: () => void;
}

export function FlowNav({ onBack, onClose }: FlowNavProps) {
  return (
    <View style={styles.flowNav}>
      <SpringPressable onPress={onBack} style={styles.navBtn}>
        <Icon name="back" size={22} color={colors.primarySoft} />
      </SpringPressable>
      <SpringPressable onPress={onClose} style={styles.navBtn}>
        <Icon name="close" size={20} color={MUTE} />
      </SpringPressable>
    </View>
  );
}

// ── FlowHeader ────────────────────────────────────────────────────────────────
// Screen title (fg white) + subtitle (muted purple).

interface FlowHeaderProps {
  title: string;
  sub: string;
}

export function FlowHeader({ title, sub }: FlowHeaderProps) {
  return (
    <View style={styles.flowHeader}>
      <Text style={styles.flowTitle}>{title}</Text>
      <Text style={styles.flowSub}>{sub}</Text>
    </View>
  );
}

// ── FocusField ────────────────────────────────────────────────────────────────
// Text input with a purple glow border when focused.

interface FocusFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  onSubmit?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function FocusField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  onSubmit,
  style,
}: FocusFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.fieldGroup, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.fieldWrap, focused && styles.fieldFocused]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={colors.fgMuted}
          multiline={multiline}
          style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        />
      </View>
    </View>
  );
}

// ── AddRow ────────────────────────────────────────────────────────────────────
// Text field + purple round add button in a row.

interface AddRowProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onAdd: () => void;
}

export function AddRow({ value, onChange, placeholder, onAdd }: AddRowProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.addRow}>
      <View style={[styles.addFieldWrap, focused && styles.fieldFocused, { flex: 1 }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onAdd}
          placeholder={placeholder}
          placeholderTextColor={colors.fgMuted}
          style={styles.fieldInput}
        />
      </View>
      <SpringPressable onPress={onAdd} style={styles.addBtn}>
        <Icon name="add" size={24} color="#fff" accentColor="#fff" />
      </SpringPressable>
    </View>
  );
}

// ── FactChip ──────────────────────────────────────────────────────────────────
// A lavender-bullet chip with text and a red close button.

interface FactChipProps {
  text: string;
  onRemove: () => void;
}

export function FactChip({ text, onRemove }: FactChipProps) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipBullet} />
      <Text style={styles.chipText} numberOfLines={2}>{text}</Text>
      <SpringPressable onPress={onRemove} style={styles.chipClose}>
        <Icon name="close" size={16} color={colors.danger} />
      </SpringPressable>
    </View>
  );
}

// ── ObCheck ───────────────────────────────────────────────────────────────────
// Circular checkbox; filled + check icon when on.

export function ObCheck({ on }: { on: boolean }) {
  return (
    <View style={[styles.checkCircle, on && styles.checkCircleOn]}>
      {on && <Icon name="check" size={14} color="#fff" accentColor="#fff" />}
    </View>
  );
}

// ── FlowButton ────────────────────────────────────────────────────────────────
// Primary shimmer button for the bottom of a flow screen.

interface FlowButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FlowButton({ label, onPress, disabled, secondary, style }: FlowButtonProps) {
  return (
    <ShimmerButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      hero={!secondary}
      style={[
        styles.flowBtn,
        secondary && { backgroundColor: colors.primaryDeep },
        style,
      ]}
    />
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────
// Sunken card that wraps a form section.

export function SectionCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

// ── SectionTitle ──────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// ── AddSubButton ──────────────────────────────────────────────────────────────
// Smaller action button inside a form card (deep purple).

interface AddSubButtonProps {
  label: string;
  icon?: "addPerson" | "add";
  onPress: () => void;
}

export function AddSubButton({ label, icon, onPress }: AddSubButtonProps) {
  return (
    <SpringPressable onPress={onPress} style={styles.subBtn}>
      {icon ? <Icon name={icon} size={18} color="#fff" accentColor="#fff" /> : null}
      <Text style={styles.subBtnText}>{label}</Text>
    </SpringPressable>
  );
}

// ── TypeSegment ───────────────────────────────────────────────────────────────
// Segmented control for event type.

interface TypeSegmentProps<T extends string> {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}

export function TypeSegment<T extends string>({ value, options, onChange }: TypeSegmentProps<T>) {
  return (
    <View style={styles.typeRow}>
      {options.map((opt) => (
        <SpringPressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[
            styles.typeBtn,
            value === opt.value && styles.typeBtnActive,
          ]}
        >
          <Text
            style={[
              styles.typeBtnText,
              value === opt.value && styles.typeBtnTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </SpringPressable>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flowNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  flowHeader: {
    marginBottom: 4,
  },
  flowTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.fg,
    lineHeight: 38,
  },
  flowSub: {
    fontSize: 15,
    color: MUTE,
    marginTop: 4,
    lineHeight: 21,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.primarySoft,
    marginBottom: 7,
  },
  fieldWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: "#30305a",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 0.4,
  },
  fieldInput: {
    color: colors.fgStrong,
    fontSize: 16.5,
    padding: 0,
    margin: 0,
  },
  fieldInputMulti: {
    height: 78,
    textAlignVertical: "top",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 14,
  },
  addFieldWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
  },
  addBtn: {
    width: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    shadowOpacity: 0.35,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chipBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    flexShrink: 0,
  },
  chipText: {
    flex: 1,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
  },
  chipClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4a4a68",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    flexShrink: 0,
  },
  checkCircleOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flowBtn: {
    marginTop: 18,
  },
  sectionCard: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: colors.fg,
    marginBottom: 16,
  },
  subBtn: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.sm,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  subBtnText: {
    color: "#fff",
    fontSize: 15.5,
    fontWeight: "600",
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
  },
  typeBtnText: {
    color: MUTE,
    fontSize: 13,
    fontWeight: "600",
  },
  typeBtnTextActive: {
    color: "#fff",
  },
});
