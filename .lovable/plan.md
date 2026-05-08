# Lead Grades & Calling Script Pages

Add two new knowledge-base style pages visible to all logged-in dealers (and admins), with admin-only rich content editing.

## Sidebar (src/components/AppSidebar.tsx)

Add to the **Main** group, visible to everyone:
- `Lead Grades` → `/lead-grades` (icon: `Award` or `BadgeCheck`)
- `Calling Script` → `/calling-script` (icon: `PhoneCall`)

## Storage (reuse `platform_settings` table)

No new table needed — store HTML/markdown in existing `platform_settings` key/value table:
- `kb_lead_grades_content` — HTML body
- `kb_lead_grades_updated_at` — ISO timestamp
- `kb_calling_script_content` — HTML body
- `kb_calling_script_updated_at` — ISO timestamp

RLS already allows: anyone can read, admins can insert/update. Perfect fit.

## Dealer-facing pages

`src/pages/LeadGrades.tsx` and `src/pages/CallingScript.tsx`:
- Wrapped in `AppLayout` (sidebar + topbar) like existing dealer pages.
- Fetch the relevant `platform_settings` row.
- Render content via `dangerouslySetInnerHTML` inside a styled glass card with Tailwind `prose` typography.
- Show "Last updated" timestamp.
- Empty state: "Content coming soon — your admin hasn't published this yet."

Routes registered in `src/App.tsx` behind `ProtectedRoute` (any approved dealer).

## Admin editor

New tab in `AdminDashboard.tsx` called **Knowledge Base** containing component `src/components/AdminKnowledgeBase.tsx`:
- Two collapsible sections: Lead Grades, Calling Script.
- Each has a rich-text editor + Save button.
- Editor: lightweight — use a `Textarea` with HTML support plus a small toolbar (bold/italic/lists/headings/links) implemented via `document.execCommand` on a `contentEditable` div, OR install `@tiptap/react` + `@tiptap/starter-kit` for a proper WYSIWYG. **Recommended: Tiptap** for clean output.
- On save: upsert both `_content` and `_updated_at` rows in `platform_settings`.
- Live preview pane next to the editor.

## Files

- new: `src/pages/LeadGrades.tsx`
- new: `src/pages/CallingScript.tsx`
- new: `src/components/AdminKnowledgeBase.tsx`
- edit: `src/components/AppSidebar.tsx` (2 new menu items)
- edit: `src/App.tsx` (2 new routes)
- edit: `src/pages/AdminDashboard.tsx` (new tab)
- add deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`

No DB migration needed (reusing `platform_settings`).

## Open question

Should the pages be visible to **all logged-in dealers** including pending/suspended, or only **approved** ones? Default plan: approved only (matches other dealer routes via `ProtectedRoute`).