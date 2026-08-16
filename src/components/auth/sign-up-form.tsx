"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/form-validation";
import { SubmitButton } from "@/components/auth/submit-button";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink" htmlFor="fullName">
          Full Name
        </label>
        <input
          className="hl-input h-11 w-full rounded-md px-3 text-base"
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink" htmlFor="email">
          Email
        </label>
        <input
          className="hl-input h-11 w-full rounded-md px-3 text-base"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink" htmlFor="password">
          Password
        </label>
        <input
          className="hl-input h-11 w-full rounded-md px-3 text-base"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink" htmlFor="passwordConfirmation">
          Password confirmation
        </label>
        <input
          className="hl-input h-11 w-full rounded-md px-3 text-base"
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state.message ? (
        <p
          className={state.status === "error" ? "text-sm text-danger" : "text-sm text-signal"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Creating account...">Create Account</SubmitButton>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-signal underline-offset-4 hover:text-cyan-200 hover:underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
