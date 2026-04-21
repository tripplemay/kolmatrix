"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "missing_fields" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "invalid_credentials" };
      }
      return { error: "generic" };
    }
    throw error;
  }

  return {};
}
