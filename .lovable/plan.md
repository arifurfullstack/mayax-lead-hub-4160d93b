# Publish Lead Grades content

Publish the dealer guide content you provided into the **Lead Grades** knowledge base page so it's immediately visible to all approved dealers.

## What gets published

The full guide formatted as semantic HTML, written into the existing `platform_settings` row (`kb_lead_grades_content`), with `kb_lead_grades_updated_at` set to now.

Sections included (in order):
- Introduction
- How MayaX Lead Hub Works
- Understanding MayaX Lead Grades (A+, A, B+, B, C+)
- Important Dealer Disclosure
- What Determines Lead Grades
- C / C+ Grade Leads ($25 range) + recommended strategy
- B / B+ Grade Leads ($45–$55 range) + recommended strategy
- A / A+ Grade Leads ($60+ range) + recommended strategy
- Important Expectations About Lead Grades
- Why Some Customers May Say "Not Interested"
- Dealer Rep Positioning + Correct Positioning Examples

## Formatting

- `<h2>` for major sections, `<h3>` for sub-sections
- `<p>` paragraphs, `<ul><li>` bullet lists
- `<strong>` for emphasis (NEVER, SHOULD, grade names, dollar ranges)
- Renders inside the existing `prose prose-invert` styling — no CSS changes
- "Last updated" timestamp updates automatically

## How

Direct upsert into `platform_settings` via a one-time SQL migration. RLS already permits admin writes; this runs as the migration role. No code, schema, sidebar, or UI changes.

## Files touched

None — content-only DB write.

## Note

The Calling Script page is left untouched. The "Dealer Rep Positioning" piece will live on the Lead Grades page as part of the full guide. If you'd rather split positioning/script guidance onto the Calling Script page instead, say so before I run.
