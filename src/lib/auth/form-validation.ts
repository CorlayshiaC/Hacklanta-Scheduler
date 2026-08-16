import { z } from "zod";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  message: null,
};

export const signInInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpInputSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    passwordConfirmation: z.string().min(1, "Confirm your password."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirmation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["passwordConfirmation"],
      });
    }
  });

export type SignInInput = z.infer<typeof signInInputSchema>;
export type SignUpInput = z.infer<typeof signUpInputSchema>;

export function getFirstValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export function mapSignInError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid") || normalized.includes("credential")) {
    return "Email or password is incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  return "Unable to sign in. Please try again.";
}

export function mapSignUpError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (normalized.includes("password")) {
    return "Choose a stronger password and try again.";
  }

  return "Unable to create an account. Please try again.";
}
