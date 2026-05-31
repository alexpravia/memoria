/**
 * Shared UI primitives for the Memoria motion system.
 *
 * Gradient avatars, a shimmering primary button, an animated toggle Switch,
 * and a display-only Slider. Every animation respects the Intensity setting
 * (Off/Subtle/Calm/Rich) via useIntensity() — when intensity is Off these
 * render fully static (no shimmer, instant knob, no glow).
 *
 * Base durations match the motion keyframe table; they're divided by `speed`
 * at runtime so Subtle (speed=0.5) sweeps slower/calmer than Calm (1).
 */

import React, { ReactNode, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
  LayoutChangeEvent,
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
import { LinearGradient } from "expo-linear-gradient";
import Icon, { IconName } from "../components/Icon";
import { useIntensity } from "./IntensityContext";
import { colors, radius } from "@memoria/core";

// Overshoot spring shared across press / knob motion.
const SPRING = { damping: 12, stiffness: 350, mass: 0.8 };

// ---------- avatarColors ----------
// Deterministic gradient pair from a string hash. Always returns one of the
// six brand pairs below, so the same seed always maps to the same gradient.

const AVATAR_PAIRS: [string, string][] = [
  ["#7c4dff", "#b388ff"],
  ["#5e92d8", "#8fc0e8"],
  ["#4caf50", "#8fd49a"],
  ["#e0a06a", "#f0c89a"],
  ["#9c6bff", "#c9a8ff"],
  ["#7c4dff", "#5e35b1"],
];

export function avatarColors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  const idx = Math.abs(hash) % AVATAR_PAIRS.length;
  return AVATAR_PAIRS[idx];
}

// ---------- Avatar ----------
// Gradient circle with a centered white initial.

interface AvatarProps {
  initial: string;
  seed?: string;
  size?: number;
}

export function Avatar({ initial, seed, size = 46 }: AvatarProps) {
  const gradient = avatarColors(seed ?? initial);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        colors={gradient}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.avatarCenter}>
        <Text
          style={[
            styles.avatarInitial,
            { fontSize: size * 0.4 },
          ]}
        >
          {initial}
        </Text>
      </View>
    </View>
  );
}

// ---------- ShimmerButton ----------
// Primary action button. A diagonal white-translucent strip sweeps across it
// when intensity is on; the whole button springs down on press. `hero` adds a
// purple glow. Pass children to fully override the default icon+label row.

interface ShimmerButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
  icon?: IconName;
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function ShimmerButton({
  onPress,
  disabled = false,
  label,
  icon,
  hero = false,
  style,
  children,
}: ShimmerButtonProps) {
  const { on, speed } = useIntensity();
  const [width, setWidth] = useState(0);

  const scale = useSharedValue(1);
  const shimmerX = useSharedValue(0);

  // Sweep the shimmer strip across the measured button width.
  useEffect(() => {
    if (!on || width === 0) {
      cancelAnimation(shimmerX);
      shimmerX.value = 0;
      return;
    }
    const dur = 4500 / speed; // base 4.5 s, divided by speed
    shimmerX.value = -1.6 * width; // start off the left edge (-160%)
    shimmerX.value = withDelay(
      1200, // ~1.2 s initial delay before the first sweep
      withRepeat(
        withSequence(
          withTiming(3.2 * width, {
            duration: dur,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(-1.6 * width, { duration: 0 })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(shimmerX);
  }, [on, speed, width]);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { skewX: "-12deg" }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onLayout={onLayout}
      onPressIn={() => {
        if (on) scale.value = withSpring(0.965, SPRING);
      }}
      onPressOut={() => {
        if (on) scale.value = withSpring(1, SPRING);
      }}
    >
      <Animated.View
        style={[
          styles.shimmerBtn,
          hero && styles.shimmerBtnHero,
          disabled && styles.shimmerBtnDisabled,
          scaleStyle,
          style,
        ]}
      >
        {children ? (
          children
        ) : (
          <View style={styles.shimmerRow}>
            {icon ? (
              <Icon name={icon} size={20} color="#fff" accentColor="#fff" />
            ) : null}
            {label ? <Text style={styles.shimmerLabel}>{label}</Text> : null}
          </View>
        )}

        {on ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.shimmerStrip, shimmerStyle]}
          >
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              colors={["transparent", "rgba(255,255,255,0.28)", "transparent"]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ---------- Switch ----------
// Animated track + knob toggle. Knob springs between left/right; track color
// crossfades to primary when on. Instant (no animation) when intensity is Off.

interface SwitchProps {
  value: boolean;
  onToggle: () => void;
}

export function Switch({ value, onToggle }: SwitchProps) {
  const { on } = useIntensity();
  const left = useSharedValue(value ? 23 : 3);

  useEffect(() => {
    const target = value ? 23 : 3;
    if (on) {
      left.value = withSpring(target, SPRING);
    } else {
      left.value = target;
    }
  }, [value, on]);

  const knobStyle = useAnimatedStyle(() => ({
    left: left.value,
  }));

  return (
    <Pressable onPress={onToggle}>
      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? colors.primary : colors.surfaceRaised },
        ]}
      >
        <Animated.View style={[styles.switchKnob, knobStyle]} />
      </View>
    </Pressable>
  );
}

// ---------- Slider ----------
// Display-only progress slider (value 0..1). The fill glows when intensity
// is on; a white thumb sits centered at the value position.

interface SliderProps {
  value: number;
}

export function Slider({ value }: SliderProps) {
  const { on } = useIntensity();
  const clamped = Math.max(0, Math.min(1, value));
  const pct: DimensionValue = `${clamped * 100}%`;

  return (
    <View style={styles.sliderTrack}>
      <View
        style={[
          styles.sliderFill,
          { width: pct },
          on && styles.sliderFillGlow,
        ]}
      />
      <View style={[styles.sliderThumb, { left: pct }]} />
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  // Avatar
  avatarCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ShimmerButton
  shimmerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, // 16
    overflow: "hidden",
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  shimmerBtnHero: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  shimmerBtnDisabled: {
    opacity: 0.5,
  },
  shimmerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  shimmerLabel: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  shimmerStrip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "55%",
  },

  // Switch
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
  },
  switchKnob: {
    position: "absolute",
    top: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  // Slider
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunk,
    justifyContent: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  sliderFillGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10, // center horizontally on the value position
    top: -7, // vertically center on the 6px track
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
