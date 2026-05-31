import React, { createContext, useContext, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

export type Intensity = "Off" | "Subtle" | "Calm" | "Rich";

const AMP: Record<Intensity, number> = {
  Off: 0,
  Subtle: 0.5,
  Calm: 1,
  Rich: 1.6,
};

interface IntensityCtxValue {
  intensity: Intensity;
  setIntensity: (i: Intensity) => void;
}

const IntensityCtx = createContext<IntensityCtxValue>({
  intensity: "Subtle",
  setIntensity: () => {},
});

export function IntensityProvider({ children }: { children: React.ReactNode }) {
  const [intensity, setIntensity] = useState<Intensity>("Subtle");
  return (
    <IntensityCtx.Provider value={{ intensity, setIntensity }}>
      {children}
    </IntensityCtx.Provider>
  );
}

export function useIntensity() {
  const { intensity: raw, setIntensity } = useContext(IntensityCtx);
  const reduceMotion = useReducedMotion();
  // OS "Reduce Motion" overrides to Off per spec.
  const intensity: Intensity = reduceMotion ? "Off" : raw;
  const amp = AMP[intensity];
  const on = intensity !== "Off";
  const speed = Math.max(amp, 0.5);
  return { intensity, setIntensity, amp, on, speed };
}
