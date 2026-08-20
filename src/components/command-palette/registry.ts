"use client";

import { useSyncExternalStore } from "react";
import type { Command, SearchProvider } from "@/components/command-palette/types";

/**
 * Module-level singleton. Any client component, in any agent's territory, can call
 * registerCommand at mount time (inside a useEffect, unregister on cleanup) to add itself to the
 * palette without this module ever importing that component. This is the intended integration
 * path: self-registration, not "Agent 6 imports and wires everyone's action functions", since the
 * latter would require this file to import code that does not exist yet in every other agent's
 * still-scaffolding territory. See docs/contracts/command-palette.md.
 */

type Listener = () => void;

const commands = new Map<string, Command>();
const listeners = new Set<Listener>();
let searchProvider: SearchProvider | null = null;
// useSyncExternalStore requires getSnapshot to return a referentially stable value when nothing
// changed, or React re-renders forever ("getSnapshot should be cached"). Array.from(commands.
// values()) is a fresh array on every call, so it's cached here and only rebuilt in notify().
let snapshot: Command[] = [];

export function registerCommand(command: Command): () => void {
  commands.set(command.id, command);
  notify();
  return () => {
    commands.delete(command.id);
    notify();
  };
}

export function registerSearchProvider(provider: SearchProvider): () => void {
  searchProvider = provider;
  return () => {
    if (searchProvider === provider) {
      searchProvider = null;
    }
  };
}

export function getSearchProvider(): SearchProvider | null {
  return searchProvider;
}

function listCommands(): Command[] {
  return snapshot;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  snapshot = Array.from(commands.values());
  listeners.forEach((listener) => listener());
}

export function useCommands(): Command[] {
  return useSyncExternalStore(subscribe, listCommands, listCommands);
}
