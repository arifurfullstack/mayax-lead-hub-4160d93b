## Problem

The "field" dropdown in `AdminGradeSettings` is hard-coded to a short list that omits credit and location columns, so rules built around them can't be created. Even if added, the recalculation edge function only selects a subset of lead columns, so new credit/location rules would silently score 0.

## Fix

1. **`src/components/AdminGradeSettings.tsx`** — extend `FIELD_OPTIONS` to include the available lead columns for credit + location:
   - `credit_range_min`
   - `credit_range_max`
   - `city`
   - `province`

2. **`supabase/functions/recalculate-lead-scores/index.ts`** — add `credit_range_min, credit_range_max, city, province` to the `.select(...)` so rules referencing them actually receive values during re-grading.

3. **`src/lib/leadScoring.ts`** — extend `LeadInput` typing with the four optional fields so client-side `calculateAiScore` (used at submit/preview time) reads them too. (`getFieldValue` already does dynamic lookup, but the type guards the callers.)

No DB migration, no UI restructure — just unlocking the existing fields end-to-end. After deploy, admins can pick e.g. `credit_range_min` with `≥ value` 650 → +X points, or `province` with `is present` → +X points.
