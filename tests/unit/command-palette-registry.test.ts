import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getSearchProvider,
  registerCommand,
  registerSearchProvider,
  useCommands,
} from "@/components/command-palette/registry";

/**
 * The registry is a module-level singleton (by design, see docs/contracts/command-palette.md), so
 * every test unregisters what it registers rather than asserting on the full list, to stay
 * independent of what other tests in this file have left behind.
 */
describe("command registry", () => {
  it("useCommands sees a command as soon as it registers and not after it unregisters", () => {
    const { result } = renderHook(() => useCommands());

    let unregister!: () => void;
    act(() => {
      unregister = registerCommand({
        id: "test.command",
        label: "Test command",
        section: "action",
        perform: () => {},
      });
    });

    expect(result.current.find((command) => command.id === "test.command")?.label).toBe("Test command");

    act(() => unregister());

    expect(result.current.find((command) => command.id === "test.command")).toBeUndefined();
  });

  it("re-registering the same id replaces the earlier registration", () => {
    const { result } = renderHook(() => useCommands());
    let unregister!: () => void;

    act(() => {
      registerCommand({ id: "test.dup", label: "First", section: "action", perform: () => {} });
      unregister = registerCommand({ id: "test.dup", label: "Second", section: "action", perform: () => {} });
    });

    expect(result.current.filter((command) => command.id === "test.dup")).toHaveLength(1);
    expect(result.current.find((command) => command.id === "test.dup")?.label).toBe("Second");

    act(() => unregister());
  });

  it("registerSearchProvider replaces the previous provider, unregistering only affects the current one", () => {
    const first = async () => [];
    const second = async () => [];

    const unregisterFirst = registerSearchProvider(first);
    expect(getSearchProvider()).toBe(first);

    const unregisterSecond = registerSearchProvider(second);
    expect(getSearchProvider()).toBe(second);

    unregisterFirst(); // stale: second is active now, this must not clear it
    expect(getSearchProvider()).toBe(second);

    unregisterSecond();
    expect(getSearchProvider()).toBeNull();
  });
});
