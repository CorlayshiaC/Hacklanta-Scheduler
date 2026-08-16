import type { ShellRole } from "@/components/layout/nav-config";

/** Re-exports Agent 1's ShellRole (member | organizer | admin) rather than a second copy of the
 * same union, so a mapping bug can't drift the palette out of sync with the sidebar/tab bar. */
export type Role = ShellRole;

export type CommandSection = "navigation" | "action" | "ai";

export type CommandContext = {
  role: Role;
  navigate: (href: string) => void;
};

export type Command = {
  id: string;
  label: string;
  section: CommandSection;
  /** Key sequence, e.g. ["g", "c"] for a chord or ["n"] for a single key. Optional: not every
   * command needs a shortcut, only ones worth binding get one. */
  shortcut?: string[];
  keywords?: string[];
  /** Omit to allow every role. Present roles are hidden entirely (not disabled) for anyone else. */
  roles?: Role[];
  perform: (ctx: CommandContext) => void | Promise<void>;
};

export type SearchResult = {
  id: string;
  label: string;
  sublabel?: string;
  perform: (ctx: CommandContext) => void | Promise<void>;
};

export type SearchProvider = (query: string, ctx: { role: Role }) => Promise<SearchResult[]>;
