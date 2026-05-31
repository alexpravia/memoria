import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Pressable,
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
  interpolateColor,
} from "react-native-reanimated";
import Svg, {
  Path,
  Circle,
  RadialGradient,
  Stop,
  Defs,
  G,
  Rect,
} from "react-native-svg";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { useIntensity } from "../../motion/IntensityContext";
import { colors } from "../../theme";

type Props = { navigation: NativeStackNavigationProp<any> };

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BUTTON_W = SCREEN_W - 80;
const SHIMMER_W = BUTTON_W * 0.55;

// Overshoot bloom easing: cubic-bezier(.34,1.42,.5,1)
const BLOOM_EASE = Easing.bezier(0.34, 1.42, 0.5, 1);
// Overshoot press spring
const PRESS_SPRING = { damping: 12, stiffness: 350, mass: 0.8 };

const PETAL =
  "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

// Animated SVG primitives for per-petal opacity.
const AnimatedPath = Animated.createAnimatedComponent(
  Path as React.ComponentType<any>
) as React.ComponentType<any>;
const AnimatedG = Animated.createAnimatedComponent(
  G as React.ComponentType<any>
) as React.ComponentType<any>;

// ── Aurora background ─────────────────────────────────────────────────────────
// Four large, very soft radial blobs that drift slowly behind the content. Each
// blob is a react-native-svg <RadialGradient> (center color → transparent ~68%)
// so the edge feathers without expo-blur. Percentage positions track the screen.

interface BlobConfig {
  color: string;
  left: number; // 0..1 fraction of screen width (center point)
  top: number; // 0..1 fraction of screen height (center point)
  size: number; // px diameter
  driftSec: number; // base drift cycle in seconds
}

// EXACT prototype blobs ("Aurora + Orbs" default).
const BLOB_CONFIGS: BlobConfig[] = [
  { color: "#5e35b1", left: 0.18, top: 0.22, size: 320, driftSec: 26 },
  { color: "#7c4dff", left: 0.72, top: 0.3, size: 300, driftSec: 32 },
  { color: "#3a2a6a", left: 0.5, top: 0.78, size: 360, driftSec: 38 },
  { color: "#9c6bff", left: 0.82, top: 0.72, size: 220, driftSec: 30 },
];

function AuroraBlob({
  cfg,
  index,
  on,
  speed,
}: {
  cfg: BlobConfig;
  index: number;
  on: boolean;
  speed: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Soft, gentle drift — small translate loop, alternating direction per blob.
  const dir = index % 2 === 0 ? 1 : -1;
  const ampX = 22 * dir;
  const ampY = 16 * dir;

  useEffect(() => {
    if (!on) {
      tx.value = 0;
      ty.value = 0;
      return;
    }
    const dur = (cfg.driftSec * 1000) / speed;
    const ease = Easing.inOut(Easing.ease);
    tx.value = withRepeat(
      withSequence(
        withTiming(ampX, { duration: dur, easing: ease }),
        withTiming(-ampX, { duration: dur, easing: ease })
      ),
      -1,
      false
    );
    ty.value = withRepeat(
      withSequence(
        withTiming(ampY, { duration: dur * 1.25, easing: ease }),
        withTiming(-ampY, { duration: dur * 1.25, easing: ease })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(tx);
      cancelAnimation(ty);
    };
  }, [on, speed]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const s = cfg.size;
  // Prototype opacity: (0.32 + i*0.02) * 0.55 at Subtle.
  const opacity = (0.32 + index * 0.02) * 0.55;
  const gradId = `aurora-${index}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: "absolute",
          left: SCREEN_W * cfg.left - s / 2,
          top: SCREEN_H * cfg.top - s / 2,
          width: s,
          height: s,
          opacity,
        },
      ]}
    >
      <Svg width={s} height={s}>
        <Defs>
          <RadialGradient
            id={gradId}
            cx="50%"
            cy="50%"
            r="50%"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0" stopColor={cfg.color} stopOpacity={1} />
            <Stop offset="0.68" stopColor={cfg.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={s / 2} cy={s / 2} r={s / 2} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

function AuroraBG({ on, speed }: { on: boolean; speed: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BLOB_CONFIGS.map((cfg, i) => (
        <AuroraBlob key={i} cfg={cfg} index={i} on={on} speed={speed} />
      ))}
    </View>
  );
}

// ── Memory orbs ───────────────────────────────────────────────────────────────
// Sixteen small glowing purple orbs rise from below the bottom edge to above the
// top, looping. Each has a radial #d8c2ff→#7c4dff→transparent fill and a soft
// purple glow shadow. Staggered durations/delays per the prototype.

interface OrbConfig {
  x: number; // 0..100 percent across
  size: number;
  durSec: number;
  delaySec: number; // negative start offset so they begin mid-flight
  opacity: number;
}

// Mirrors the prototype: x=(i*61)%100, size=5+(i%4)*5, dur=16+(i%7)*3,
// delay=-(i*2.3), op=0.12+(i%5)*0.06, with Subtle multiplier ~0.6.
const ORB_CONFIGS: OrbConfig[] = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 61) % 100,
  size: 5 + (i % 4) * 5,
  durSec: 16 + (i % 7) * 3,
  delaySec: -(i * 2.3),
  opacity: (0.12 + (i % 5) * 0.06) * 0.6,
}));

function Orb({ cfg, on, speed }: { cfg: OrbConfig; on: boolean; speed: number }) {
  // Rise from just below the bottom (start) to above the top (end).
  const travel = SCREEN_H + cfg.size + 40;
  // Pre-position mid-flight so orbs are already moving on first render.
  const elapsed = -cfg.delaySec; // seconds already elapsed (delaySec is negative)
  const initProgress = (elapsed % cfg.durSec) / cfg.durSec;
  const ty = useSharedValue(-initProgress * travel);

  useEffect(() => {
    if (!on) {
      ty.value = 0;
      return;
    }
    const dur = (cfg.durSec * 1000) / speed;
    const progress = (elapsed % cfg.durSec) / cfg.durSec;
    ty.value = -progress * travel;
    // Complete the current partial rise, then loop from bottom to top forever.
    ty.value = withSequence(
      withTiming(-travel, { duration: dur * (1 - progress), easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1 }),
          withTiming(-travel, { duration: dur, easing: Easing.linear })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(ty);
  }, [on, speed]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  const s = cfg.size;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: "absolute",
          left: `${cfg.x}%`,
          bottom: -20,
          width: s,
          height: s,
          opacity: on ? cfg.opacity : 0.18,
          // Soft purple glow.
          shadowColor: colors.primary,
          shadowOpacity: 0.9,
          shadowRadius: s * 1.6,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <Svg width={s} height={s}>
        <Defs>
          <RadialGradient
            id={`orb-${cfg.x}-${s}`}
            cx="35%"
            cy="35%"
            r="65%"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0" stopColor="#d8c2ff" stopOpacity={1} />
            <Stop offset="0.7" stopColor={colors.primary} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={s / 2} cy={s / 2} r={s / 2} fill={`url(#orb-${cfg.x}-${s})`} />
      </Svg>
    </Animated.View>
  );
}

function OrbsBG({ on, speed }: { on: boolean; speed: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {ORB_CONFIGS.map((cfg, i) => (
        <Orb key={i} cfg={cfg} on={on} speed={speed} />
      ))}
    </View>
  );
}

// ── Vignette ──────────────────────────────────────────────────────────────────
// Radial overlay: transparent center → rgba(12,12,28,0.55) edges, for depth.

function Vignette() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={SCREEN_W}
      height={SCREEN_H}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="vignette"
          cx="50%"
          cy="30%"
          rx="120%"
          ry="80%"
          gradientUnits="objectBoundingBox"
        >
          <Stop offset="0.4" stopColor="#0c0c1c" stopOpacity={0} />
          <Stop offset="1" stopColor="#0c0c1c" stopOpacity={0.55} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="url(#vignette)" />
    </Svg>
  );
}

// ── Ambient background (Aurora + Orbs + Vignette) ─────────────────────────────

function AmbientBG({ on, speed }: { on: boolean; speed: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <AuroraBG on={on} speed={speed} />
      {/* Orbs use a slightly gentler speed in the prototype (amp * 0.8). */}
      <OrbsBG on={on} speed={Math.max(speed * 0.8, 0.4)} />
      <Vignette />
    </View>
  );
}

// ── BloomLogo ────────────────────────────────────────────────────────────────
// The forget-me-not flower that unfurls petal-by-petal on mount.

function BloomLogo({ on, speed }: { on: boolean; speed: number }) {
  // Whole-flower bloom: scale 0.12 → 1, rotate -38° → 0°
  const bloomScale = useSharedValue(on ? 0.12 : 1);
  const bloomRot = useSharedValue(on ? -38 : 0);

  // Per-petal opacity (5 petals)
  const p0 = useSharedValue(on ? 0 : 1);
  const p1 = useSharedValue(on ? 0 : 1);
  const p2 = useSharedValue(on ? 0 : 1);
  const p3 = useSharedValue(on ? 0 : 1);
  const p4 = useSharedValue(on ? 0 : 1);

  // Eye group opacity
  const eyeOp = useSharedValue(on ? 0 : 1);

  useEffect(() => {
    if (!on) return;

    const bloomDur = 900 / speed;
    const bloomDelay = 100 / speed;
    const fadeDur = 420 / speed;
    const eyeDur = 550 / speed;

    // Whole flower unfurls
    bloomScale.value = withDelay(bloomDelay, withTiming(1, { duration: bloomDur, easing: BLOOM_EASE }));
    bloomRot.value = withDelay(bloomDelay, withTiming(0, { duration: bloomDur, easing: BLOOM_EASE }));

    // Petals light up one by one
    const petals = [p0, p1, p2, p3, p4];
    petals.forEach((p, i) => {
      const delay = (180 + i * 90) / speed;
      p.value = withDelay(delay, withTiming(1, { duration: fadeDur, easing: Easing.ease }));
    });

    // Eye appears after petals
    eyeOp.value = withDelay(560 / speed, withTiming(1, { duration: eyeDur, easing: Easing.ease }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bloomScale.value },
      { rotate: `${bloomRot.value}deg` },
    ],
  }));

  const ap0 = useAnimatedProps(() => ({ opacity: p0.value }));
  const ap1 = useAnimatedProps(() => ({ opacity: p1.value }));
  const ap2 = useAnimatedProps(() => ({ opacity: p2.value }));
  const ap3 = useAnimatedProps(() => ({ opacity: p3.value }));
  const ap4 = useAnimatedProps(() => ({ opacity: p4.value }));
  const eyeAP = useAnimatedProps(() => ({ opacity: eyeOp.value }));

  return (
    <Animated.View style={[styles.logoWrap, containerStyle]}>
      <Svg width={90} height={90} viewBox="0 0 48 48">
        <Defs>
          <RadialGradient id="bl-petal" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ddc8ff" />
            <Stop offset="0.48" stopColor="#9c6bff" />
            <Stop offset="1" stopColor="#7340d8" />
          </RadialGradient>
          <RadialGradient id="bl-eye" cx="50%" cy="42%" r="60%">
            <Stop offset="0" stopColor="#fff3c4" />
            <Stop offset="0.6" stopColor="#f6c64f" />
            <Stop offset="1" stopColor="#e7a92f" />
          </RadialGradient>
        </Defs>
        <AnimatedPath animatedProps={ap0} d={PETAL} transform="rotate(0 24 24)"   fill="url(#bl-petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
        <AnimatedPath animatedProps={ap1} d={PETAL} transform="rotate(72 24 24)"  fill="url(#bl-petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
        <AnimatedPath animatedProps={ap2} d={PETAL} transform="rotate(144 24 24)" fill="url(#bl-petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
        <AnimatedPath animatedProps={ap3} d={PETAL} transform="rotate(216 24 24)" fill="url(#bl-petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
        <AnimatedPath animatedProps={ap4} d={PETAL} transform="rotate(288 24 24)" fill="url(#bl-petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
        <AnimatedG animatedProps={eyeAP}>
          <Circle cx={24} cy={24} r={4.5} fill="#fdfdff" />
          <Circle cx={24} cy={24} r={2.8} fill="url(#bl-eye)" />
          <Circle cx={24} cy={24} r={0.95} fill="#d89a2c" />
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}

// ── Breathing wordmark ────────────────────────────────────────────────────────

function BreathingWordmark({ on, speed }: { on: boolean; speed: number }) {
  const opacity = useSharedValue(on ? 0.62 : 1);

  useEffect(() => {
    if (!on) {
      opacity.value = 1;
      return;
    }
    // Start breathing after initial entrance delay
    opacity.value = withDelay(
      1800 / speed,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 6000 / speed, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.62, { duration: 6000 / speed, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(opacity);
  }, [on, speed]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.title, style]}>Memoria</Animated.Text>
  );
}

// ── Focus-glow input ──────────────────────────────────────────────────────────

interface GlowInputProps {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  testID?: string;
  on: boolean;
}

function GlowInput({ on, ...rest }: GlowInputProps) {
  const [focused, setFocused] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!on) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = withTiming(focused ? 1 : 0, { duration: 400, easing: Easing.ease });
  }, [focused, on]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["#2a2a4a", "#30305a"]),
    borderColor: interpolateColor(progress.value, [0, 1], ["transparent", colors.primary]),
    shadowOpacity: progress.value * 0.45,
    shadowRadius: progress.value * 22,
  }));

  return (
    <Animated.View style={[styles.inputWrap, containerStyle]}>
      <TextInput
        style={styles.inputText}
        placeholderTextColor="#888"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </Animated.View>
  );
}

// ── Shimmer button ────────────────────────────────────────────────────────────

interface ShimmerButtonProps {
  onPress: () => void;
  loading: boolean;
  on: boolean;
  speed: number;
  testID?: string;
}

function ShimmerButton({ onPress, loading, on, speed, testID }: ShimmerButtonProps) {
  const scale = useSharedValue(1);
  const shimmerX = useSharedValue(-SHIMMER_W);

  useEffect(() => {
    if (!on) return;
    shimmerX.value = -SHIMMER_W;
    shimmerX.value = withDelay(
      1200 / speed,
      withRepeat(
        withSequence(
          withTiming(BUTTON_W + SHIMMER_W, {
            duration: 4500 / speed,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(-SHIMMER_W, { duration: 1 })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(shimmerX);
  }, [on, speed]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { skewX: "-12deg" }],
  }));

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      onPressIn={() => {
        if (on) scale.value = withSpring(0.965, PRESS_SPRING);
      }}
      onPressOut={() => {
        if (on) scale.value = withSpring(1, PRESS_SPRING);
      }}
    >
      <Animated.View style={[styles.button, buttonStyle]}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
        {/* Shimmer sweep */}
        {on && !loading && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.shimmerStrip,
              shimmerStyle,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── Rise helper (inline stagger for explicit delays matching the spec) ─────────

function useRise(delayBase: number, { on, speed }: { on: boolean; speed: number }) {
  const opacity = useSharedValue(on ? 0 : 1);
  const ty = useSharedValue(on ? 16 : 0);
  useEffect(() => {
    if (!on) return;
    const dur = 600 / speed;
    const delay = delayBase / speed;
    const easing = Easing.bezier(0.2, 0.7, 0.3, 1);
    opacity.value = withDelay(delay, withTiming(1, { duration: dur, easing }));
    ty.value = withDelay(delay, withTiming(0, { duration: dur, easing }));
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { on, speed } = useIntensity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  // Explicit stagger delays matching the reference (base ms, divided by speed at runtime)
  const logoRise     = useRise(0,   { on, speed });
  const wordRise     = useRise(120, { on, speed });
  const subtitleRise = useRise(220, { on, speed });
  const emailRise    = useRise(340, { on, speed });
  const passRise     = useRise(420, { on, speed });
  const btnRise      = useRise(520, { on, speed });
  const linkRise     = useRise(600, { on, speed });

  return (
    <View testID="login-screen" style={styles.root}>
      <AmbientBG on={on} speed={speed} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Animated.View style={[{ alignItems: "center" }, logoRise]}>
            <BloomLogo on={on} speed={speed} />
          </Animated.View>

          <Animated.View style={wordRise}>
            <BreathingWordmark on={on} speed={speed} />
          </Animated.View>

          <Animated.View style={subtitleRise}>
            <Text style={styles.subtitle}>Welcome back</Text>
          </Animated.View>
        </View>

        {/* Fields */}
        <Animated.View style={[styles.fieldWrap, emailRise]}>
          <GlowInput
            testID="login-email-input"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            on={on}
          />
        </Animated.View>

        <Animated.View style={[styles.fieldWrap, passRise]}>
          <GlowInput
            testID="login-password-input"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            on={on}
          />
        </Animated.View>

        {/* Button */}
        <Animated.View style={btnRise}>
          <ShimmerButton
            testID="login-submit-button"
            onPress={handleLogin}
            loading={loading}
            on={on}
            speed={speed}
          />
        </Animated.View>

        {/* Link */}
        <Animated.View style={linkRise}>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  kav: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 34,
  },
  logoWrap: {
    marginBottom: 10,
    // Glow effect via shadow (iOS)
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    color: colors.primarySoft,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 20,
    color: colors.fg,
    textAlign: "center",
    marginTop: 8,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    // Shadow for glow effect (iOS)
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
  },
  inputText: {
    padding: 16,
    fontSize: 18,
    color: "#fff",
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
    overflow: "hidden",
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  shimmerStrip: {
    width: SHIMMER_W,
    backgroundColor: "rgba(255,255,255,0.18)",
    left: 0,
    top: 0,
    bottom: 0,
  },
  linkText: {
    color: colors.primarySoft,
    fontSize: 16,
    textAlign: "center",
  },
});
