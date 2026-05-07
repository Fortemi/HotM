import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isTauri,
  invokeTauri,
  renderPlantUML,
  ensurePlantUML,
  getHostAdapter,
  hasHostAdapter,
  type HotmHostAdapter,
} from "../tauri";

describe("tauri utilities", () => {
  afterEach(() => {
    // Clean up any __TAURI_INTERNALS__ we may have set
    if ("__TAURI_INTERNALS__" in window) {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
    const w = window as unknown as Record<string, unknown>;
    delete w.__HOTM_HOST__;
    vi.restoreAllMocks();
  });

  describe("isTauri", () => {
    it("returns false in regular browser context", () => {
      expect(isTauri()).toBe(false);
    });

    it("returns true when __TAURI_INTERNALS__ is present", () => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
      expect(isTauri()).toBe(true);
    });

    it("returns true when __TAURI_INTERNALS__ has content", () => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: vi.fn(),
      };
      expect(isTauri()).toBe(true);
    });
  });

  describe("invokeTauri", () => {
    it("returns undefined when not in Tauri context", async () => {
      const result = await invokeTauri("some_command");
      expect(result).toBeUndefined();
    });

    it("returns undefined when not in Tauri context with args", async () => {
      const result = await invokeTauri("some_command", { key: "value" });
      expect(result).toBeUndefined();
    });

    it("calls @tauri-apps/api invoke when in Tauri context", async () => {
      const mockInvoke = vi.fn().mockResolvedValue("result");

      // Mock the dynamic import
      vi.doMock("@tauri-apps/api/core", () => ({
        invoke: mockInvoke,
      }));

      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

      // Re-import to get the mocked version
      const { invokeTauri: mockedInvoke } = await import("../tauri");
      const result = await mockedInvoke("test_cmd", { foo: "bar" });

      expect(mockInvoke).toHaveBeenCalledWith("test_cmd", { foo: "bar" });
      expect(result).toBe("result");
    });
  });

  describe("renderPlantUML", () => {
    it("returns undefined when not in Tauri context", async () => {
      const result = await renderPlantUML("@startuml\nBob -> Alice\n@enduml");
      expect(result).toBeUndefined();
    });
  });

  describe("ensurePlantUML", () => {
    it("resolves without error when not in Tauri context", async () => {
      await expect(ensurePlantUML()).resolves.toBeUndefined();
    });
  });

  describe("getHostAdapter", () => {
    function makeAdapter(version?: number): HotmHostAdapter {
      return {
        ...(version !== undefined ? { version } : {}),
        network: {
          sse: { connect: vi.fn().mockResolvedValue({ handle: "h", event: "e" }) },
          fetch: vi.fn(),
        },
      };
    }

    it("returns null when no adapter is published", () => {
      expect(getHostAdapter()).toBeNull();
      expect(hasHostAdapter()).toBe(false);
    });

    it("returns the canonical __HOTM_HOST__ adapter when present", () => {
      const adapter = makeAdapter(1);
      (window as unknown as Record<string, unknown>).__HOTM_HOST__ = adapter;
      expect(getHostAdapter()).toBe(adapter);
      expect(hasHostAdapter()).toBe(true);
    });

    it("returns null when adapter is malformed (missing network.fetch)", () => {
      (window as unknown as Record<string, unknown>).__HOTM_HOST__ = {
        network: { sse: { connect: vi.fn() } },
      } as unknown as HotmHostAdapter;
      expect(getHostAdapter()).toBeNull();
    });

    it("returns null when adapter is malformed (missing network.sse.connect)", () => {
      (window as unknown as Record<string, unknown>).__HOTM_HOST__ = {
        network: { fetch: vi.fn(), sse: {} },
      } as unknown as HotmHostAdapter;
      expect(getHostAdapter()).toBeNull();
    });
  });
});
