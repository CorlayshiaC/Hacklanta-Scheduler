import { beforeEach, describe, expect, it, vi } from "vitest";
import { signUpAction } from "@/lib/auth/actions";
import { initialAuthActionState } from "@/lib/auth/form-validation";

const mocks = vi.hoisted(() => {
  const signUp = vi.fn();
  const signOut = vi.fn();
  const revalidatePath = vi.fn();
  const redirect = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  const getActiveUserAuthorization = vi.fn(async () => ({
    authorized: true,
    role: "board_member",
    userId: "user-1",
  }));

  return {
    getActiveUserAuthorization,
    redirect,
    revalidatePath,
    signOut,
    signUp,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/authorization", () => ({
  getActiveUserAuthorization: mocks.getActiveUserAuthorization,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signOut: mocks.signOut,
      signUp: mocks.signUp,
    },
  })),
}));

function signUpForm(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData();
  formData.set("fullName", overrides.fullName ?? "  Ada Lovelace  ");
  formData.set("email", overrides.email ?? "member@example.com");
  formData.set("password", overrides.password ?? "password123");
  formData.set("passwordConfirmation", overrides.passwordConfirmation ?? "password123");
  return formData;
}

describe("auth actions", () => {
  beforeEach(() => {
    mocks.getActiveUserAuthorization.mockClear();
    mocks.redirect.mockClear();
    mocks.revalidatePath.mockClear();
    mocks.signOut.mockClear();
    mocks.signUp.mockReset();
    mocks.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { identities: [{ id: "identity-1" }] },
      },
      error: null,
    });
  });

  it("passes trimmed full name to Supabase sign-up metadata without a role", async () => {
    const result = await signUpAction(initialAuthActionState, signUpForm());

    expect(result).toEqual({
      status: "success",
      message: "Account created. Confirm your email address, then sign in.",
    });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "member@example.com",
      password: "password123",
      options: {
        data: {
          full_name: "Ada Lovelace",
        },
      },
    });

    const credentials = mocks.signUp.mock.calls[0]?.[0];
    expect(credentials?.options?.data).not.toHaveProperty("role");
    expect(credentials?.options?.data).not.toHaveProperty("application_role");
  });

  it("rejects blank full names before calling Supabase", async () => {
    const result = await signUpAction(initialAuthActionState, signUpForm({ fullName: "   " }));

    expect(result).toEqual({
      status: "error",
      message: "Enter your full name.",
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("keeps password confirmation validation before calling Supabase", async () => {
    const result = await signUpAction(
      initialAuthActionState,
      signUpForm({ passwordConfirmation: "different123" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Passwords do not match.",
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("routes immediately-created users through board-member authorization", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: "test-token" },
        user: { identities: [{ id: "identity-1" }] },
      },
      error: null,
    });

    await expect(signUpAction(initialAuthActionState, signUpForm())).rejects.toThrow(
      "NEXT_REDIRECT:/my-schedule",
    );

    expect(mocks.getActiveUserAuthorization).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/my-schedule");
  });
});
