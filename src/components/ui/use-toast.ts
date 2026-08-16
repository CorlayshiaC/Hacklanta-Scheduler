"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ToastActionElement, ToastProps } from "./toast";

/** Viewport stays uncluttered; oldest toast is dropped once a new one pushes past this. */
const MAX_TOASTS = 3;
/**
 * Toasts stay in state for one exit-transition's worth of time after being dismissed so
 * Radix's close animation (duration-base) can finish before the entry is pruned from the array.
 */
const TOAST_REMOVE_DELAY = 300;

export type ToasterToast = ToastProps & {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ToastActionElement;
};

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

type State = { toasts: ToasterToast[] };

let count = 0;
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function queueRemove(toastId: string) {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { toasts: [action.toast, ...state.toasts].slice(0, MAX_TOASTS) };

    case "UPDATE_TOAST":
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) {
        queueRemove(toastId);
      } else {
        state.toasts.forEach((t) => queueRemove(t.id));
      }
      return {
        toasts: state.toasts.map((t) =>
          toastId === undefined || t.id === toastId ? { ...t, open: false } : t,
        ),
      };
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { toasts: [] };
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) };

    default:
      return state;
  }
}

// Module-level store: a listener array of setState functions plus a plain in-memory state
// object (no context/store library) so toast() can be called from anywhere — event handlers,
// effects, client wrappers around server actions — without needing to be inside a provider tree.
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

export type ToastInput = Omit<ToasterToast, "id">;

/** Imperative trigger, e.g. `toast({ title: "Saved", description: "..." })` from a handler. */
export function toast(props: ToastInput) {
  const id = genId();

  const update = (next: Partial<ToastInput>) =>
    dispatch({ type: "UPDATE_TOAST", toast: { ...next, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update };
}

/** Read the live toast queue and a dismiss handle; feeds the <Toaster/> in toast.tsx. */
export function useToast(): { toasts: ToasterToast[]; dismiss: (toastId?: string) => void } {
  const [state, setState] = useState<State>(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}
