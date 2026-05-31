import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  AnimatedEntrance,
  SpringPressable,
  BrandLoader,
} from "../../motion/primitives";
import { ShimmerButton } from "../../motion/ui";
import { useIntensity } from "../../motion/IntensityContext";
import Icon from "../../components/Icon";
import { colors, radius, border, type } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

// ---------- Heartbeat halo ----------
// A slow, reassuring pulse ring expands behind the identity icon (base 4s,
// staggered ×2). Mirrors the prototype's `m-halo` treatment. Static when off.
function HeartbeatHalo() {
  const { on, speed } = useIntensity();
  const scale1 = useSharedValue(1);
  const opacity1 = useSharedValue(0.5);
  const scale2 = useSharedValue(1);
  const opacity2 = useSharedValue(0);

  useEffect(() => {
    if (!on) {
      opacity1.value = 0;
      opacity2.value = 0;
      return;
    }
    const dur = 4000 / speed; // base 4s per ring cycle

    scale1.value = withRepeat(
      withTiming(2.1, { duration: dur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    opacity1.value = withRepeat(
      withTiming(0, { duration: dur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Second ring starts halfway through the first cycle.
    scale2.value = withDelay(
      dur / 2,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1 }),
          withTiming(2.1, { duration: dur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );
    opacity2.value = withDelay(
      dur / 2,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1 }),
          withTiming(0, { duration: dur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(scale1);
      cancelAnimation(opacity1);
      cancelAnimation(scale2);
      cancelAnimation(opacity2);
    };
  }, [on, speed]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  return (
    <View style={styles.haloWrap}>
      <Animated.View style={[styles.halo, ring1Style]} />
      <Animated.View style={[styles.halo, ring2Style]} />
      <View style={styles.identityIcon}>
        <Icon name="whoAmI" size={32} color={colors.primarySoft} />
      </View>
    </View>
  );
}

export default function EmergencyContactSettingsScreen({ navigation }: Props) {
  const { coUserId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);

  const { on, speed } = useIntensity();

  // Very slow breathing glow on the protective accent border (base 6s).
  const borderGlow = useSharedValue(0);
  useEffect(() => {
    if (!on) {
      borderGlow.value = 0;
      return;
    }
    const dur = 6000 / speed;
    borderGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: dur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(borderGlow);
  }, [on, speed]);

  const cardGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.18 + borderGlow.value * 0.32,
    shadowRadius: 12 + borderGlow.value * 12,
  }));

  // Focus glow on the phone input.
  const focusGlow = useSharedValue(0);
  useEffect(() => {
    const target = focused ? 1 : 0;
    if (on) {
      focusGlow.value = withTiming(target, { duration: 400 / speed });
    } else {
      focusGlow.value = target;
    }
  }, [focused, on, speed]);

  const inputGlowStyle = useAnimatedStyle(() => ({
    borderColor:
      focusGlow.value > 0.5 ? colors.primary : colors.surfaceRaised,
    shadowOpacity: focusGlow.value * 0.45,
    shadowRadius: focusGlow.value * 18,
  }));

  useEffect(() => {
    loadContactPhone();
  }, [coUserId]);

  async function loadContactPhone() {
    if (!coUserId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("co_users")
      .select("phone")
      .eq("id", coUserId)
      .single();

    if (!error && data?.phone) {
      setPhone(data.phone);
    }
    setLoading(false);
  }

  async function savePhone() {
    if (!coUserId) return;
    if (!phone.trim()) {
      Alert.alert("Please enter a phone number.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("co_users")
      .update({ phone: phone.trim() })
      .eq("id", coUserId);
    setSaving(false);

    if (error) {
      Alert.alert("Error", error.message || "Failed to save phone number.");
      return;
    }

    Alert.alert("Saved", "Emergency phone number updated.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader caption="Loading…" />
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
      </AnimatedEntrance>

      {/* Identity icon with reassuring heartbeat halo */}
      <AnimatedEntrance index={1} style={styles.haloEntrance}>
        <HeartbeatHalo />
      </AnimatedEntrance>

      <AnimatedEntrance index={2}>
        <Text style={styles.title}>Emergency Contact</Text>
        <Text style={styles.subtitle}>
          This phone number appears in "Who Am I?" above your email.
        </Text>
      </AnimatedEntrance>

      {/* Protective accent card with breathing glow */}
      <AnimatedEntrance index={3}>
        <Animated.View style={[styles.card, cardGlowStyle]}>
          <Text style={styles.label}>YOUR PHONE NUMBER *</Text>
          <Animated.View style={[styles.inputWrap, inputGlowStyle]}>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g., (305) 555-0199"
              placeholderTextColor={colors.fgMuted}
              keyboardType="phone-pad"
            />
          </Animated.View>
        </Animated.View>
      </AnimatedEntrance>

      <AnimatedEntrance index={4}>
        <ShimmerButton
          hero
          disabled={saving}
          onPress={savePhone}
          style={styles.saveButton}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.saveRow}>
              <Icon name="call" size={20} color="#fff" accentColor="#fff" />
              <Text style={styles.saveButtonText}>Save Phone Number</Text>
            </View>
          )}
        </ShimmerButton>
      </AnimatedEntrance>
    </ScrollView>
  );
}

const HALO_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 40,
    paddingTop: 70,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backText: {
    color: colors.primarySoft,
    fontSize: type.base,
    fontWeight: type.weightMedium,
  },

  // Heartbeat halo
  haloEntrance: {
    alignItems: "center",
    marginBottom: 24,
  },
  haloWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.primary + "55",
  },
  identityIcon: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: type.title,
    fontWeight: type.weightBold,
    color: colors.primarySoft,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: type.base,
    color: colors.fg,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 24,
  },

  // Protective accent card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: 26,
    borderWidth: border.emphatic,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 24,
  },
  label: {
    fontSize: type.sm,
    color: colors.primarySoft,
    fontWeight: type.weightBold,
    letterSpacing: type.trackingLabel,
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.sm,
    borderWidth: border.thin,
    borderColor: colors.surfaceRaised,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    padding: 14,
    fontSize: type.lg,
    color: colors.fgStrong,
    fontWeight: type.weightMedium,
  },

  saveButton: {
    paddingVertical: 18,
  },
  saveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: type.lg,
    fontWeight: type.weightMedium,
  },
});
