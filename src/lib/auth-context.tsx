"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  refresh: async () => {},
});

export function AuthProvider({
  initialProfile,
  children,
}: {
  initialProfile: Profile | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function refresh() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      setProfile(data as Profile | null);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = profile?.role === "master";
  const isManager = profile?.role === "master" || profile?.role === "gestor";

  return (
    <AuthContext.Provider value={{ profile, loading, isAdmin, isManager, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
