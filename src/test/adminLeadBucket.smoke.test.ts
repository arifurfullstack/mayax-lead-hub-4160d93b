import { describe, it, expect } from "vitest";
import {
  easternStartOfDay,
  easternEndOfDay,
  getEasternParts,
} from "@/lib/easternTime";

/**
 * Smoke test for the Admin lead table's "Today" bucket.
 *
 * Mirrors the bucketing performed by `AdminLeadTable`'s `timeRange` memo:
 * a lead is "Today" iff its `created_at` falls within
 * [easternStartOfDay(now), easternEndOfDay(now)].
 *
 * Specifically asserts: a lead created just before midnight Eastern Time
 * is bucketed under Today (not Yesterday) when viewed seconds later in
 * the same Eastern day.
 */
function isToday(leadCreatedAt: Date, now: Date): boolean {
  const start = easternStartOfDay(now);
  const end = easternEndOfDay(now);
  return leadCreatedAt >= start && leadCreatedAt <= end;
}

describe("Admin lead table — Today bucket smoke test", () => {
  it("buckets a lead created just before midnight ET under Today (EST / winter)", () => {
    // Mar 1, 2026 23:59:30 ET (EST, UTC-5) === Mar 2, 2026 04:59:30 UTC.
    const justBeforeMidnight = new Date("2026-03-02T04:59:30.000Z");
    // Viewer reloads the admin page 15 seconds later, still Mar 1 ET.
    const now = new Date("2026-03-02T04:59:45.000Z");

    // Sanity: both instants resolve to Mar 1 in Eastern Time.
    expect(getEasternParts(justBeforeMidnight).day).toBe(1);
    expect(getEasternParts(now).day).toBe(1);

    expect(isToday(justBeforeMidnight, now)).toBe(true);
  });

  it("buckets a lead created just before midnight ET under Today (EDT / summer)", () => {
    // Aug 20, 2026 23:59:45 ET (EDT, UTC-4) === Aug 21, 2026 03:59:45 UTC.
    const justBeforeMidnight = new Date("2026-08-21T03:59:45.000Z");
    const now = new Date("2026-08-21T03:59:55.000Z");

    expect(getEasternParts(justBeforeMidnight).day).toBe(20);
    expect(getEasternParts(now).day).toBe(20);

    expect(isToday(justBeforeMidnight, now)).toBe(true);
  });
});