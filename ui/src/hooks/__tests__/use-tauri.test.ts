import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTauri } from "../use-tauri";

// Mock the tauri lib module
vi.mock("@/lib/tauri", () => ({
  isTauri: vi.fn(() => false),
  invokeTauri: vi.fn(async () => undefined),
  renderPlantUML: vi.fn(async () => undefined),
  ensurePlantUML: vi.fn(async () => undefined),
  getCachedConfig: vi.fn(() => null),
  saveAppConfig: vi.fn(async () => undefined),
}));

describe("useTauri hook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns isTauri: false in web context", () => {
    const { result } = renderHook(() => useTauri());
    expect(result.current.isTauri).toBe(false);
  });

  it("returns isTauri: true when Tauri is detected", async () => {
    const tauriModule = await import("@/lib/tauri");
    vi.mocked(tauriModule.isTauri).mockReturnValue(true);

    const { result } = renderHook(() => useTauri());
    expect(result.current.isTauri).toBe(true);
  });

  it("provides renderPlantUML function", () => {
    const { result } = renderHook(() => useTauri());
    expect(typeof result.current.renderPlantUML).toBe("function");
  });

  it("provides ensurePlantUML function", () => {
    const { result } = renderHook(() => useTauri());
    expect(typeof result.current.ensurePlantUML).toBe("function");
  });

  it("provides invoke function", () => {
    const { result } = renderHook(() => useTauri());
    expect(typeof result.current.invoke).toBe("function");
  });

  it("renderPlantUML calls underlying utility", async () => {
    const tauriModule = await import("@/lib/tauri");
    const mockRender = vi
      .mocked(tauriModule.renderPlantUML)
      .mockResolvedValue("<svg>test</svg>");

    const { result } = renderHook(() => useTauri());
    const svg = await result.current.renderPlantUML("@startuml\ntest\n@enduml");

    expect(mockRender).toHaveBeenCalledWith("@startuml\ntest\n@enduml");
    expect(svg).toBe("<svg>test</svg>");
  });

  it("ensurePlantUML calls underlying utility", async () => {
    const tauriModule = await import("@/lib/tauri");
    const mockEnsure = vi
      .mocked(tauriModule.ensurePlantUML)
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useTauri());
    await result.current.ensurePlantUML();

    expect(mockEnsure).toHaveBeenCalled();
  });

  it("invoke calls underlying utility", async () => {
    const tauriModule = await import("@/lib/tauri");
    const mockInvoke = vi
      .mocked(tauriModule.invokeTauri)
      .mockResolvedValue("result");

    const { result } = renderHook(() => useTauri());
    const value = await result.current.invoke("test_cmd", { key: "val" });

    expect(mockInvoke).toHaveBeenCalledWith("test_cmd", { key: "val" });
    expect(value).toBe("result");
  });

  it("memoizes isTauri detection across re-renders", async () => {
    const tauriModule = await import("@/lib/tauri");
    const mockDetect = vi.mocked(tauriModule.isTauri).mockReturnValue(false);

    const { result, rerender } = renderHook(() => useTauri());
    expect(result.current.isTauri).toBe(false);

    // Snapshot the call count after initial render. React 19 may invoke
    // useMemo's factory multiple times on mount (StrictMode, concurrent
    // rendering). The contract under test is that *re-renders* don't add
    // calls — not that initial mount is exactly one call.
    const callsAfterMount = mockDetect.mock.calls.length;

    rerender();
    rerender();

    expect(mockDetect).toHaveBeenCalledTimes(callsAfterMount);
  });
});
