import { describe, it, expect, afterEach, vi } from "vitest";
import { isTauri, invokeTauri, renderPlantUML, ensurePlantUML } from "../tauri";

describe("tauri utilities", () => {
  afterEach(() => {
    // Clean up any __TAURI_INTERNALS__ we may have set
    if ("__TAURI_INTERNALS__" in window) {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
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
});
