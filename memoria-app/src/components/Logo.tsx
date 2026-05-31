import React from "react";
import Svg, { Path, Circle, RadialGradient, Stop, Defs } from "react-native-svg";

const PETAL =
  "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id="petal" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ddc8ff" />
          <Stop offset="0.48" stopColor="#9c6bff" />
          <Stop offset="1" stopColor="#7340d8" />
        </RadialGradient>
        <RadialGradient id="eye" cx="50%" cy="42%" r="60%">
          <Stop offset="0" stopColor="#fff3c4" />
          <Stop offset="0.6" stopColor="#f6c64f" />
          <Stop offset="1" stopColor="#e7a92f" />
        </RadialGradient>
      </Defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <Path
          key={i}
          d={PETAL}
          transform={`rotate(${i * 72} 24 24)`}
          fill="url(#petal)"
          stroke="#ffffff"
          strokeOpacity={0.12}
          strokeWidth={0.5}
        />
      ))}
      <Circle cx={24} cy={24} r={4.5} fill="#fdfdff" />
      <Circle cx={24} cy={24} r={2.8} fill="url(#eye)" />
      <Circle cx={24} cy={24} r={0.95} fill="#d89a2c" />
    </Svg>
  );
}
