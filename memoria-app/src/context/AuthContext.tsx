import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { UserRole } from "../types";

interface AuthState {
  session: Session | null;
  role: UserRole | null;
  userId: string | null; // the memoria user id (patient)
  coUserId: string | null;
  loading: boolean;
  signUp: (email: string, password: string, role: UserRole, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => void;
  setUserId: (id: string) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coUserId, setCoUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setRole(null);
        setUserId(null);
        setCoUserId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(authId: string) {
    // Check if they're a co-user
    const { data: coUser } = await supabase
      .from("co_users")
      .select("id, user_id")
      .eq("auth_id", authId)
      .single();

    if (coUser) {
      setRole("co_user");
      setCoUserId(coUser.id);
      setUserId(coUser.user_id);
      setLoading(false);
      return;
    }

    // Check if they're a user
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .single();

    if (user) {
      setRole("user");
      setUserId(user.id);
      setLoading(false);
      return;
    }

    // New account, no profile yet
    setLoading(false);
  }

  async function signUp(email: string, password: string, role: UserRole, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (role === "co_user" && data.user) {
      // Co-user signed up, but they still need to create the patient's profile
      // We'll store their co-user record after they create the user profile
      setRole("co_user");
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    setUserId(null);
    setCoUserId(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, role, userId, coUserId, loading, signUp, signIn, signOut, setRole, setUserId }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
