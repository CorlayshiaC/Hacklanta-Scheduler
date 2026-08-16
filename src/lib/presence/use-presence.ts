"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PresenceMember } from "@/lib/presence/types";

/**
 * Joins a named presence scope (one Realtime channel per scope string, e.g.
 * "coverage-board:{eventId}") for as long as the component is mounted and self is non-null, and
 * leaves on unmount. The .on("presence", {event: "sync"}) listener below is what enables this
 * client to receive presence state at all, per @supabase/realtime-js's config.presence.enabled
 * doc comment, adding it before subscribe() is what makes that automatic.
 */
export function usePresence(
  scope: string,
  self: PresenceMember | null,
): { members: PresenceMember[]; count: number } {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const selfId = self?.id;
  const selfName = self?.name;
  const selfAvatarUrl = self?.avatarUrl;

  useEffect(() => {
    if (!selfId || !selfName) {
      return;
    }
    const trackedSelf: PresenceMember = { id: selfId, name: selfName, avatarUrl: selfAvatarUrl };

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`presence:${scope}`, {
      config: { presence: { key: selfId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMember>();
      setMembers(dedupeById(Object.values(state).flat()));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track(trackedSelf);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
    // Re-join only when the scope or the tracked identity actually changes, not on every render
    // that produces a new `self` object with the same field values.
  }, [scope, selfId, selfName, selfAvatarUrl]);

  // Derived, not reset via setState in the effect above: while self is unknown/absent there is
  // nothing joined, so there is nothing to report, regardless of what the last join left behind.
  return { members: self ? members : [], count: self ? members.length : 0 };
}

function dedupeById(members: PresenceMember[]): PresenceMember[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  return Array.from(byId.values());
}
