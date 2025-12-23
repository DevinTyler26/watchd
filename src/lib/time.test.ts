import { describe, expect, it, vi } from "vitest";
import { relativeTimeFromNow } from "./time";

describe("relativeTimeFromNow", () => {
  it("returns seconds for near-term past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:10Z"));
    const value = relativeTimeFromNow(new Date("2025-01-01T00:00:00Z"));
    expect(value).toBe("10 seconds ago");
    vi.useRealTimers();
  });

  it("returns hours for earlier times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
    const value = relativeTimeFromNow(new Date("2025-01-01T09:00:00Z"));
    expect(value).toBe("3 hours ago");
    vi.useRealTimers();
  });

  it("handles future events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const value = relativeTimeFromNow(new Date("2025-01-02T00:00:00Z"));
    expect(value).toBe("tomorrow");
    vi.useRealTimers();
  });
});
