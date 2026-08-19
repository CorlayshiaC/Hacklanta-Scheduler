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
import { GradientPanel } from "@/components/ui/gradient-panel";
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
        <h2 className="font-display text-lg font-bold text-text-primary">{title}</h2>
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

function ListStaggerDemo() {
  const { container, item } = useListStagger();
  return (
    <motion.div animate="visible" className="flex flex-col gap-1.5" initial="hidden" variants={container}>
      {["Check-in Desk", "Registration", "Green Room"].map((label) => (
        <motion.div className="rounded-control bg-surface-elevated px-3 py-1.5 text-sm text-text-primary" key={label} variants={item}>
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
        <motion.div className="h-6 flex-1 rounded-control bg-accent-warn/40" key={n} variants={item} />
      ))}
    </motion.div>
  );
}

function FillInDemo() {
  const { variants, transition } = useFillIn();
  return (
    <div className="relative h-8 w-full overflow-hidden rounded-control bg-surface-elevated">
      <motion.div
        animate="filled"
        className="absolute inset-0 rounded-control bg-accent-primary"
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
        <div className="h-6 overflow-hidden rounded-control bg-surface-elevated" key={index} style={{ width: bar.w }}>
          <motion.div
            animate="visible"
            className="h-full rounded-control bg-accent-primary"
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

function StatusAtomDemo() {
  const [state, setState] = useState<StatusPillState>("in_approval");
  return (
    <div className="flex items-center gap-3">
      <StatusPill state={state} />
      <PillButton
        onClick={() => setState((s) => (s === "in_approval" ? "approved" : "in_approval"))}
        size="sm"
        variant="link"
      >
        Toggle
      </PillButton>
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
          <p className="font-mono text-xs text-text-secondary">docs/contracts/design.md</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">Design reference</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Every components/ui/ primitive in every state, both themes. Dev-only, not linked from
            the sidebar. Dark is the default theme; use the toggle to flip. Every surface below
            reads from the same semantic tokens, nothing here is theme-specific markup.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Section
        title="Hero"
        description="A content slot in a flat card. wash/shapes default to false everywhere (V4): elsewhere in the app, Hero is typography plus the ambient canvas tint only. The full aurora-wash-plus-shapes treatment is sign-in/join only."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">default (everywhere but sign-in)</p>
            <Hero>
              <p className="font-mono text-xs text-text-secondary">Hacklanta II</p>
              <h3 className="mt-2 max-w-md font-display text-2xl font-bold text-text-primary">
                42 shifts published, 6 gaps left to fill
              </h3>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusPill state="approved" />
                <StatusPill state="in_approval" />
              </div>
            </Hero>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">wash + shapes (sign-in/join only)</p>
            <Hero shapes wash>
              <p className="font-mono text-xs text-text-secondary">prog scheduler</p>
              <h3 className="mt-2 max-w-md font-display text-2xl font-bold text-text-primary">
                Sign in to see your schedule
              </h3>
            </Hero>
          </div>
        </div>
      </Section>

      <Section
        title="Sidebar rail"
        description="Collapsed is a narrow icon rail with tooltips; the toggle expands it with a spring width tween and staggered label reveal. The active-item tint is one continuous element sliding between nav items. State persists via a sidebar-collapsed cookie, read server-side in src/app/(app)/layout.tsx so there is no client flash."
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
        title="Motion (v4)"
        description="Full spec: docs/contracts/motion-spec.md. entranceCascade, reveal, fillIn, drawIn, countUp, hoverLift, morphTo, pillPress, themeCrossfade, plus the V4 status atom. Every preset collapses to an instant state under prefers-reduced-motion; the toggle above already exercises themeCrossfade (View Transitions crossfade, spring-snap icon rotation)."
      >
        <PillButton onClick={() => setReplayKey((key) => key + 1)} size="sm" variant="link">
          Replay
        </PillButton>
        <div className="grid gap-6 sm:grid-cols-2" key={replayKey}>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">entranceCascade (stagger-standard, 40ms)</p>
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
            <p className="mb-2 font-mono text-xs text-text-secondary">drawIn (schedule bars, stagger-bars 28ms)</p>
            <DrawInDemo />
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">countUp (480ms entrance / 320ms live, delta pops 80ms after)</p>
            <div className="flex items-center gap-4">
              <StatBlock animated delta={{ direction: "up", value: "+12" }} label="Semester hours" value={hoursCount} />
              <PillButton onClick={() => setHoursCount((h) => h + 12)} size="sm" variant="link">
                +12
              </PillButton>
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">hoverLift (hover the card)</p>
            <Card interactive className="w-fit">
              <p className="text-sm text-text-secondary">Rises 2px, ambient shadow deepens. No glow.</p>
            </Card>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs text-text-secondary">status atom (dot crossfade + text slot-machine slide)</p>
            <StatusAtomDemo />
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          morphTo (shared-element layoutId morphs, e.g. a shift capsule into its detail panel) is a
          usage pattern, not a standalone demo here: give the source and destination the same
          Framer Motion layoutId and pass MORPH_TRANSITION where an explicit transition is needed.
          See lib/utils/motion.ts and motion-spec.md section 5.
        </p>
      </Section>

      <Section title="Canvas and surfaces" description="Near-black canvas with a faint purple tint, then two flat opaque tonal steps. No blur, no translucency outside the Dialog exception below.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Swatch className="bg-surface-canvas" name="surface-canvas" note="Page canvas, purple tint" />
          <Swatch className="bg-surface-card" name="surface-card" note="Flat cards" />
          <Swatch className="bg-surface-elevated" name="surface-elevated" note="Pills, inputs, wells" />
        </div>
        <Card menuSlot={<IconButton aria-label="Card options" size="sm" variant="ghost">⋯</IconButton>} title="Overline title row">
          <p className="text-sm text-text-secondary">
            Card with a title prop (11px, sentence case, no uppercase tracking) and a menuSlot.
            Flat, hairline border, ambient 1px/2px shadow, no blur.
          </p>
        </Card>
      </Section>

      <Section
        title="Accents"
        description="Purple is the base atmosphere (canvas tint, hairlines, secondary text), exempt from the two-accent restraint rule. Champagne (V4.1: was orange) is warn/in-approval/gaps, lime is positive delta only, both rationed. Champagne has two intensity steps: the everyday accent-warn, and accent-warn-hot, reserved exclusively for gaps unfilled within 24h, no-show, and the understaffed pulse. Each has a fill shade (safe under on-accent white text) and a glow shade (text/border/line only); see tokens.css for the contrast math."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex h-14 items-center justify-center rounded-card bg-accent-primary text-sm font-semibold text-on-accent">
            accent-primary
          </div>
          <div className="flex h-14 items-center justify-center rounded-card border border-accent-primary-glow bg-surface-card text-sm font-semibold text-accent-primary-glow">
            accent-primary-glow
          </div>
          <div className="flex h-14 items-center justify-center rounded-card bg-accent-warn-fill text-sm font-semibold text-on-accent">
            accent-warn-fill (legacy, back-compat only)
          </div>
          <div className="flex h-14 items-center justify-center rounded-card border border-accent-warn bg-surface-card text-sm font-semibold text-accent-warn">
            accent-warn (champagne)
          </div>
          <div className="flex h-14 items-center justify-center rounded-card border-2 border-accent-warn-hot bg-surface-card text-sm font-semibold text-accent-warn-hot">
            accent-warn-hot
          </div>
          {/* The preferred solid-fill pattern: champagne stays bright/yellow, text goes near-black
              instead of the fill going dark-brown-plus-white (see tokens.css's on-accent-warn). */}
          <div className="flex h-14 items-center justify-center rounded-card bg-accent-warn-pale text-sm font-semibold text-on-accent-warn">
            accent-warn-pale + on-accent-warn
          </div>
        </div>
        <div className="flex h-14 w-fit items-center justify-center rounded-control bg-accent-delta/15 px-6 text-sm font-semibold text-delta">
          accent-delta, positive delta chips only
        </div>
      </Section>

      <Section title="The one gradient panel" description="Reserved for the AI surface (Ask Proggy, Fill gaps). The only surface allowed to glow by default.">
        <GradientPanel className="max-w-sm">
          <p className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
            <span aria-hidden>✦</span> Ask Proggy
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {["When am I scheduled", "How many hours do I have"].map((q) => (
              <span className="rounded-control border border-hairline px-3 py-1.5 text-sm text-text-primary" key={q}>
                {q}
              </span>
            ))}
          </div>
        </GradientPanel>
      </Section>

      <Section title="Contrast floor" description="WCAG AA verified in both themes with an actual computed ratio, not estimated; see tokens.css for the full derivation of every fill-vs-glow split.">
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-text-secondary">
                <th className="pb-2 pr-4 font-medium">Pair</th>
                <th className="pb-2 pr-4 font-medium">Ratio</th>
                <th className="pb-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              <ContrastRow pair="text-primary on card (dark / light)" ratio="16.1:1 / 18.0:1" verdict="Pass AAA" />
              <ContrastRow pair="text-secondary on card (dark / light)" ratio="5.3:1 / 6.5:1" verdict="Pass AA" />
              <ContrastRow pair="on-accent (white) on accent-primary fill" ratio="5.2:1" verdict="Pass AA" />
              <ContrastRow pair="on-accent (white) on accent-primary-glow (dark)" ratio="2.7:1" verdict="Fails, not used for fills" />
              <ContrastRow pair="accent-warn on card (dark, champagne F0C570)" ratio="11.6:1" verdict="Pass AAA" />
              <ContrastRow pair="accent-warn on card (light, corrected 82620F)" ratio="5.7:1" verdict="Pass AA, deviates from the V4.1 addendum's literal B08514 (3.4:1, fails), see tokens.css" />
              <ContrastRow pair="on-accent (white) on accent-warn-fill" ratio="4.8:1" verdict="Pass AA, legacy pattern, prefer on-accent-warn on accent-warn-pale for new fills" />
              <ContrastRow pair="on-accent-warn (true black) on accent-warn-pale (dark / light)" ratio="12.9:1 / 12.7:1" verdict="Pass AAA, the preferred solid champagne fill pattern" />
              <ContrastRow pair="on-accent (white) on accent-warn-hot (either theme)" ratio="2.0:1 / 4.3:1" verdict="Fails as a fill, warn-hot is never a solid fill under white text" />
              <ContrastRow pair="accent-warn-hot on card (dark / light)" ratio="9.2:1 / 4.3:1" verdict="Pass (light is glyph/badge scale, clears the 3:1 non-text floor)" />
              <ContrastRow pair="accent-delta-text on card (light, darkened)" ratio="5.3:1" verdict="Pass AA" />
              <ContrastRow pair="accent-delta on card (dark, literal)" ratio="10.8:1" verdict="Pass AAA" />
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="PillButton" description="primary is the one solid accent-primary fill per view. link is the V4 default for secondary actions: no fill, no border. destructive is an outlined champagne control, not red.">
        <div className="flex flex-wrap items-center gap-3">
          <PillButton variant="primary">Primary</PillButton>
          <PillButton variant="link">Link</PillButton>
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
          <p className="text-sm text-text-secondary">NeuWell: a flat elevated container for grouping fields.</p>
        </NeuWell>
      </Section>

      <Section title="NeuBadge" description="A chip/tag (role, event status), not a status. See StatusPill for assignment states.">
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
        description="V4: a 5px dot plus plain text, not a chip. Fixed styling everywhere: approved is a purple dot, in_approval is a champagne dot, not_assigned is a muted dot with muted text. Meanings are theme-independent. State changes animate as the status atom, demoed above under Motion."
      >
        <div className="flex flex-wrap gap-4">
          <StatusPill state="approved" />
          <StatusPill state="in_approval" />
          <StatusPill state="not_assigned" />
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

      <Section title="StatBlock" description="Delta chips are lime for positive, champagne for negative, lime is never a status color elsewhere. Pops in 80ms after the numeral finishes rolling.">
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
        description="Preset-query controls for the member dashboard; tapping reveals a compact QuickchatAnswerCard."
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

      <Section title="Overlays" description="Dialog is the one named floating-layer blur exception (flat card + backdrop-blur-glass on a blurred scrim). Popover and Tooltip are flat, no blur. Toast queue reflows with a layout spring when one dismisses.">
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

      <Section title="Avatar and AvatarStack" description="The one control that keeps a true pill (rounded-full) radius in V4.">
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

      <Section title="Do / don't">
        <Card>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> use StatusPill for assignment states and GradientPanel for the one AI-surface gradient.{" "}
              <span className="text-accent-warn">Don&apos;t</span> hand-roll a colored badge or add a second glowing surface.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> keep at most two non-purple accents doing semantic work per view (champagne, lime), one hero.{" "}
              <span className="text-accent-warn">Don&apos;t</span> add a third accent or a second hero/gradient moment.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> pair on-accent (white) text with accent-primary or accent-warn-fill.{" "}
              <span className="text-accent-warn">Don&apos;t</span> put on-accent text on accent-primary-glow or accent-warn (the glow/dot shades), they fail contrast on purpose.
            </li>
            <li className="text-text-secondary">
              <span className="text-delta">Do</span> use ShiftCapsule/MatrixDot for new schedule surfaces, and animate only through lib/utils/motion.ts presets (docs/contracts/motion-spec.md).{" "}
              <span className="text-accent-warn">Don&apos;t</span> hand-roll a new coverage cell or a one-off Framer transition.
            </li>
          </ul>
        </Card>
      </Section>
    </div>
  );
}
