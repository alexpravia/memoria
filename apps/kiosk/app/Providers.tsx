"use client";

// Initializes supabase before AuthProvider mounts.
import "@/lib/supabase";

import { AuthProvider } from "@memoria/core";
import { AudioUnlockGate } from "@/components/AudioUnlockGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AudioUnlockGate>{children}</AudioUnlockGate>
    </AuthProvider>
  );
}
