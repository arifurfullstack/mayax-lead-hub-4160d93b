

# AI Score & Grade Auto-Calculation

## Summary
Add a `notes` column to leads, create a shared `calculateAiScore` utility that computes AI score (65–100) and grade (D–A+) from lead data, and apply it everywhere leads are created: Admin Add Lead dialog, inbound webhook, and file uploader.

## New Grade Scale
Current system only has A+, A, B, C. New system adds B+, C+, D+, D:

| Score | Grade |
|-------|-------|
| 97–100 | A+ |
| 93–96 | A |
| 89–92 | B+ |
| 85–88 | B |
| 81–84 | C+ |
| 77–80 | C |
| 73–76 | D+ |
| 65–72 | D |

## Scoring Rules (base 65, cap 100)
- **Income**: missing/<1800 → +0, 1800–4999 → +5, 5000+ → +10
- **Vehicle**: none → +0, generic keyword (Car/SUV/Truck/Sedan/Van) → +5, specific (anything else) → +10
- **Trade/Refinance**: buyer_type or notes mentions trade/refinance → +5
- **Bankruptcy**: notes mentions bankruptcy → +5
- **Appointment**: appointment_time is set → +5
- **Completeness**: has BOTH income AND vehicle → +5

## Changes

### 1. Database Migration
- Add `notes TEXT` column to `leads` table
- Update `get_marketplace_leads` function to return the new column

### 2. Shared Scoring Utility — `src/lib/leadScoring.ts`
- `calculateAiScore(lead)` → returns `{ ai_score: number, quality_grade: string }`
- Pure function, reusable on client and can be ported to edge functions

### 3. Duplicate Scoring for Edge Function — `supabase/functions/inbound-webhook/index.ts`
- Inline the same scoring logic (edge functions can't import from `src/`)
- Accept `notes` field in inbound payload
- Auto-compute `ai_score` and `quality_grade` instead of trusting input values
- Remove manual `ai_score` / `quality_grade` from accepted fields

### 4. Admin Add Lead Dialog — `src/components/AdminAddLeadDialog.tsx`
- Add `notes` textarea field (for trade/refinance/bankruptcy mentions)
- Remove manual AI Score and Quality Grade inputs — they auto-calculate on submit
- Show computed score + grade as a live preview while filling the form

### 5. Lead Card / UI Updates
- Update `gradeColors` in `LeadCard.tsx` to include B+, C+, D+, D colors

### 6. File Uploader — `src/components/LeadFileUploader.tsx`
- Apply scoring after CSV parse before insert

## Technical Notes
- The `notes` field is hidden from marketplace display (PII-like); the `get_marketplace_leads` function will NOT expose it to non-purchasing dealers
- AI score and grade fields remain on the table but are now always auto-computed — admin cannot manually override them

