import { useCallback, useEffect, useState } from "react";
import {
  getCurrentAuthUser,
  loginWithCredentials,
  logoutAuth,
  type AuthUser
} from "../services/authService";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentAuthUser());

  useEffect(() => {
    setUser(getCurrentAuthUser());
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginWithCredentials(email, password);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    logoutAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback((next: AuthUser | null) => {
    setUser(next);
  }, []);

  return {
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
    refreshUser
  };
}
