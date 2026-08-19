"use client";

import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { NeuCard as Card } from "@/components/ui/neu-card";
import { NeuButton as PillButton } from "@/components/ui/neu-button";
import { IconButton } from "@/components/ui/icon-button";
import { NeuInput } from "@/components/ui/neu-input";
import { NeuTextarea } from "@/components/ui/neu-textarea";
import { NeuSelect } from "@/components/ui/neu-select";
import { FilterPill } from "@/components/ui/filter-pill";
import { NeuToggle } from "@/components/ui/neu-toggle";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { NeuWell } from "@/components/ui/neu-well";
import { NeuBadge } from "@/components/ui/neu-badge";
import { NeuTabs, NeuTabsList, NeuTabsTrigger, NeuTabsContent } from "@/components/ui/neu-tabs";
import { GridCell, type GridCellState } from "@/components/ui/grid-cell";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { MatrixDot, type MatrixDotState } from "@/components/ui/matrix-dot";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusPill, type StatusPillState } from "@/components/ui/status-pill";
import { TimelineTrack, TimelinePill } from "@/components/ui/timeline-track";
import { QuickchatButton, QuickchatAnswerCard } from "@/components/ui/quickchat";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Sidebar } from "@/components/layout/sidebar";
import { Hero } from "@/components/illustration/hero";
import { useListStagger, useReveal, useFillIn, useDrawIn, drawInDelay } from "@/lib/utils/motion";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold uppercase tracking-tight text-text-primary">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className, note }: { name: string; className: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-14 rounded-card border border-hairline ${className}`} />
      <div>
        <p className="font-mono text-xs text-text-primary">{name}</p>
        {note ? <p className="text-xs text-text-secondary">{note}</p> : null}
      </div>
    </div>
  );
}

function ContrastRow({ pair, ratio, verdict }: { pair: string; ratio: string; verdict: string }) {
  const pass = verdict.startsWith("Pass");
  return (
    <tr className="border-b border-hairline last:border-none">
      <td className="py-2 pr-4 text-text-primary">{pair}</td>
      <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{ratio}</td>
      <td className={pass ? "py-2 text-delta" : "py-2 text-accent-warn"}>{verdict}</td>
    </tr>
  );
}

const GRID_CELL_STATES: { state: GridCellState; label: string }[] = [
  { state: "empty", label: "empty" },
  { state: "partial", label: "partial" },
  { state: "full", label: "full" },
  { state: "selected", label: "selected" },
  { state: "conflict", label: "conflict" },
];

const SHIFT_CAPSULE_DEMOS: { state: ShiftCapsuleState; label: string }[] = [
  { state: "empty", label: "empty" },
  { state: "partial", label: "partial" },
  { state: "full", label: "full" },
  { state: "selected", label: "selected" },
];

const MATRIX_DOT_STATES: { state: MatrixDotState; label: string }[] = [
  { state: "idle", label: "idle" },
  { state: "painted", label: "painted" },
  { state: "draft", label: "draft (AI, unconfirmed)" },
];

const AVATAR_STACK_MEMBERS = [
  { id: "1", name: "Jane Doe" },
  { id: "2", name: "Marcus Lee" },
  { id: "3", name: "Priya Nair" },
  { id: "4", name: "Sam Ortiz" },
  { id: "5", name: "Q Chen" },
  { id: "6", name: "Ravi Patel" },
];

const STATUS_PILL_STATES: StatusPillState[] = ["approved", "in_approval", "not_assigned"];

function ListStaggerDemo() {
  const { container, item } = useListStagger();
  return (
    <motion.div animate="visible" className="flex flex-col gap-1.5" initial="hidden" variants={container}>
      {["Check-in Desk", "Registration", "Green Room"].map((label) => (
        <motion.div className="rounded-pill bg-surface-elevated px-3 py-1.5 text-sm text-text-primary backdrop-blur-glass" key={label} variants={item}>
          {label}
        </motion.div>
      ))}
    </motion.div>
  );
}

function RevealDemo() {
  const { container, item } = useReveal();
  return (
    <motion.div animate="visible" className="flex gap-1.5" initial="hidden" variants={container}>
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.div className="h-6 flex-1 rounded-pill bg-accent-warn/40" key={n} variants={item} />
      ))}
    </motion.div>
  );
}

function FillInDemo() {
  const { variants, transition } = useFillIn();
  return (
    <div className="relative h-8 w-full overflow-hidden rounded-pill bg-surface-elevated backdrop-blur-glass">
      <motion.div
        animate="filled"
        className="absolute inset-0 rounded-pill bg-accent-primary"
        initial="empty"
        style={{ transformOrigin: "left" }}
        transition={transition}
        variants={variants}
      />
      <span className="relative flex h-full items-center px-3 text-xs font-medium text-on-accent">Approved</span>
    </div>
  );
}

function DrawInDemo() {
  const { variants, transition } = useDrawIn();
  const bars = [{ w: "90%" }, { w: "65%" }, { w: "80%" }];
  return (
    <div className="flex flex-col gap-2">
      {bars.map((bar, index) => (
        <div className="h-6 overflow-hidden rounded-pill bg-surface-elevated backdrop-blur-glass" key={index} style={{ width: bar.w }}>
          <motion.div
            animate="visible"
            className="h-full rounded-pill bg-accent-primary"
            initial="hidden"
            style={{ transformOrigin: "left" }}
            transition={{ ...transition, delay: drawInDelay(index) }}
            variants={variants}
          />
        </div>
      ))}
    </div>
  );
}

export function DesignShowcase() {
  const [toggled, setToggled] = useState(true);
  const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate");
  const [painted, setPainted] = useState<Set<number>>(new Set([2, 5, 9]));
  const [replayKey, setReplayKey] = useState(0);
  const [hoursCount, setHoursCount] = useState(84);

  return (
    <div className="flex flex-col gap-12 pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
            docs/contracts/design.md
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-text-primary">
            Design reference
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Every components/ui/ primitive in every state, both themes. Dev-only, not linked from
            the sidebar. Use the toggle to flip themes; every surface below reads from the same
            semantic tokens, nothing here is theme-specific markup.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Section
        title="Hero"
        description="AuroraWash + FloatShapes + a content slot. One per page: the dashboard hero, sign-in, an event header, or a big empty state, never behind a dense data surface."
      >
        <Hero>
          <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">Hacklanta II</p>
          <h3 className="mt-2 max-w-md font-display text-2xl font-bold text-text-primary">
            42 shifts published, 6 gaps left to fill
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill state="approved" />
            <StatusPill state="in_approval" />
          </div>
        </Hero>
      </Section>

      <Section
        title="Sidebar rail"
        description="Collapsed is a narrow icon rail with tooltips; the toggle expands it with a 180ms width tween and staggered label reveal. State persists via a sidebar-collapsed cookie, read server-side in src/app/(app)/layout.tsx so there is no client flash."
      >
        <div className="flex flex-wrap gap-6">
          <div className="flex h-96 overflow-hidden rounded-card border border-hairline">
            <Sidebar defaultCollapsed={false} role="member" />
          </div>
          <div className="flex h-96 overflow-hidden rounded-card border border-hairline">
            <Sidebar defaultCollapsed role="member" />
          </div>
        </div>
      </Section>

      <Section
        title="Motion v3"
        description="entranceCascade, reveal, fillIn, drawIn, countUp, hoverLift, morphTo, pillPress, themeCrossfade. Every preset collapses to an instant state under prefers-reduced-motion; the toggle above already exercises themeCrossfade."
      >
        <PillButton onClick={() => setReplayKey((key) => key + 1)} size="sm" variant="default">
          Replay
        </PillButton>
        <div className="grid gap-6 sm:grid-cols-2" key={replayKey}>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">entranceCascade (40ms)</p>
            <ListStaggerDemo />
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">reveal (30ms, left to right)</p>
            <RevealDemo />
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">fillIn (capsule fill sweep)</p>
            <FillInDemo />
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">drawIn (schedule bars, 60ms stagger)</p>
            <DrawInDemo />
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">countUp (animated numeral)</p>
            <div className="flex items-center gap-4">
              <StatBlock animated label="Semester hours" value={hoursCount} />
              <PillButton onClick={() => setHoursCount((h) => h + 12)} size="sm" variant="ghost">
                +12
              </PillButton>
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">hoverLift (hover the card)</p>
            <Card interactive className="w-fit">
              <p className="text-sm text-text-secondary">Rises 2px, shadow deepens soft to glow.</p>
            </Card>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          morphTo (shared-element layoutId morphs, e.g. a shift capsule into its detail panel) is a
          usage pattern, not a standalone demo here: give the source and destination the same
          Framer Motion layoutId and pass MORPH_TRANSITION where an explicit transition is needed.
          See lib/utils/motion.ts.
        </p>
      </Section>

      <Section title="Canvas and surfaces" description="Aurora canvas, then two glass tonal steps, both blurred and translucent.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Swatch className="bg-surface-canvas" name="surface-canvas" note="Page canvas, aurora wash" />
          <Swatch className="bg-surface-card backdrop-blur-glass" name="surface-card" note="Glass cards" />
          <Swatch className="bg-surface-elevated backdrop-blur-glass" name="surface-elevated" note="Pills, inputs, wells" />
        </div>
        <Card menuSlot={<IconButton aria-label="Card options" size="sm" variant="ghost">⋯</IconButton>} title="Overline title row">
          <p className="text-sm text-text-secondary">
            Card with a title prop and a menuSlot. Frosted, hairline border, soft shadow, backdrop
            blur with a solid-fallback for browsers without backdrop-filter (see globals.css).
          </p>
        </Card>
      </Section>

      <Section
        title="Accents"
        description="Purple is primary/approved/schedule bars. Orange is warn/in-approval/gaps. Lime is positive delta only, never a status. Each has a fill shade (safe under on-accent white text) and a glow shade (text/border/line only); see tokens.css for the contrast math."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex h-14 items-center justify-center rounded-card bg-accent-primary text-sm font-semibold text-on-accent">
            accent-primary
          </div>
          <div className="flex h-14 items-center justify-center rounded-card border border-accent-primary-glow bg-surface-card text-sm font-semibold text-accent-primary-glow backdrop-blur-glass">
            accent-primary-glow
          </div>
          <div className="flex h-14 items-center justify-center rounded-card bg-accent-warn-fill text-sm font-semibold text-on-accent">
            accent-warn-fill
          </div>
          <div className="flex h-14 items-center justify-center rounded-card border border-accent-warn bg-surface-card text-sm font-semibold text-accent-warn backdrop-blur-glass">
            accent-warn
          </div>
        </div>
        <div className="flex h-14 w-fit items-center justify-center rounded-pill bg-accent-delta/15 px-6 text-sm font-semibold text-delta">
          accent-delta, positive delta chips only
        </div>
      </Section>

      <Section title="Contrast floor" description="WCAG AA verified in both themes; see tokens.css for the full derivation of every fill-vs-glow split.">
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-wide text-text-secondary">
                <th className="pb-2 pr-4 font-medium">Pair</th>
                <th className="pb-2 pr-4 font-medium">Ratio</th>
                <th className="pb-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              <ContrastRow pair="text-primary on surface-card-solid" ratio="~15:1 / ~14:1" verdict="Pass AAA" />
              <ContrastRow pair="text-secondary on surface-card-solid" ratio="~6.1:1 / ~5.8:1" verdict="Pass AA" />
              <ContrastRow pair="on-accent (white) on accent-primary fill" ratio="~5.3:1" verdict="Pass AA" />
              <ContrastRow pair="on-accent (white) on accent-primary-glow (dark)" ratio="~2.7:1" verdict="Fails, not used for fills" />
              <ContrastRow pair="on-accent (white) on accent-warn-fill" ratio="~4.8:1" verdict="Pass AA" />
              <ContrastRow pair="accent-delta-text on surface-card (light)" ratio="~5.3:1" verdict="Pass AA" />
              <ContrastRow pair="accent-delta (dark) on surface-card (dark)" ratio="~13:1" verdict="Pass AAA" />
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="PillButton" description="primary is a solid accent-primary fill. destructive is an outlined orange pill, not red.">
        <div className="flex flex-wrap items-center gap-3">
          <PillButton variant="primary">Primary</PillButton>
          <PillButton variant="default">Default</PillButton>
          <PillButton variant="ghost">Ghost</PillButton>
          <PillButton variant="destructive">Destructive</PillButton>
          <PillButton disabled variant="default">
            Disabled
          </PillButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PillButton size="sm">Small</PillButton>
          <PillButton size="md">Medium</PillButton>
          <PillButton size="lg">Large</PillButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton aria-label="Neutral icon action">+</IconButton>
          <IconButton aria-label="Ghost icon action" variant="ghost">
            +
          </IconButton>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <NeuInput placeholder="Shift title" />
          <NeuInput invalid errorMessage="Required" placeholder="Invalid state" />
          <NeuTextarea placeholder="Notes" />
          <NeuSelect
            onValueChange={() => {}}
            options={[
              { value: "ops", label: "Operations" },
              { value: "reg", label: "Registration" },
              { value: "log", label: "Logistics", disabled: true },
            ]}
            placeholder="Station"
          />
          <div className="flex items-center gap-3">
            <NeuToggle checked={toggled} onCheckedChange={setToggled} />
            <span className="text-sm text-text-secondary">{toggled ? "On" : "Off"}</span>
          </div>
          <div className="flex items-center gap-4">
            <NeuCheckbox checked={checked} onCheckedChange={setChecked} />
            <span className="text-sm text-text-secondary">
              {checked === "indeterminate" ? "Indeterminate" : checked ? "Checked" : "Unchecked"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <FilterPill
            label="Date"
            onValueChange={() => {}}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
            ]}
            placeholder="Now"
          />
          <FilterPill
            label="Station"
            onValueChange={() => {}}
            options={[
              { value: "ops", label: "Operations" },
              { value: "reg", label: "Registration" },
            ]}
          />
        </div>
        <NeuWell>
          <p className="text-sm text-text-secondary">NeuWell: a glass elevated container for grouping fields.</p>
        </NeuWell>
      </Section>

      <Section title="NeuBadge">
        <div className="flex flex-wrap gap-2">
          <NeuBadge>member</NeuBadge>
          <NeuBadge variant="purple">organizer</NeuBadge>
          <NeuBadge variant="warning">swap_pending</NeuBadge>
          <NeuBadge variant="danger">dropped</NeuBadge>
        </div>
      </Section>

      <Section title="Pill tabs">
        <NeuTabs defaultValue="coverage">
          <NeuTabsList>
            <NeuTabsTrigger value="coverage">Coverage</NeuTabsTrigger>
            <NeuTabsTrigger value="availability">Availability</NeuTabsTrigger>
            <NeuTabsTrigger value="swaps">Swaps</NeuTabsTrigger>
          </NeuTabsList>
          <NeuTabsContent className="mt-3 text-sm text-text-secondary" value="coverage">
            Coverage board content.
          </NeuTabsContent>
          <NeuTabsContent className="mt-3 text-sm text-text-secondary" value="availability">
            Availability grid content.
          </NeuTabsContent>
          <NeuTabsContent className="mt-3 text-sm text-text-secondary" value="swaps">
            Swap requests content.
          </NeuTabsContent>
        </NeuTabs>
      </Section>

      <Section
        title="StatusPill"
        description="The three assignment states, fixed styling everywhere: approved is a solid purple fill, in_approval is an orange outline, not_assigned is a neutral glass chip. Meanings are theme-independent."
      >
        <div className="flex flex-wrap gap-2">
          {STATUS_PILL_STATES.map((state) => (
            <StatusPill key={state} state={state} />
          ))}
        </div>
      </Section>

      <Section
        title="ShiftCapsule"
        description="The hero primitive. A shift is a capsule, its color is its status. empty and partial always carry a mono count; full carries faces; selected is a distinct fill, never headcount."
      >
        <div className="flex max-w-md flex-col gap-2">
          {SHIFT_CAPSULE_DEMOS.map(({ state, label }) => (
            <div className="flex items-center gap-3" key={label}>
              <ShiftCapsule
                className="flex-1"
                filled={state === "empty" ? 0 : 2}
                label="Registration, 9-11am"
                members={state === "full" ? AVATAR_STACK_MEMBERS.slice(0, 3) : undefined}
                needed={3}
                state={state}
              />
              <span className="w-16 shrink-0 font-mono text-xs text-text-secondary">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <ShiftCapsule className="flex-1" filled={1} label="Understaffed, closes in 4h" needed={3} state="partial" urgentPulse />
            <span className="w-16 shrink-0 font-mono text-xs text-text-secondary">urgent</span>
          </div>
        </div>
      </Section>

      <Section
        title="MatrixDot"
        description="The availability primitive. Idle dots are dim, painting snaps a dot to purple, an AI draft renders as a hollow purple ring."
      >
        <div className="flex flex-wrap items-center gap-6">
          {MATRIX_DOT_STATES.map(({ state, label }) => (
            <div className="flex flex-col items-center gap-2" key={label}>
              <MatrixDot aria-label={label} size="lg" state={state} />
              <p className="font-mono text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm text-text-secondary">Interactive paint demo, click to toggle:</p>
          <div className="flex gap-1.5">
            {Array.from({ length: 12 }, (_, index) => (
              <MatrixDot
                aria-label={`Slot ${index + 1}`}
                interactive
                key={index}
                onClick={() =>
                  setPainted((prev) => {
                    const next = new Set(prev);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                state={painted.has(index) ? "painted" : "idle"}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="StatBlock" description="Delta chips are lime for positive, orange for negative, lime is never a status color elsewhere.">
        <div className="flex flex-wrap gap-8">
          <StatBlock delta={{ direction: "up", value: "4% vs yesterday" }} label="Slots filled" value="18/24" />
          <StatBlock delta={{ direction: "down", value: "2 open" }} label="Fill percent" value="75%" />
          <StatBlock label="Hours scheduled" value={132} />
        </div>
      </Section>

      <Section
        title="TimelineTrack"
        description="Generic horizontal time axis: percentage-positioned pills via context, a mono tick axis, a warm now-line. The semester events timeline and a personal schedule strip both compose from this."
      >
        <TimelineTrack
          pxPerDay={90}
          rangeStart="2026-08-17"
          rangeEnd="2026-08-24"
          ticks={[
            { at: "2026-08-17", label: "MON" },
            { at: "2026-08-18", label: "TUE" },
            { at: "2026-08-19", label: "WED" },
            { at: "2026-08-20", label: "THU" },
            { at: "2026-08-21", label: "FRI" },
            { at: "2026-08-22", label: "SAT" },
            { at: "2026-08-23", label: "SUN" },
          ]}
          today="2026-08-20"
        >
          <TimelinePill end="2026-08-19T14:00:00" label="Hacklanta II" start="2026-08-18T09:00:00" tone="go" />
          <TimelinePill end="2026-08-22T18:00:00" label="GBM" start="2026-08-22T17:00:00" tone="warn" />
          <TimelinePill label="Applications open" start="2026-08-24T00:00:00" tone="neutral" />
        </TimelineTrack>
      </Section>

      <Section
        title="QuickchatButton"
        description="Preset-query pills for the member dashboard; tapping reveals a compact QuickchatAnswerCard."
      >
        <div className="flex flex-wrap gap-2">
          <QuickchatButton>When am I scheduled</QuickchatButton>
          <QuickchatButton>How many hours do I have</QuickchatButton>
          <QuickchatButton>Who is working with me</QuickchatButton>
        </div>
        <QuickchatAnswerCard>
          Next shift: <span className="font-mono">Sat 2pm</span>, Check-in Desk, Hacklanta II.
        </QuickchatAnswerCard>
      </Section>

      <Section
        title="GridCell"
        description="Legacy per-cell grid primitive, kept for dense availability/my-schedule grids that already depend on its API. Prefer ShiftCapsule or MatrixDot in new code."
      >
        <div className="flex flex-wrap gap-4">
          {GRID_CELL_STATES.map(({ state, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <GridCell filled={state === "empty" || state === "conflict" ? undefined : 2} needed={state === "empty" || state === "conflict" ? undefined : 3} size="lg" state={state} />
              <p className="font-mono text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Loading">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex items-center gap-4">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </Section>

      <Section title="Overlays" description="Dialog, Popover, Tooltip, Toast. All floating layers: glass surface-card, hairline, card radius, soft shadow, backdrop blur on a blurred scrim.">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <PillButton variant="default">Open dialog</PillButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel this shift?</DialogTitle>
                <DialogDescription>
                  Everyone assigned to it will be notified. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <PillButton variant="ghost">Keep shift</PillButton>
                </DialogClose>
                <DialogClose asChild>
                  <PillButton variant="destructive">Cancel shift</PillButton>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <PillButton variant="default">Open popover</PillButton>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm text-text-primary">Quick filters</p>
              <p className="mt-1 text-sm text-text-secondary">Station, date, and staffing status.</p>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <PillButton variant="ghost">Hover me</PillButton>
            </TooltipTrigger>
            <TooltipContent>Publish shifts</TooltipContent>
          </Tooltip>

          <PillButton
            onClick={() => toast({ title: "Shifts published", description: "12 members notified." })}
            variant="default"
          >
            Trigger toast
          </PillButton>
          <PillButton
            onClick={() =>
              toast({
                title: "Publish failed",
                description: "3 shifts are still unstaffed.",
                variant: "destructive",
              })
            }
            variant="destructive"
          >
            Trigger destructive toast
          </PillButton>
        </div>
      </Section>

      <Section title="Avatar and AvatarStack">
        <div className="flex flex-wrap items-center gap-6">
          <Avatar size="sm">
            <AvatarFallback size="sm">JD</AvatarFallback>
          </Avatar>
          <Avatar size="md">
            <AvatarImage alt="" src="/nonexistent.jpg" />
            <AvatarFallback size="md">ML</AvatarFallback>
          </Avatar>
          <Avatar size="lg" tone="self">
            <AvatarFallback size="lg">PN</AvatarFallback>
          </Avatar>
          <AvatarStack max={4} members={AVATAR_STACK_MEMBERS} size="md" />
        </div>
      </Section>

      <Section title="Glass fallback" description="@supports not (backdrop-filter) swaps every glass surface to its opaque solid tone. This box simulates that fallback state by forcing the solid background directly.">
        <div className="rounded-card border border-hairline bg-surface-card-solid p-4 shadow-soft">
          <p className="text-sm text-text-secondary">
            No blur here on purpose: this is what surface-card renders as on a browser without
            backdrop-filter support. Still reads as an intentional flat card, not broken glass.
          </p>
        </div>
      </Section>

      <Section title="Do / don't">
        <Card>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> use surface-canvas / surface-card / surface-elevated for depth, with backdrop-blur-glass on every glass surface.{" "}
              <span className="text-accent-warn">Don&apos;t</span> hand-roll a blur, opacity, or shadow value.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> keep at most two accents doing semantic work per view, one gradient element, one hero.{" "}
              <span className="text-accent-warn">Don&apos;t</span> add a third accent or a second hero moment.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> pair on-accent (white) text with accent-primary or accent-warn-fill.{" "}
              <span className="text-accent-warn">Don&apos;t</span> put on-accent text on accent-primary-glow or accent-warn (the glow shades), they fail contrast on purpose.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> use ShiftCapsule/MatrixDot for new schedule surfaces, and animate only through lib/utils/motion.ts presets.{" "}
              <span className="text-accent-warn">Don&apos;t</span> hand-roll a new coverage cell or a one-off Framer transition.
            </li>
          </ul>
        </Card>
      </Section>
    </div>
  );
}
