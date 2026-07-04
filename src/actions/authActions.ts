"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error?: string };

const SESSION_COOKIE = "tk_session";

/**
 * Validates the submitted credentials against LOGIN_USERNAME / LOGIN_PASSWORD
 * (from .env). On success sets an httpOnly session cookie and redirects home;
 * on failure returns an error for the form to display.
 */
export async function login(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const ok = username === process.env.LOGIN_USERNAME && password === process.env.LOGIN_PASSWORD;

  if (!ok) {
    return { error: "Invalid username or password." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === "production",
  });

  // redirect() throws NEXT_REDIRECT — must stay outside any try/catch.
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
