/**
 * GoTrue REST API for token lifecycle. All sign-in, refresh, and logout operations
 * use HTTP calls to `/auth/v1/*`. `supabase.auth.setSession()` is used only to keep
 * the Supabase JS client aligned with persisted JWTs for PostgREST/RLS.
 */

import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const GOTRUE_API_VERSION = "2024-01-01";

function baseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return u.replace(/\/$/, "");
}

function anonKey(): string {
  const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!k) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return k;
}

function anonHeaders(): Record<string, string> {
  return {
    apikey: anonKey(),
    Authorization: `Bearer ${anonKey()}`,
    "Content-Type": "application/json",
    "X-Supabase-Api-Version": GOTRUE_API_VERSION,
  };
}

function userHeaders(accessToken: string): Record<string, string> {
  return {
    apikey: anonKey(),
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Supabase-Api-Version": GOTRUE_API_VERSION,
  };
}

export function getAuthStorageKey(): string {
  const u = baseUrl();
  const ref = u.split(".")[0]?.split("//")[1];
  if (!ref) throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL");
  return `sb-${ref}-auth-token`;
}

function codeVerifierStorageKey(): string {
  return `${getAuthStorageKey()}-code-verifier`;
}

export function readSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getAuthStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAccessTokenFromStorage(): string | null {
  return readSessionFromStorage()?.access_token ?? null;
}

function jwtExpMs(accessToken: string): number | null {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const exp = payload.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getCurrentUserIdFromStorage(): string | null {
  const s = readSessionFromStorage();
  if (s?.user?.id) return s.user.id;
  if (!s?.access_token) return null;
  try {
    const payload = JSON.parse(atob(s.access_token.split(".")[1]));
    const sub = payload.sub ?? payload.user_id;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export async function syncSupabaseFromSession(session: Session | null): Promise<void> {
  if (typeof window === "undefined") return;
  if (!session?.access_token || !session?.refresh_token) {
    await supabase.auth.signOut({ scope: "local" });
    return;
  }
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) console.warn("[auth-rest] setSession:", error.message);
}

function persistSessionLocal(session: Session): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getAuthStorageKey(), JSON.stringify(session));
}

export async function persistAndSyncSession(session: Session): Promise<void> {
  persistSessionLocal(session);
  await syncSupabaseFromSession(session);
}

/** Verify JWT with GoTrue (works in browser, Node, and Edge). */
export async function verifyAccessToken(accessToken: string): Promise<{
  user: User | null;
  error: string | null;
}> {
  const res = await fetch(`${baseUrl()}/auth/v1/user`, {
    headers: userHeaders(accessToken),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { msg?: string; message?: string };
      msg = j.msg || j.message || msg;
    } catch {
      /* ignore */
    }
    return { user: null, error: msg };
  }
  const user = (await res.json()) as User;
  return { user, error: null };
}

export async function signInWithPasswordRest(
  email: string,
  password: string
): Promise<{ error: Error | null }> {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json().catch(() => ({}))) as Session & {
    msg?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      error: new Error(
        json.msg || json.error_description || json.message || "Sign in failed"
      ),
    };
  }
  if (!json.access_token || !json.refresh_token) {
    return { error: new Error("No session returned") };
  }
  await persistAndSyncSession(json as Session);
  return { error: null };
}

export async function signUpRest(
  email: string,
  password: string,
  redirectTo: string
): Promise<{ error: Error | null; needsEmailConfirmation: boolean }> {
  const params = new URLSearchParams({ redirect_to: redirectTo });
  const res = await fetch(`${baseUrl()}/auth/v1/signup?${params}`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({
      email,
      password,
      data: {},
      gotrue_meta_security: {},
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    message?: string;
    access_token?: string;
    refresh_token?: string;
    session?: Session;
    user?: User;
  };
  if (!res.ok) {
    return {
      error: new Error(
        json.msg || json.error_description || json.message || "Sign up failed"
      ),
      needsEmailConfirmation: false,
    };
  }
  if (json.session?.access_token && json.session?.refresh_token) {
    await persistAndSyncSession(json.session);
    return { error: null, needsEmailConfirmation: false };
  }
  if (json.access_token && json.refresh_token) {
    await persistAndSyncSession(json as Session);
    return { error: null, needsEmailConfirmation: false };
  }
  return { error: null, needsEmailConfirmation: true };
}

export async function signInWithOtpRest(
  email: string,
  emailRedirectTo: string
): Promise<{ error: Error | null }> {
  const params = new URLSearchParams({ redirect_to: emailRedirectTo });
  const res = await fetch(`${baseUrl()}/auth/v1/otp?${params}`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({
      email,
      create_user: true,
      data: {},
      gotrue_meta_security: {},
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      error: new Error(
        json.msg || json.error_description || json.message || "Failed to send magic link"
      ),
    };
  }
  return { error: null };
}

export async function resetPasswordForEmailRest(
  email: string,
  redirectTo: string
): Promise<{ error: Error | null }> {
  const params = new URLSearchParams({ redirect_to: redirectTo });
  const res = await fetch(`${baseUrl()}/auth/v1/recover?${params}`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ email, gotrue_meta_security: {} }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      error: new Error(
        json.msg || json.error_description || json.message || "Request failed"
      ),
    };
  }
  return { error: null };
}

export async function updateUserPasswordRest(newPassword: string): Promise<{ error: Error | null }> {
  const session = readSessionFromStorage();
  if (!session?.access_token) {
    return { error: new Error("Not signed in") };
  }
  const res = await fetch(`${baseUrl()}/auth/v1/user`, {
    method: "PUT",
    headers: userHeaders(session.access_token),
    body: JSON.stringify({ password: newPassword, data: {} }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    msg?: string;
    error_description?: string;
    message?: string;
    id?: string;
  };
  if (!res.ok) {
    return {
      error: new Error(
        json.msg || json.error_description || json.message || "Update failed"
      ),
    };
  }
  const user = json as User;
  const next: Session = { ...session, user };
  await persistAndSyncSession(next);
  return { error: null };
}

export async function refreshSessionRest(refreshToken: string): Promise<Session | null> {
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const json = (await res.json().catch(() => ({}))) as Session & {
    msg?: string;
  };
  if (!res.ok) {
    console.warn("[auth-rest] refresh failed:", json);
    return null;
  }
  if (!json.access_token) return null;
  const merged = { ...json } as Session;
  if (!merged.refresh_token) merged.refresh_token = refreshToken;
  if (!merged.user && merged.access_token) {
    const { user } = await verifyAccessToken(merged.access_token);
    if (user) merged.user = user;
  }
  persistSessionLocal(merged);
  await syncSupabaseFromSession(merged);
  return merged;
}

/** Refresh access token if stored JWT is expired or near expiry. */
export async function refreshSessionIfStale(
  skewMs: number = 15_000
): Promise<Session | null> {
  const s = readSessionFromStorage();
  if (!s?.refresh_token || !s.access_token) return null;
  const exp = jwtExpMs(s.access_token);
  const stale = exp == null || exp <= Date.now() + skewMs;
  if (!stale) {
    return s;
  }
  return refreshSessionRest(s.refresh_token);
}

export async function signOutRest(): Promise<void> {
  const session = readSessionFromStorage();
  if (session?.access_token) {
    try {
      await fetch(`${baseUrl()}/auth/v1/logout`, {
        method: "POST",
        headers: userHeaders(session.access_token),
      });
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(getAuthStorageKey());
      localStorage.removeItem(codeVerifierStorageKey());
    } catch {
      /* ignore */
    }
  }
  await supabase.auth.signOut({ scope: "local" });
}

export function parseImplicitGrantHash(hash: string): Partial<Session> | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return null;
  const params = new URLSearchParams(h);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  const expires_in = params.get("expires_in");
  const expires_at_raw = params.get("expires_at");
  return {
    access_token,
    refresh_token,
    expires_in: expires_in ? parseInt(expires_in, 10) : undefined,
    expires_at: expires_at_raw ? parseInt(expires_at_raw, 10) : undefined,
    token_type: "bearer",
  };
}

export async function exchangePkceCode(authCode: string): Promise<Session | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(codeVerifierStorageKey());
  const codeVerifier = raw?.split("/")[0];
  if (!codeVerifier) {
    console.warn("[auth-rest] Missing PKCE code verifier");
    return null;
  }
  const res = await fetch(`${baseUrl()}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
  });
  const json = (await res.json().catch(() => ({}))) as Session & { msg?: string };
  if (!res.ok) {
    console.warn("[auth-rest] PKCE exchange failed:", json);
    return null;
  }
  try {
    localStorage.removeItem(codeVerifierStorageKey());
  } catch {
    /* ignore */
  }
  const session = json as Session;
  if (!session.access_token) return null;
  await persistAndSyncSession(session);
  return session;
}

/**
 * Apply tokens from the current URL (PKCE `code` or implicit hash), persist, sync
 * Supabase client, and strip auth params from the address bar.
 */
export async function applySessionFromUrl(): Promise<Session | null> {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const session = await exchangePkceCode(code);
    if (session) {
      url.searchParams.delete("code");
      const qs = url.searchParams.toString();
      window.history.replaceState(
        {},
        document.title,
        url.pathname + (qs ? `?${qs}` : "") + url.hash
      );
    }
    return session;
  }
  const implicit = parseImplicitGrantHash(window.location.hash);
  if (implicit?.access_token && implicit?.refresh_token) {
    const expiresIn = implicit.expires_in ?? 3600;
    const merged: Session = {
      access_token: implicit.access_token,
      refresh_token: implicit.refresh_token,
      token_type: "bearer",
      expires_in: expiresIn,
      expires_at:
        implicit.expires_at ?? Math.floor(Date.now() / 1000) + expiresIn,
      user: {} as User,
    };
    const { user } = await verifyAccessToken(merged.access_token);
    if (user) merged.user = user;
    await persistAndSyncSession(merged);
    window.history.replaceState({}, document.title, url.pathname + url.search);
    return merged;
  }
  return null;
}
