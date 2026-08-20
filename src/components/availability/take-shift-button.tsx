"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimShiftAction } from "@/lib/shifts/actions";
import { PillButton } from "@/components/ui/neu-button";

type TakeShiftButtonProps = {
  shiftId: string;
  isFull: boolean;
  isMine: boolean;
};

export function TakeShiftButton({ shiftId, isFull, isMine }: TakeShiftButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const disabled = isFull || isMine || isPending;

  const label = isMine ? "Already yours" : isPending ? "Taking..." : isFull ? "Full" : "Take this shift";

  return (
    <div className="flex flex-col items-end gap-1">
      <PillButton
        disabled={disabled}
        onClick={() => {
          setErrorMessage(null);
          startTransition(async () => {
            const result = await claimShiftAction(shiftId);
            if (result.ok) {
              router.refresh();
            } else {
              setErrorMessage(result.message);
            }
          });
        }}
        variant="primary"
      >
        {label}
      </PillButton>
      {errorMessage ? <p className="max-w-[16rem] text-right text-xs text-accent-warn">{errorMessage}</p> : null}
    </div>
  );
}
