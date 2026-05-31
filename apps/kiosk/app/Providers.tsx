"use client";

// Initializes supabase before AuthProvider mounts.
import "@/lib/supabase";

import { AuthProvider } from "@memoria/core";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
