"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "./api";
import { supabase } from "./supabase";

export type Role = "pharmacist" | "manager" | null;
export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
};

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "signedIn"; user: AuthUser };

type Me = { userId: string; user?: AuthUser; error?: string };

const AuthContext = createContext<{
  state: AuthState;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}>({
  state: { status: "loading" },
  signOut: async () => {},
  refreshUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // undefined = still reading storage, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    const onUnauthorized = () => {
      supabase.auth.signOut();
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("auth:unauthorized", onUnauthorized);
    };
  }, []);

  // Ask Django who this is and what role they have.
  const token = session?.access_token;
  const userId = session?.user.id;
  useEffect(() => {
    if (!token || !userId) return;
    const controller = new AbortController();
    fetch(`${API_URL}/me/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          await supabase.auth.signOut();
          return;
        }
        if (!response.ok) throw new Error(`status ${response.status}`);
        setMe({ userId, user: (await response.json()) as AuthUser });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setMe({
          userId,
          error: "Signed in, but the server could not be reached. Is Django running on port 8000?",
        });
      });
    return () => controller.abort();
  }, [token, userId, refreshVersion]);

  let state: AuthState;
  if (session === undefined) state = { status: "loading" };
  else if (session === null) state = { status: "signedOut" };
  else if (me && me.userId === session.user.id) {
    state = me.user
      ? { status: "signedIn", user: me.user }
      : { status: "error", message: me.error ?? "Could not load your account." };
  } else state = { status: "loading" };

  return (
    <AuthContext.Provider
      value={{
        state,
        signOut: async () => void (await supabase.auth.signOut()),
        refreshUser: () => {
          setMe(null);
          setRefreshVersion((version) => version + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}