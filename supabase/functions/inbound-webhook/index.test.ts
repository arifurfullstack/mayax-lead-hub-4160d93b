import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/inbound-webhook?dry_run=1`;

type Computed = {
  has_bankruptcy: boolean | null;
  trade_in: boolean | null;
  [k: string]: unknown;
};

type DryRunResult = {
  status: string;
  error?: string;
  computed?: Computed;
  reference_code?: string;
};

let phoneCounter = 5550000;
function nextPhone(): string {
  phoneCounter += 1;
  return `416${phoneCounter}`;
}

async function dryRun(body: unknown): Promise<DryRunResult[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.results as DryRunResult[];
}

function baseLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    first_name: "Alice",
    last_name: "Johnson",
    phone: nextPhone(),
    city: "Toronto",
    email: `alice${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────
// Canonical key mapping
// ────────────────────────────────────────────────────────────────────

Deno.test("canonical has_bankruptcy=true is preserved", async () => {
  const [r] = await dryRun([baseLead({ has_bankruptcy: true })]);
  assertEquals(r.status, "created");
  assertEquals(r.computed?.has_bankruptcy, true);
});

Deno.test("canonical has_bankruptcy=false is preserved", async () => {
  const [r] = await dryRun([baseLead({ has_bankruptcy: false })]);
  assertEquals(r.computed?.has_bankruptcy, false);
});

Deno.test("canonical trade_in_vehicle string is stored", async () => {
  const [r] = await dryRun([baseLead({ trade_in: true, trade_in_vehicle: "2018 Honda Civic" })]);
  assertEquals(r.status, "created");
  assertEquals(r.computed?.trade_in, true);
});

// ────────────────────────────────────────────────────────────────────
// Alias key mapping (Make.com mis-mappings)
// ────────────────────────────────────────────────────────────────────

Deno.test("alias 'bankruptcy' → has_bankruptcy", async () => {
  const [r] = await dryRun([baseLead({ bankruptcy: true })]);
  assertEquals(r.computed?.has_bankruptcy, true);
});

Deno.test("alias 'bankruptcy' string 'yes' → true", async () => {
  const [r] = await dryRun([baseLead({ bankruptcy: "yes" })]);
  assertEquals(r.computed?.has_bankruptcy, true);
});

Deno.test("alias 'bankruptcy' string 'no' → false", async () => {
  const [r] = await dryRun([baseLead({ bankruptcy: "no" })]);
  assertEquals(r.computed?.has_bankruptcy, false);
});

Deno.test("alias 'has bankruptcy' (with space) → has_bankruptcy", async () => {
  const [r] = await dryRun([baseLead({ "has bankruptcy": "1" })]);
  assertEquals(r.computed?.has_bankruptcy, true);
});

Deno.test("alias 'trade_in vehicle' (with space) → trade_in_vehicle accepted", async () => {
  const [r] = await dryRun([
    baseLead({ trade_in: true, "trade_in vehicle": "2020 Toyota Corolla" }),
  ]);
  assertEquals(r.status, "created");
  assertEquals(r.computed?.trade_in, true);
});

Deno.test("alias 'tradein_vehicle' → trade_in_vehicle accepted", async () => {
  const [r] = await dryRun([
    baseLead({ trade_in: true, tradein_vehicle: "2019 Mazda 3" }),
  ]);
  assertEquals(r.status, "created");
});

Deno.test("alias 'trade in vehicle' (spaces) accepted", async () => {
  const [r] = await dryRun([
    baseLead({ trade_in: true, "trade in vehicle": "2017 Ford Escape" }),
  ]);
  assertEquals(r.status, "created");
});

// ────────────────────────────────────────────────────────────────────
// Dynamic mapping: absent keys → null (not false / "")
// ────────────────────────────────────────────────────────────────────

Deno.test("absent has_bankruptcy → null", async () => {
  const [r] = await dryRun([baseLead()]);
  assertEquals(r.computed?.has_bankruptcy, null);
});

Deno.test("absent trade_in → null", async () => {
  const [r] = await dryRun([baseLead()]);
  assertEquals(r.computed?.trade_in, null);
});

Deno.test("empty-string has_bankruptcy normalizes to null (absent)", async () => {
  const [r] = await dryRun([baseLead({ has_bankruptcy: "" })]);
  assertEquals(r.computed?.has_bankruptcy, null);
});

Deno.test("empty-string trade_in_vehicle normalizes to null (absent)", async () => {
  const [r] = await dryRun([baseLead({ trade_in_vehicle: "   " })]);
  // trade_in not set → stays null too
  assertEquals(r.computed?.trade_in, null);
});

// ────────────────────────────────────────────────────────────────────
// Notes-based inference (when explicit keys absent)
// ────────────────────────────────────────────────────────────────────

Deno.test("notes mentioning 'bankruptcy' → has_bankruptcy=true", async () => {
  const [r] = await dryRun([baseLead({ notes: "Customer filed bankruptcy in 2022" })]);
  assertEquals(r.computed?.has_bankruptcy, true);
});

Deno.test("notes mentioning 'trade-in' → trade_in=true", async () => {
  const [r] = await dryRun([baseLead({ notes: "Has a trade-in vehicle" })]);
  assertEquals(r.computed?.trade_in, true);
});

// ────────────────────────────────────────────────────────────────────
// Conflict precedence: explicit value beats notes inference
// ────────────────────────────────────────────────────────────────────

Deno.test("explicit has_bankruptcy=false overrides notes mention", async () => {
  const [r] = await dryRun([
    baseLead({ has_bankruptcy: false, notes: "Mentioned bankruptcy in passing" }),
  ]);
  assertEquals(r.computed?.has_bankruptcy, false);
});

Deno.test("alias 'bankruptcy'=false overrides notes mention", async () => {
  const [r] = await dryRun([
    baseLead({ bankruptcy: "no", notes: "bankruptcy filed once" }),
  ]);
  assertEquals(r.computed?.has_bankruptcy, false);
});