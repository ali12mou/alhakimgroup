export type AuthUser = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: { _id: string; name: string } | null;
  active?: boolean;
};

const AUTH_STORAGE_KEY = "alhakim.auth.user";

export function getCurrentAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?._id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCurrentAuthUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function logoutAuth() {
  setCurrentAuthUser(null);
}

export async function loginWithCredentials(email: string, password: string): Promise<AuthUser> {
  const { api } = await import("./apiService");
  const { data } = await api.post<{ user: AuthUser }>("/auth/login", {
    email: email.trim().toLowerCase(),
    password
  });
  if (!data?.user) {
    throw new Error("Reponse login invalide");
  }
  setCurrentAuthUser(data.user);
  return data.user;
}
