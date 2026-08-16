import { describe, expect, it } from "vitest";
import {
  mapSignInError,
  mapSignUpError,
  signInInputSchema,
  signUpInputSchema,
} from "@/lib/auth/form-validation";

describe("auth form validation", () => {
  it("validates sign-in email and password input", () => {
    expect(signInInputSchema.safeParse({ email: "bad", password: "" }).success).toBe(false);
    expect(
      signInInputSchema.safeParse({ email: "member@example.com", password: "password123" })
        .success,
    ).toBe(true);
  });

  it("requires matching sign-up passwords", () => {
    const result = signUpInputSchema.safeParse({
      fullName: "HackLanta Member",
      email: "member@example.com",
      password: "password123",
      passwordConfirmation: "different123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts and trims a valid sign-up full name", () => {
    const result = signUpInputSchema.safeParse({
      fullName: "  Ada Lovelace  ",
      email: "member@example.com",
      password: "password123",
      passwordConfirmation: "password123",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected full name validation to succeed.");
    }
    expect(result.data.fullName).toBe("Ada Lovelace");
  });

  it("rejects empty and whitespace-only sign-up full names", () => {
    expect(
      signUpInputSchema.safeParse({
        fullName: "",
        email: "member@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      }).success,
    ).toBe(false);

    expect(
      signUpInputSchema.safeParse({
        fullName: "   ",
        email: "member@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      }).success,
    ).toBe(false);
  });

  it("does not accept a role field during sign-up validation", () => {
    const result = signUpInputSchema.safeParse({
      fullName: "HackLanta Member",
      email: "member@example.com",
      password: "password123",
      passwordConfirmation: "password123",
      role: "admin",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected role field to be stripped from signup input.");
    }
    expect(result.data).not.toHaveProperty("role");
  });

  it("maps common Supabase auth errors to user-safe messages", () => {
    expect(mapSignInError("Invalid login credentials")).toBe("Email or password is incorrect.");
    expect(mapSignUpError("User already registered")).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
  });
});
