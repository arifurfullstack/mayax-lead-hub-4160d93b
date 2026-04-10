

## Plan: Welcome Popup with Terms & Conditions on First Login

### What It Does
When a dealer logs in for the first time after being approved, they see a welcome dialog with their dealership name, terms and conditions, and a privacy policy. They must accept before accessing the dashboard. This only shows once per dealer.

### Database Change
- Add `terms_accepted_at` column (nullable timestamp) to the `dealers` table. If `NULL`, the dealer hasn't accepted yet and the popup shows.

### New Component: `WelcomeDialog.tsx`
- A modal dialog that displays:
  - "Welcome, [Dealership Name]!" heading
  - Scrollable Terms & Conditions section (platform usage rules, lead purchasing terms, refund policy, data handling)
  - Scrollable Privacy Policy section
  - Checkbox: "I have read and agree to the Terms and Conditions and Privacy Policy"
  - "Accept & Continue" button (disabled until checkbox is checked)
- On accept: updates `dealers.terms_accepted_at = now()` and closes the dialog

### Integration in `AppLayout.tsx`
- After fetching dealer info, check if `terms_accepted_at` is `NULL`
- If null, render `<WelcomeDialog>` over the layout
- Once accepted, dismiss and continue normally

### Files Changed
1. **Migration SQL** — add `terms_accepted_at` column to `dealers`
2. **`src/components/WelcomeDialog.tsx`** — new component with the welcome popup, T&C, and policy text
3. **`src/components/AppLayout.tsx`** — fetch `terms_accepted_at`, conditionally render `WelcomeDialog`

