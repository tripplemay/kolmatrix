"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-xs font-medium tracking-wide uppercase">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="bg-input text-on-surface placeholder:text-on-surface-variant/60 focus:ring-cyan/60 h-10 rounded-md px-3 text-sm outline-none focus:ring-2"
          placeholder="marketer@kolmatrix.local"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-on-surface-variant text-xs font-medium tracking-wide uppercase">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={1}
          className="bg-input text-on-surface placeholder:text-on-surface-variant/60 focus:ring-cyan/60 h-10 rounded-md px-3 text-sm outline-none focus:ring-2"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-error text-sm">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="gradient-cta ai-glow h-10 rounded-md text-sm font-semibold tracking-wide transition-opacity disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
