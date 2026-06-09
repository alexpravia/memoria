"use client";

// Initializes supabase before AuthProvider mounts.
import "@/lib/supabase";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, AuthProvider } from "@memoria/core";
import { AudioUnlockGate } from "@/components/AudioUnlockGate";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");

  const isCoUserPath = pathname.startsWith("/co-user");

  // A session with no profile row can only be a co-user who just signed up
  // (patients never self-register) — route them like a co-user so they land
  // on the onboarding wizard instead of the patient kiosk.
  const effectiveRole = role ?? (session ? "co_user" : null);

  // Role-based routing: redirect to correct experience once role resolves.
  useEffect(() => {
    if (loading || !session || !effectiveRole) return;
    if (effectiveRole === "co_user" && !isCoUserPath) {
      router.replace("/co-user");
    } else if (effectiveRole === "user" && isCoUserPath) {
      router.replace("/");
    }
  }, [loading, session, effectiveRole, isCoUserPath, router]);

  if (loading) return <Spinner />;
  if (!session) {
    return authMode === "sign-in" ? (
      <SignIn onSwitchToSignUp={() => setAuthMode("sign-up")} />
    ) : (
      <SignUp onSwitchToSignIn={() => setAuthMode("sign-in")} />
    );
  }

  // Show spinner during in-flight role redirect to avoid flash of wrong UI.
  if (
    (effectiveRole === "co_user" && !isCoUserPath) ||
    (effectiveRole === "user" && isCoUserPath)
  ) {
    return <Spinner />;
  }

  // Co-user gets the management portal; no audio unlock needed.
  if (effectiveRole === "co_user") return <>{children}</>;

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
