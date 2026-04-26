import { describe, it, expect } from "vitest";
import {
  easternStartOfDay,
  easternEndOfDay,
  getEasternParts,
} from "@/lib/easternTime";

/**
 * Mirrors the Today/Yesterday bucketing logic used by AdminLeadTable's
 * `timeRange` memo, so we can test it in isolation.
 */
function bucketForLead(leadCreatedAt: Date, now: Date): "today" | "yesterday" | "other" {
  const todayStart = easternStartOfDay(now);
  const todayEnd = easternEndOfDay(now);
  if (leadCreatedAt >= todayStart && leadCreatedAt <= todayEnd) return "today";

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yStart = easternStartOfDay(yesterday);
  const yEnd = easternEndOfDay(yesterday);
  if (leadCreatedAt >= yStart && leadCreatedAt <= yEnd) return "yesterday";

  return "other";
}

describe("Eastern Time bucketing near midnight", () => {
  it("places a lead created at 11:30 PM ET under Today (not Yesterday)", () => {
    // Pick a date in EST (winter, UTC-5): Jan 15, 2026, 23:30 ET => 04:30 UTC Jan 16.
    const leadCreated = new Date("2026-01-16T04:30:00.000Z");
    // "Now" is just a few minutes later, still the same Eastern day.
    const now = new Date("2026-01-16T04:45:00.000Z");

    // Sanity-check: in Eastern Time, both instants are on Jan 15.
    expect(getEasternParts(leadCreated).day).toBe(15);
    expect(getEasternParts(now).day).toBe(15);

    expect(bucketForLead(leadCreated, now)).toBe("today");
  });

  it("places a lead created at 11:30 PM ET under Today during EDT (summer)", () => {
    // EDT (UTC-4): Jul 15, 2026, 23:30 ET => 03:30 UTC Jul 16.
    const leadCreated = new Date("2026-07-16T03:30:00.000Z");
    const now = new Date("2026-07-16T03:45:00.000Z");

    expect(getEasternParts(leadCreated).day).toBe(15);
    expect(getEasternParts(now).day).toBe(15);

    expect(bucketForLead(leadCreated, now)).toBe("today");
  });

  it("does NOT bucket an 11:30 PM ET lead under Yesterday when viewed minutes later", () => {
    const leadCreated = new Date("2026-01-16T04:30:00.000Z"); // Jan 15 23:30 ET
    const now = new Date("2026-01-16T04:45:00.000Z"); // Jan 15 23:45 ET
    expect(bucketForLead(leadCreated, now)).not.toBe("yesterday");
  });

  it("buckets a lead from the previous Eastern day under Yesterday", () => {
    // Lead created Jan 14 23:30 ET = Jan 15 04:30 UTC.
    // Now is Jan 15 23:45 ET = Jan 16 04:45 UTC.
    const leadCreated = new Date("2026-01-15T04:30:00.000Z");
    const now = new Date("2026-01-16T04:45:00.000Z");

    expect(getEasternParts(leadCreated).day).toBe(14);
    expect(getEasternParts(now).day).toBe(15);

    expect(bucketForLead(leadCreated, now)).toBe("yesterday");
  });

  it("rolls over correctly: a lead at 00:05 ET is Today, while 23:55 ET prior is Yesterday", () => {
    // EST: Feb 10, 2026 00:05 ET = 05:05 UTC.
    const justAfterMidnight = new Date("2026-02-10T05:05:00.000Z");
    // Same day viewer at 00:10 ET = 05:10 UTC.
    const now = new Date("2026-02-10T05:10:00.000Z");

    expect(getEasternParts(justAfterMidnight).day).toBe(10);
    expect(bucketForLead(justAfterMidnight, now)).toBe("today");

    // A lead from 23:55 ET the night before = Feb 10 04:55 UTC.
    const justBeforeMidnight = new Date("2026-02-10T04:55:00.000Z");
    expect(getEasternParts(justBeforeMidnight).day).toBe(9);
    expect(bucketForLead(justBeforeMidnight, now)).toBe("yesterday");
  });
});
