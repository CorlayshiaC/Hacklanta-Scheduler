"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getFirstValidationMessage,
  mapSignInError,
  mapSignUpError,
  signInInputSchema,
  signUpInputSchema,
  type AuthActionState,
} from "@/lib/auth/form-validation";
import { getPostAuthPath } from "@/lib/auth/route-protection";
import { getActiveUserAuthorization } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInInputSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return { status: "error", message: getFirstValidationMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: mapSignInError(error.message) };
  }

  revalidatePath("/", "layout");

  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    await supabase.auth.signOut();
    return {
      status: "error",
      message:
        authorization.reason === "inactive"
          ? "Your account is inactive. Contact a HackLanta Scheduler admin."
          : "Your account profile is not ready yet. Try again in a moment.",
    };
  }

  redirect(getPostAuthPath(authorization.role));
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpInputSchema.safeParse({
    fullName: readString(formData, "fullName"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    passwordConfirmation: readString(formData, "passwordConfirmation"),
  });

  if (!parsed.success) {
    return { status: "error", message: getFirstValidationMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
    },
  });

  if (error) {
    return { status: "error", message: mapSignUpError(error.message) };
  }

  const identities = data.user?.identities ?? [];
  if (data.user && identities.length === 0) {
    return {
      status: "error",
      message: "An account with this email already exists. Try signing in instead.",
    };
  }

  revalidatePath("/", "layout");

  if (!data.session) {
    return {
      status: "success",
      message: "Account created. Confirm your email address, then sign in.",
    };
  }

  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    return {
      status: "success",
      message: "Account created. Sign in once your board member profile is ready.",
    };
  }

  redirect(getPostAuthPath(authorization.role));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
