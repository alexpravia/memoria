/**
 * Shared motion primitives for the Memoria motion system.
 *
 * All animations respect the Intensity setting (Off/Subtle/Calm/Rich)
 * and the OS "Reduce Motion" accessibility flag (treated as Off).
 *
 * Base durations in comments are the raw values; they're divided by
 * `speed` at runtime so Subtle (speed=0.5) is slower/calmer than Calm (1).
 */

import React, { useEffect, ReactNode } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Path } from "react-native-svg";
import Svg, { Circle } from "react-native-svg";
import { Logo } from "../components/Logo";
import { useIntensity } from "./IntensityContext";
import { colors } from "@memoria/core";

// Animated SVG Path for the drawn-check empty state.
// react-native-svg Path types don't flow cleanly through createAnimatedComponent's generics,
// so we widen to any here and rely on the explicit JSX props below for correctness.
const AnimatedPath = Animated.createAnimatedComponent(
  Path as React.ComponentType<any>
) as React.ComponentType<any>;

// Easing presets matching the keyframe table.
const RISE_EASE = Easing.bezier(0.2, 0.7, 0.3, 1);
const DRAW_EASE = Easing.bezier(0.5, 0, 0.2, 1);
const LEAVE_EASE = Easing.bezier(0.4, 0, 1, 0.6);

// Overshoot spring: approximates cubic-bezier(.34,1.56,.64,1) at ~160 ms.
const PRESS_SPRING = { damping: 12, stiffness: 350, mass: 0.8 };

// ---------- AnimatedEntrance ----------
// Wraps one child in a staggered fade-up entrance.
// Use `index` to stagger a list; `cardMode` widens the stagger slightly.

interface EntranceProps {
  children: ReactNode;
  index?: number;
  cardMode?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedEntrance({
  children,
  index = 0,
  cardMode = false,
  style,
}: EntranceProps) {
  const { on, speed } = useIntensity();
  const opacity = useSharedValue(on ? 0 : 1);
  const ty = useSharedValue(on ? 16 : 0);

  useEffect(() => {
    if (!on) {
      opacity.value = 1;
      ty.value = 0;
      return;
    }
    // base delay: 120ms (list) or 140ms (card) + per-item step, divided by speed.
    const base = cardMode ? 140 : 120;
    const step = cardMode ? 80 : 70;
    const delay = (base + index * step) / speed;
    const dur = 600 / speed; // base 600 ms
    opacity.value = withDelay(delay, withTiming(1, { duration: dur, easing: RISE_EASE }));
    ty.value = withDelay(delay, withTiming(0, { duration: dur, easing: RISE_EASE }));
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={[aStyle, style]}>{children}</Animated.View>;
}

// ---------- SpringPressable ----------
// Drop-in wrapper that adds press-scale feedback with an overshoot spring.

interface SpringPressableProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  cardMode?: boolean;
  bigButton?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SpringPressable({
  children,
  onPress,
  onLongPress,
  cardMode = false,
  bigButton = false,
  disabled = false,
  style,
}: SpringPressableProps) {
  const { on } = useIntensity();
  // Target scale on press-in per spec: cards 0.94, big buttons 0.965, default 0.96.
  const minScale = cardMode ? 0.94 : bigButton ? 0.965 : 0.96;
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => {
        if (on) scale.value = withSpring(minScale, PRESS_SPRING);
      }}
      onPressOut={() => {
        if (on) scale.value = withSpring(1, PRESS_SPRING);
      }}
    >
      <Animated.View style={[aStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------- BrandLoader ----------
// Replaces plain ActivityIndicator. The forget-me-not breathes with
// two staggered pulse rings expanding behind it, plus a glowing caption.

interface BrandLoaderProps {
  caption?: string;
  size?: number;
}

export function BrandLoader({ caption, size = 48 }: BrandLoaderProps) {
  const { on, speed } = useIntensity();

  const breathScale = useSharedValue(1);
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.55);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);
  const captionOpacity = useSharedValue(0.62);

  useEffect(() => {
    if (!on) {
      captionOpacity.value = 1;
      return;
    }

    const breathDur = 2600 / speed; // base 2.6 s per half-cycle
    const pulseDur = 2400 / speed;  // base 2.4 s per ring cycle

    // Breathing flower: scale 1 ↔ 1.06, ease-in-out, infinite.
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: breathDur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: breathDur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Ring 1: starts immediately.
    ring1Scale.value = withRepeat(
      withTiming(1.9, { duration: pulseDur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ring1Opacity.value = withRepeat(
      withTiming(0, { duration: pulseDur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Ring 2: starts at halfway through ring 1's cycle, stays invisible until then.
    ring2Scale.value = withDelay(
      pulseDur / 2,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1 }),   // snap back to start
          withTiming(1.9, { duration: pulseDur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );
    ring2Opacity.value = withDelay(
      pulseDur / 2,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1 }), // snap to visible
          withTiming(0, { duration: pulseDur, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );

    // Caption glow: opacity 0.62 ↔ 1, base 6 s half-cycle.
    if (caption) {
      captionOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 6000 / speed, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.62, { duration: 6000 / speed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }

    return () => {
      cancelAnimation(breathScale);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      cancelAnimation(captionOpacity);
    };
  }, [on, speed]);

  const ringBase = size * 1.25;
  const containerSize = size * 3;

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionOpacity.value,
  }));

  return (
    <View style={styles.loaderWrap}>
      <View style={[styles.loaderCenter, { width: containerSize, height: containerSize }]}>
        {/* Pulse rings rendered behind the flower */}
        <Animated.View
          style={[
            styles.ring,
            { width: ringBase, height: ringBase, borderRadius: ringBase / 2 },
            ring1Style,
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            { width: ringBase, height: ringBase, borderRadius: ringBase / 2 },
            ring2Style,
          ]}
        />
        {/* Breathing flower */}
        <Animated.View style={breathStyle}>
          <Logo size={size} />
        </Animated.View>
      </View>
      {caption ? (
        <Animated.Text style={[styles.loaderCaption, captionStyle]}>
          {caption}
        </Animated.Text>
      ) : null}
    </View>
  );
}

// ---------- AliveEmptyState ----------
// A never-dead empty screen. The icon floats gently; when drawCheck is
// true the check icon draws itself on (SVG stroke-dashoffset animation).
// Falls back to the brand flower when no icon is provided.

const CHECK_DASH_LEN = 26; // approximate path length for the check glyph

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  caption?: string;
  drawCheck?: boolean;
  tintColor?: string;
}

export function AliveEmptyState({
  icon,
  message,
  caption,
  drawCheck = false,
  tintColor = colors.success,
}: EmptyStateProps) {
  const { on, speed } = useIntensity();

  // Float animation: translateY 0 ↔ -8 px, base 5 s half-cycle.
  const ty = useSharedValue(0);
  // Draw-check animation: strokeDashoffset len → 0.
  const dashOffset = useSharedValue(on ? CHECK_DASH_LEN : 0);

  useEffect(() => {
    if (!on) {
      ty.value = 0;
      dashOffset.value = 0;
      return;
    }

    const floatDur = 5000 / speed;
    ty.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: floatDur, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: floatDur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    if (drawCheck) {
      dashOffset.value = CHECK_DASH_LEN;
      dashOffset.value = withDelay(
        300 / speed,
        withTiming(0, { duration: 700 / speed, easing: DRAW_EASE })
      );
    }

    return () => {
      cancelAnimation(ty);
      cancelAnimation(dashOffset);
    };
  }, [on, speed, drawCheck]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  const checkAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const circleSize = 80;

  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={floatStyle}>
        <View
          style={[
            styles.emptyCircle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              backgroundColor: tintColor + "20", // 12% tint
            },
          ]}
        >
          {drawCheck ? (
            <Svg width={52} height={52} viewBox="0 0 24 24">
              <AnimatedPath
                animatedProps={checkAnimProps}
                d="M5 12.5l4.5 4.5L19 7"
                fill="none"
                stroke={tintColor}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_DASH_LEN}
              />
            </Svg>
          ) : (
            icon ?? <Logo size={40} />
          )}
        </View>
      </Animated.View>
      <Text style={styles.emptyMessage}>{message}</Text>
      {caption ? <Text style={styles.emptyCaption}>{caption}</Text> : null}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  // BrandLoader
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loaderCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    backgroundColor: colors.primary + "33", // ~20% alpha
    borderWidth: 1.5,
    borderColor: colors.primary + "55",
  },
  loaderCaption: {
    color: colors.primarySoft,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  // AliveEmptyState
  emptyWrap: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 32,
  },
  emptyCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMessage: {
    color: colors.fgMuted,
    fontSize: 16,
    textAlign: "center",
  },
  emptyCaption: {
    color: colors.fgMutedDim,
    fontSize: 14,
    textAlign: "center",
  },
});
