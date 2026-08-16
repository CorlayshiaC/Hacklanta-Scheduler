"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { NlPaletteMode } from "@/components/command-palette/modes/nl-mode";
import { getSearchProvider } from "@/components/command-palette/registry";
import type { Command, CommandContext, SearchResult } from "@/components/command-palette/types";

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

  if (!props.isOpen) {
    return null;
  }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={props.onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-neu-lg border border-hairline bg-bg-surface shadow-neu-floating"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          {(["commands", "search", "nl"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={
                "rounded-neu-sm px-2 py-1 text-xs transition-colors duration-fast ease-neu-out " +
                (mode === tab ? "bg-bg-sunken text-purple-400 shadow-neu-pressed" : "text-text-muted hover:text-text-secondary")
              }
            >
              {tab === "commands" ? "Commands" : tab === "search" ? "Search" : "Describe"}
            </button>
          ))}
        </div>

        {mode !== "nl" && (
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={mode === "commands" ? "Type a command." : "Search shifts, events, people."}
            className="border-b border-hairline bg-transparent px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        )}

        {mode === "nl" ? (
          <NlPaletteMode ctx={props.ctx} onClose={props.onClose} />
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-text-muted">
                {mode === "search" && !getSearchProvider()
                  ? "Search isn't wired up yet."
                  : "No matches."}
              </li>
            )}
            {results.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => runAt(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={
                    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors duration-fast " +
                    (index === activeIndex ? "bg-bg-sunken text-text-primary" : "text-text-secondary")
                  }
                >
                  <span>{item.label}</span>
                  {"shortcut" in item && shortcutLabel((item as Command).shortcut) && (
                    <span className="font-mono text-xs text-text-muted">
                      {shortcutLabel((item as Command).shortcut)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
