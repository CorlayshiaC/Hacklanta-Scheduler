"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSwapAction } from "@/lib/swaps/actions";
import { PillButton } from "@/components/ui/neu-button";

type RequestSwapButtonProps = {
  assignmentId: string;
  hasOpenRequest: boolean;
};

export function RequestSwapButton({ assignmentId, hasOpenRequest }: RequestSwapButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const disabled = hasOpenRequest || isPending;

  return (
    <div className="flex flex-col items-end gap-1">
      <PillButton
        disabled={disabled}
        onClick={() => {
          setErrorMessage(null);
          startTransition(async () => {
            const result = await requestSwapAction(assignmentId, "swap");
            if (result.ok) {
              router.refresh();
            } else {
              setErrorMessage(result.message);
            }
          });
        }}
        variant={hasOpenRequest ? "destructive" : "default"}
      >
        {hasOpenRequest ? "Swap pending" : isPending ? "Requesting..." : "Request swap"}
      </PillButton>
      {errorMessage ? <p className="max-w-[16rem] text-right text-xs text-accent-warn">{errorMessage}</p> : null}
    </div>
  );
}
