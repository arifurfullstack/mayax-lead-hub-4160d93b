# Publish Calling Script guide

Publish the full "Dealer Rep Calling & Texting Guide" you provided into the **Calling Script** knowledge base page so it's immediately visible to all approved dealers.

## What gets published

The complete guide formatted as semantic HTML, written into `platform_settings.kb_calling_script_content`, with `kb_calling_script_updated_at` set to now.

Sections included (in order):
- Overview
- The Correct Positioning (NEVER / ALWAYS)
- Daily Contact Rules
- Opening Call Script
- Building Trust
- Finding the Customer's Weak Spots
- Credit Questions
- Income Questions
- Trade-In Questions
- The Exception Approval Strategy
- Appointment Strategy
- Same-Day Appointment Close
- Next-Day Appointment Close
- Expiration Pressure
- Long-Distance Customers
- Common Objections & Rebuttals (6 scripted rebuttals)
- Voicemail Script
- Missed Call Text Message
- CRM Notes Standards (with example note)
- Final Important Rules (NEVER / ALWAYS + emotional triggers)

## Formatting

- `<h2>` for major sections, `<h3>` for sub-sections
- `<p>` for paragraphs and script lines, `<ul><li>` for bullet lists
- `<strong>` for emphasis (NEVER, ALWAYS, customer placeholders, dollar amounts)
- `<blockquote>` for verbatim script lines reps should read
- Renders inside the existing `prose prose-invert` styling on /calling-script — no CSS changes
- "Last updated" timestamp updates automatically

## How

Direct upsert into `platform_settings` via a one-time SQL migration (delete + insert pattern, same as the Lead Grades publish). No code, schema, sidebar, or UI changes.

## Files touched

None — content-only DB write.

## Note

The Lead Grades page is left untouched.
