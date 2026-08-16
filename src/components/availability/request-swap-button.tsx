"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSwapAction } from "@/lib/swaps/actions";

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
      <button
        className="rounded-neu-sm border border-purple-400/40 bg-purple-500/15 px-3 py-2 text-sm font-semibold text-purple-400 shadow-neu-raised-sm transition-shadow duration-fast ease-neu-out disabled:cursor-not-allowed disabled:border-hairline disabled:bg-bg-surface disabled:text-text-secondary disabled:opacity-60"
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
        type="button"
      >
        {hasOpenRequest ? "Swap requested" : isPending ? "Requesting..." : "Request swap"}
      </button>
      {errorMessage ? <p className="max-w-[16rem] text-right text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
