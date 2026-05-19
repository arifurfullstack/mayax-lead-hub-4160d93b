# Fix: "Credit" rule scores both leads the same

## Root cause

In Admin → Grade & AI Score Settings, the rule labeled **"Credit"** is saved as:

```
field: income
op:    between [300, 900]
points: 3
```

It targets the wrong column (`income`) and uses a numeric range that almost no lead's income falls inside, so it contributes **0 points to every lead** — including the one that has `credit_range_min=500, max=600`.

Both shown leads compute to the exact same 80:

```
base 65 + income present 5 + vehicle present 5 + city 3 + province 2 = 80
```

Nothing about credit is being evaluated.

## Plan

**1. Repair the rule in `platform_settings.grading_score_rules`** (one-row update via migration):
- Change `field` from `"income"` → `"credit_range_min"`
- Change `op` from `"between"` → `"present"`
- Drop the `value` array
- Keep `points: 3` (or whatever you want)

After this, any lead with a credit range gets +3, leads without it get 0 — Sagar would become 83 / B+, Arnab stays 80 / B.

**2. Re-grade all existing leads** by invoking `recalculate-lead-scores` once after the settings update so historical leads reflect the fix.

**3. (Optional polish) Guardrail in `AdminGradeSettings.tsx`** — when the field dropdown is `credit_range_min` / `credit_range_max`, default new rules to `op: present` instead of `gte 0`, so this misconfiguration is harder to repeat. Pure UX hint, no behavior change to existing rules.

## Technical notes

- No schema change. Only `platform_settings` row `grading_score_rules` is rewritten and edge function `recalculate-lead-scores` is invoked.
- `credit_range_min` and `credit_range_max` are already wired end-to-end (FIELD_OPTIONS, LeadInput, edge function `.select`) from the previous change, so the `present` op will work immediately.
- Alternative: you can fix this yourself in the Admin UI by editing that rule row (field → `credit_range_min`, op → `is present`, then Save — it auto-recalculates). Let me know if you'd rather do it manually instead of via migration.
