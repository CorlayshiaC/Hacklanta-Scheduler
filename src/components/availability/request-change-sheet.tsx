"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PillButton } from "@/components/ui/neu-button";
import { CHANGE_REQUEST_KIND_LABELS, type ChangeRequestKind } from "@/lib/change-requests/types";
import { submitChangeRequestAction } from "@/lib/change-requests/actions";
import type { RosterMember } from "@/lib/change-requests/data";

type RequestChangeSheetProps = {
  eventId: string;
  /** Omit for an event-level request (only "more_hours" is meaningful without a specific shift). */
  assignment?: { id: string; shiftTitle: string };
  roster?: RosterMember[];
  trigger?: ReactNode;
};

const ALL_KINDS: ChangeRequestKind[] = ["swap_any", "swap_with", "drop", "cant_make_time", "more_hours"];

export function RequestChangeSheet({ eventId, assignment, roster = [], trigger }: RequestChangeSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChangeRequestKind>(assignment ? "swap_any" : "more_hours");
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableKinds: ChangeRequestKind[] = assignment ? ALL_KINDS : ["more_hours"];

  function handleSubmit() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await submitChangeRequestAction({
        eventId,
        kind,
        assignmentId: kind === "more_hours" ? undefined : assignment?.id,
        targetUserId: kind === "swap_with" ? targetUserId : undefined,
        note: note.trim() || undefined,
      });

      if (result.ok) {
        setOpen(false);
        setNote("");
        router.refresh();
      } else {
        setErrorMessage(result.message);
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger ?? <PillButton variant="default">Request a change</PillButton>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          {assignment ? <p className="text-sm text-text-secondary">{assignment.shiftTitle}</p> : null}
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              What do you need?
            </legend>
            {availableKinds.map((option) => (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-pill bg-elevated px-3.5 py-2 text-sm text-text-primary has-[:checked]:bg-accent-go has-[:checked]:text-on-accent"
                key={option}
              >
                <input
                  checked={kind === option}
                  className="sr-only"
                  name="change-request-kind"
                  onChange={() => setKind(option)}
                  type="radio"
                  value={option}
                />
                {CHANGE_REQUEST_KIND_LABELS[option]}
              </label>
            ))}
          </fieldset>

          {kind === "swap_with" ? (
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Swap with
              <select
                className="h-10 rounded-pill border border-hairline bg-elevated px-3.5 text-sm text-text-primary outline-none focus-visible:shadow-focus-ring"
                onChange={(event) => setTargetUserId(event.target.value)}
                value={targetUserId}
              >
                <option value="">Choose a person</option>
                {roster.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {roster.length === 0 ? <span className="text-xs text-accent-warn">No one else is on this event yet.</span> : null}
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            Note {kind === "cant_make_time" ? "(include a time that works better, if you have one)" : "(optional)"}
            <textarea
              className="min-h-20 rounded-card border border-hairline bg-elevated p-3 text-sm text-text-primary outline-none focus-visible:shadow-focus-ring"
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>

          {errorMessage ? <p className="text-sm text-accent-warn">{errorMessage}</p> : null}
        </div>

        <DialogFooter className="mt-4">
          <PillButton
            disabled={isPending || (kind === "swap_with" && !targetUserId)}
            onClick={handleSubmit}
            variant="primary"
          >
            {isPending ? "Sending..." : "Send request"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
