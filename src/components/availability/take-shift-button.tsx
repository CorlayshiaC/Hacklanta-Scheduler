"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimShiftAction } from "@/lib/shifts/actions";

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
      <button
        className="rounded-neu-sm border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-sm font-semibold text-purple-400 shadow-neu-raised-sm transition-shadow duration-fast ease-neu-out disabled:cursor-not-allowed disabled:border-hairline disabled:bg-bg-surface disabled:text-text-secondary disabled:opacity-60"
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
        type="button"
      >
        {label}
      </button>
      {errorMessage ? <p className="max-w-[16rem] text-right text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
