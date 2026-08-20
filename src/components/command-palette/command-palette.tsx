"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { NlPaletteMode } from "@/components/command-palette/modes/nl-mode";
import { getSearchProvider } from "@/components/command-palette/registry";
import { NeuBadge } from "@/components/ui/neu-badge";
import { SPRING_SNAP, SPRING_STANDARD, STAGGER_TIGHT } from "@/lib/utils/motion";
import type { Command, CommandContext, SearchResult } from "@/components/command-palette/types";

/** motion-spec.md v4.1 section 2, "Command palette": results cascade capped at 8, a stricter
 * per-surface override of section 0 law 6's general 30/12 list cap. */
const RESULT_CASCADE_CAP = 8;

type PaletteMode = "commands" | "search" | "nl";

function visibleCommands(commands: Command[], role: CommandContext["role"]): Command[] {
  return commands.filter((command) => !command.roles || command.roles.includes(role));
}

function matchesQuery(command: Command, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [command.label, ...(command.keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function shortcutLabel(shortcut: string[] | undefined): string | null {
  if (!shortcut || shortcut.length === 0) {
    return null;
  }
  return shortcut.map((key) => (key === " " ? "space" : key)).join(" then ");
}

export function CommandPalette(props: {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  ctx: CommandContext;
  initialMode?: PaletteMode;
}) {
  const [mode, setMode] = useState<PaletteMode>(props.initialMode ?? "commands");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [fetchedResults, setFetchedResults] = useState<SearchResult[]>([]);
  const searchProvider = mode === "search" ? getSearchProvider() : null;
  const reducedMotion = useReducedMotion();
  const panelTransition = reducedMotion ? { duration: 0 } : SPRING_STANDARD;
  const underlineTransition = reducedMotion ? { duration: 0 } : SPRING_SNAP;
  const selectionTransition = reducedMotion ? { duration: 0 } : SPRING_SNAP;

  const filteredCommands = useMemo(() => {
    const visible = visibleCommands(props.commands, props.ctx.role);
    return visible.filter((command) => matchesQuery(command, query));
  }, [props.commands, props.ctx.role, query]);

  useEffect(() => {
    if (!searchProvider || !query.trim()) {
      return;
    }

    let cancelled = false;
    searchProvider(query, { role: props.ctx.role }).then((results) => {
      if (!cancelled) {
        setFetchedResults(results);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchProvider, query, props.ctx.role]);

  // Derived rather than reset via an effect: fetchedResults only ever holds the last completed
  // fetch, whether it's stale (provider missing, query cleared, mode switched) is computed here.
  const searchResults = searchProvider && query.trim() ? fetchedResults : [];
  const results = mode === "commands" ? filteredCommands : searchResults;

  function runAt(index: number) {
    const item = results[index];
    if (!item) {
      return;
    }
    void item.perform(props.ctx);
    props.onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (mode === "nl") {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(activeIndex);
    }
  }

  const modeTabs: { value: PaletteMode; label: string }[] = [
    { value: "commands", label: "Commands" },
    { value: "search", label: "Search" },
    { value: "nl", label: "Describe" },
  ];

  return (
    <AnimatePresence>
      {props.isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-app/80 pt-[12vh]"
          onClick={props.onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={panelTransition}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-card border border-hairline bg-surface-card text-text-primary shadow-soft backdrop-blur-glass"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="relative mx-4 mt-4 flex w-fit gap-4 border-b border-hairline">
              {modeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setMode(tab.value)}
                  className={
                    "relative px-1 pb-2 text-sm font-medium transition-colors duration-fast " +
                    (mode === tab.value ? "text-text-primary" : "text-text-secondary hover:text-text-primary")
                  }
                >
                  {tab.label}
                  {mode === tab.value && (
                    <motion.span
                      layoutId="palette-mode-underline"
                      className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent-go"
                      transition={underlineTransition}
                    />
                  )}
                </button>
              ))}
            </div>

            {mode !== "nl" && (
              <div className="border-b border-hairline px-4 pb-4 pt-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={mode === "commands" ? "Type a command." : "Search shifts, events, people."}
                  className="w-full rounded-pill bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus-visible:shadow-focus-ring"
                />
              </div>
            )}

            {mode === "nl" ? (
              <NlPaletteMode ctx={props.ctx} onClose={props.onClose} />
            ) : (
              <ul className="relative flex max-h-80 flex-col gap-0.5 overflow-y-auto p-2">
                {results.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-text-muted">
                    {mode === "search" && !getSearchProvider()
                      ? "Search isn't wired up yet."
                      : "No matches."}
                  </li>
                )}
                {results.map((resultItem, index) => {
                  const selected = index === activeIndex;
                  const shortcut = "shortcut" in resultItem ? shortcutLabel((resultItem as Command).shortcut) : null;
                  const cascadeIndex = Math.min(index, RESULT_CASCADE_CAP - 1);
                  return (
                    <motion.li
                      key={resultItem.id}
                      className="relative"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...panelTransition, delay: reducedMotion ? 0 : cascadeIndex * STAGGER_TIGHT }}
                    >
                      {selected && (
                        <motion.div
                          layoutId="palette-selection"
                          className="absolute inset-0 rounded-pill bg-pill-white"
                          transition={selectionTransition}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => runAt(index)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={
                          "relative z-10 flex w-full items-center justify-between gap-3 rounded-pill px-4 py-2 text-left text-sm " +
                          (selected ? "text-on-accent" : "text-text-secondary hover:bg-elevated hover:text-text-primary")
                        }
                      >
                        <span>{resultItem.label}</span>
                        {shortcut && (
                          <NeuBadge
                            className={
                              "font-mono text-[10px] " +
                              (selected ? "border-transparent bg-black/10 text-on-accent" : "")
                            }
                          >
                            {shortcut}
                          </NeuBadge>
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
