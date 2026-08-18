"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PillButton } from "@/components/ui/neu-button";

type ContinueWithGoogleButtonProps = {
  /** Path to land on after the callback exchanges the OAuth code, e.g. an invite token's /join
   * page redirecting here first. Validated server-side by getSafeCallbackRedirectPath. */
  next?: string;
};

export function ContinueWithGoogleButton({ next }: ContinueWithGoogleButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsRedirecting(true);

    const supabase = createSupabaseBrowserClient();
    const redirectTo = new URL("/callback", window.location.origin);
    if (next) {
      redirectTo.searchParams.set("next", next);
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });

    // On success the browser navigates away to Google's consent screen, there is nothing left to
    // render here. Only reachable on failure (e.g. the Google provider isn't configured yet).
    if (oauthError) {
      setError("Could not start Google sign-in. Try again.");
      setIsRedirecting(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <PillButton
        className="w-full bg-pill-white text-on-accent hover:brightness-95"
        disabled={isRedirecting}
        onClick={handleClick}
        size="lg"
        type="button"
      >
        {isRedirecting ? "Redirecting..." : "Continue with Google"}
      </PillButton>
      {error ? <p className="text-sm text-accent-warn">{error}</p> : null}
    </div>
  );
}
