"use client";

import { NeuButton } from "@/components/ui/neu-button";

export default function AppGroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold text-text-primary">Something went wrong loading this page.</p>
      <p className="text-sm text-text-secondary">{error.message || "Try again, or come back in a moment."}</p>
      <NeuButton onClick={reset} variant="default">
        Try again
      </NeuButton>
    </div>
  );
}
