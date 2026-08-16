"use client";

import { type ReactNode, useState } from "react";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuButton } from "@/components/ui/neu-button";
import { NeuInput } from "@/components/ui/neu-input";
import { NeuTextarea } from "@/components/ui/neu-textarea";
import { NeuSelect } from "@/components/ui/neu-select";
import { NeuToggle } from "@/components/ui/neu-toggle";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { NeuWell } from "@/components/ui/neu-well";
import { NeuBadge } from "@/components/ui/neu-badge";
import { NeuTabs, NeuTabsList, NeuTabsTrigger, NeuTabsContent } from "@/components/ui/neu-tabs";
import { GridCell, type GridCellState } from "@/components/ui/grid-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className, note }: { name: string; className: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-14 rounded-neu-sm border border-hairline ${className}`} />
      <div>
        <p className="font-mono text-xs text-text-primary">{name}</p>
        {note ? <p className="text-xs text-text-secondary">{note}</p> : null}
      </div>
    </div>
  );
}

const GRID_CELL_STATES: { state: GridCellState; coverage?: number; label: string }[] = [
  { state: "empty", label: "empty" },
  { state: "partial", coverage: 0.33, label: "partial 1/3" },
  { state: "partial", coverage: 0.67, label: "partial 2/3" },
  { state: "full", coverage: 1, label: "full" },
  { state: "selected", coverage: 1, label: "selected" },
  { state: "conflict", label: "conflict" },
];

const AVATAR_STACK_MEMBERS = [
  { id: "1", name: "Jane Doe" },
  { id: "2", name: "Marcus Lee" },
  { id: "3", name: "Priya Nair" },
  { id: "4", name: "Sam Ortiz" },
  { id: "5", name: "Q Chen" },
  { id: "6", name: "Ravi Patel" },
];

export function DesignShowcase() {
  const [toggled, setToggled] = useState(true);
  const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate");
  const [selected, setSelected] = useState<Set<number>>(new Set([2]));

  return (
    <div className="flex flex-col gap-12 pb-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
          docs/contracts/design.md
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Design reference</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Every components/ui/ primitive in every state. Dev-only, not linked from the sidebar.
        </p>
      </div>

      <Section title="Surfaces">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch className="bg-bg-base" name="bg-base" />
          <Swatch className="bg-bg-surface" name="bg-surface" />
          <Swatch className="bg-bg-sunken" name="bg-sunken" />
          <Swatch className="border-purple-400 bg-bg-surface" name="purple-400" />
        </div>
      </Section>

      <Section title="Text and contrast" description="See docs/contracts/design.md Contrast floor for the numbers.">
        <NeuCard className="flex flex-col gap-2">
          <p className="text-text-primary">text-primary, ~15.7:1 on bg-surface</p>
          <p className="text-text-secondary">text-secondary, ~6.7:1 on bg-surface</p>
          <p className="text-text-muted">text-muted, ~2.9:1, decorative use only, not body copy</p>
          <p className="text-warning">text-warning, ~12.7:1</p>
          <p className="text-danger">text-danger, ~6.6:1</p>
        </NeuCard>
      </Section>

      <Section title="Shadows">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {(["neu-raised", "neu-raised-sm", "neu-raised-lg", "neu-pressed", "neu-glow", "neu-floating"] as const).map(
            (shadow) => (
              <div key={shadow} className="flex flex-col gap-2">
                <div className={`h-20 rounded-neu border border-hairline bg-bg-surface shadow-${shadow}`} />
                <p className="font-mono text-xs text-text-secondary">shadow-{shadow}</p>
              </div>
            ),
          )}
        </div>
      </Section>

      <Section title="NeuButton" description="primary uses a glow halo, never a solid purple fill.">
        <div className="flex flex-wrap items-center gap-3">
          <NeuButton variant="primary">Primary</NeuButton>
          <NeuButton variant="default">Default</NeuButton>
          <NeuButton variant="ghost">Ghost</NeuButton>
          <NeuButton variant="destructive">Destructive</NeuButton>
          <NeuButton disabled variant="default">
            Disabled
          </NeuButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NeuButton size="sm">Small</NeuButton>
          <NeuButton size="md">Medium</NeuButton>
          <NeuButton size="lg">Large</NeuButton>
        </div>
      </Section>

      <Section title="NeuCard">
        <div className="grid gap-4 sm:grid-cols-2">
          <NeuCard>
            <p className="font-medium text-text-primary">Static card</p>
            <p className="mt-1 text-sm text-text-secondary">Not interactive, no hover state.</p>
          </NeuCard>
          <NeuCard interactive onClick={() => toast({ title: "Card activated" })}>
            <p className="font-medium text-text-primary">Interactive card</p>
            <p className="mt-1 text-sm text-text-secondary">Hover lift, Enter/Space, click to toast.</p>
          </NeuCard>
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
        <NeuWell>
          <p className="text-sm text-text-secondary">NeuWell: a static pressed container for grouping fields.</p>
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

      <Section title="NeuTabs">
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
        title="GridCell"
        description="Empty is sunken, partial/full rise with the purple coverage ramp, selected is a pressed well, conflict overrides with a danger hairline. The shared primitive behind every schedule grid."
      >
        <div className="flex flex-wrap gap-4">
          {GRID_CELL_STATES.map(({ state, coverage, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <GridCell coverage={coverage} filled={coverage ? Math.round(coverage * 3) : undefined} needed={coverage ? 3 : undefined} size="lg" state={state} />
              <p className="font-mono text-xs text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm text-text-secondary">Coverage ramp, 0 to 4 (interactive availability paint demo):</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((step) => (
              <GridCell
                key={step}
                interactive
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(step)) next.delete(step);
                    else next.add(step);
                    return next;
                  })
                }
                size="md"
                state={selected.has(step) ? "selected" : "empty"}
              />
            ))}
          </div>
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

      <Section title="Overlays" description="Dialog, Popover, Tooltip, Toast. All floating layers: flat surface, hairline, subtle glow.">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <NeuButton variant="default">Open dialog</NeuButton>
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
                  <NeuButton variant="ghost">Keep shift</NeuButton>
                </DialogClose>
                <DialogClose asChild>
                  <NeuButton variant="destructive">Cancel shift</NeuButton>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <NeuButton variant="default">Open popover</NeuButton>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm text-text-primary">Quick filters</p>
              <p className="mt-1 text-sm text-text-secondary">Station, date, and staffing status.</p>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <NeuButton variant="ghost">Hover me</NeuButton>
            </TooltipTrigger>
            <TooltipContent>Publish shifts</TooltipContent>
          </Tooltip>

          <NeuButton
            onClick={() =>
              toast({ title: "Shifts published", description: "12 members notified." })
            }
            variant="default"
          >
            Trigger toast
          </NeuButton>
          <NeuButton
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
          </NeuButton>
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
          <Avatar size="lg">
            <AvatarFallback size="lg">PN</AvatarFallback>
          </Avatar>
          <AvatarStack max={4} members={AVATAR_STACK_MEMBERS} size="md" />
        </div>
      </Section>
    </div>
  );
}
