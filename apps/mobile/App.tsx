import React from "react";
import { AuthProvider } from "@memoria/core";
import AppNavigator from "./src/navigation/AppNavigator";
import { IntensityProvider } from "./src/motion/IntensityContext";

export default function App() {
  return (
    <IntensityProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </IntensityProvider>
  );
}
