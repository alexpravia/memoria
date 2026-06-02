"use client";

// Initializes supabase before AuthProvider mounts.
import "@/lib/supabase";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, AuthProvider } from "@memoria/core";
import { AudioUnlockGate } from "@/components/AudioUnlockGate";
import { SignIn } from "@/components/SignIn";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isCoUserPath = pathname.startsWith("/co-user");

  // Role-based routing: redirect to correct experience once role resolves.
  useEffect(() => {
    if (loading || !session || !role) return;
    if (role === "co_user" && !isCoUserPath) {
      router.replace("/co-user");
    } else if (role === "user" && isCoUserPath) {
      router.replace("/");
    }
  }, [loading, session, role, isCoUserPath, router]);

  if (loading) return <Spinner />;
  if (!session) return <SignIn />;

  // Show spinner during in-flight role redirect to avoid flash of wrong UI.
  if (
    (role === "co_user" && !isCoUserPath) ||
    (role === "user" && isCoUserPath)
  ) {
    return <Spinner />;
  }

  // Co-user gets the management portal; no audio unlock needed.
  if (role === "co_user") return <>{children}</>;

  // Patient gets the audio unlock gate (prevents autoplay block).
  return <AudioUnlockGate>{children}</AudioUnlockGate>;
}

function Spinner() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        color: "var(--color-fg-muted)",
        fontSize: "var(--type-lg)",
      }}
    >
      Loading…
    </div>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
