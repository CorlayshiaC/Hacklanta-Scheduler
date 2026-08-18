"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimSwapAction } from "@/lib/swaps/actions";
import { PillButton } from "@/components/ui/neu-button";

type ClaimSwapButtonProps = {
  swapRequestId: string;
};

export function ClaimSwapButton({ swapRequestId }: ClaimSwapButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <PillButton
        // No first-class "white" PillButton variant exists yet (docs/contracts/requests.md has a
        // heads-up to Agent 1); this is selection semantics ("you're putting yourself in this
        // shift"), so it borrows white-pill treatment via an override rather than purple/primary.
        className="bg-pill-white text-on-accent hover:bg-pill-white/90"
        disabled={isPending}
        onClick={() => {
          setErrorMessage(null);
          startTransition(async () => {
            const result = await claimSwapAction(swapRequestId);
            if (result.ok) {
              router.refresh();
            } else {
              setErrorMessage(result.message);
            }
          });
        }}
        variant="default"
      >
        {isPending ? "Claiming..." : "Claim swap"}
      </PillButton>
      {errorMessage ? <p className="max-w-[16rem] text-right text-xs text-accent-warn">{errorMessage}</p> : null}
    </div>
  );
}
