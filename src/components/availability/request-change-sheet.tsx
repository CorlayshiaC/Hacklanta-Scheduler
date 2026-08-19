"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PillButton } from "@/components/ui/neu-button";
import { CHANGE_REQUEST_KIND_LABELS, type ChangeRequestKind } from "@/lib/change-requests/types";
import { submitChangeRequestAction } from "@/lib/change-requests/actions";
import type { RosterMember } from "@/lib/change-requests/data";
import { SPRING_TRANSITION } from "@/lib/utils/motion";

type RequestChangeSheetProps = {
  eventId: string;
  /** Omit for an event-level request (only "more_hours" is meaningful without a specific shift). */
  assignment?: { id: string; shiftTitle: string };
  roster?: RosterMember[];
  trigger?: ReactNode;
};

const ALL_KINDS: ChangeRequestKind[] = ["swap_any", "swap_with", "drop", "cant_make_time", "more_hours"];

const CheckIcon = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} viewBox="0 0 24 24" width="14">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function RequestChangeSheet({ eventId, assignment, roster = [], trigger }: RequestChangeSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChangeRequestKind>(assignment ? "swap_any" : "more_hours");
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const availableKinds: ChangeRequestKind[] = assignment ? ALL_KINDS : ["more_hours"];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset after the close transition finishes rather than mid-close, so the confirmation
      // state doesn't visibly snap back to the form while the sheet is still animating out.
      window.setTimeout(() => {
        setSent(false);
        setNote("");
      }, 200);
    }
  }

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
        setSent(true);
        router.refresh();
        window.setTimeout(() => setOpen(false), 900);
      } else {
        setErrorMessage(result.message);
      }
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger ?? <PillButton variant="default">Request a change</PillButton>}</DialogTrigger>
      <DialogContent>
        {/* DialogContent (Agent 1's file) already fades the panel itself in on Radix's own
            data-state transition; this inner layer adds the V3 spring-driven slide on top,
            entrance only. DialogContent renders a Close button alongside its children outside our
            control, so this can't use asChild (Radix's Slot requires exactly one child). */}
        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }} transition={SPRING_TRANSITION}>
          <DialogHeader>
            <DialogTitle>Request a change</DialogTitle>
            {assignment ? <p className="text-sm text-text-secondary">{assignment.shiftTitle}</p> : null}
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <legend className="col-span-full mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                What do you need?
              </legend>
              {availableKinds.map((option) => (
                <label
                  className="flex cursor-pointer items-center justify-center rounded-pill bg-elevated px-3 py-2 text-center text-sm text-text-primary has-[:checked]:bg-accent-go has-[:checked]:text-on-accent"
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
            <motion.div layout transition={SPRING_TRANSITION}>
              <PillButton
                disabled={isPending || sent || (kind === "swap_with" && !targetUserId)}
                onClick={handleSubmit}
                variant="primary"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {sent ? (
                    <motion.span
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1.5"
                      exit={{ opacity: 0, scale: 0.8 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      key="sent"
                      transition={SPRING_TRANSITION}
                    >
                      <CheckIcon />
                      Sent
                    </motion.span>
                  ) : (
                    <motion.span
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      key="idle"
                      transition={SPRING_TRANSITION}
                    >
                      {isPending ? "Sending..." : "Send request"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </PillButton>
            </motion.div>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
