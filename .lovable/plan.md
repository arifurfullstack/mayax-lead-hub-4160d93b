

## Plan: Implement Screenshot Requirements

Based on the annotated screenshot, there are 3 requirements:

### 1. Make Wallet Balance Clickable (Sidebar)
The wallet balance in the sidebar footer should navigate to `/wallet` when clicked.

**File:** `src/components/AppSidebar.tsx`
- Wrap the wallet balance `glass-card` div with a `Link` (from react-router-dom) pointing to `/wallet`
- Add cursor-pointer and hover styling

### 2. Make Notification Bell Dynamic and Functional (Top Navbar)
The notification bell icon needs to be dynamic — show unread count and a dropdown with notifications.

**File:** `src/components/TopNavbar.tsx`
- Add a dropdown menu (using existing `DropdownMenu` component) to the bell icon
- For now, show a placeholder "No new notifications" state since there's no notifications table yet
- Add a red badge dot when there are unread notifications (future-ready)

### 3. Profile Icon with Menu (Top Navbar)
Replace the plain dealer name text with a clickable avatar/icon that opens a dropdown menu with options like Settings, Logout, etc.

**File:** `src/components/TopNavbar.tsx`
- Replace the dealer name `<span>` with an avatar circle showing initials
- Wrap it in a `DropdownMenu` with items: Settings, Logout
- Pass `onLogout` callback through from `AppLayout`

**File:** `src/components/AppLayout.tsx`
- Pass `onLogout` handler to `TopNavbar`

### 4. Make Top Navbar Wallet Clickable
The wallet balance display in the top navbar should also navigate to `/wallet` when clicked.

**File:** `src/components/TopNavbar.tsx`
- Wrap wallet display with a `Link` to `/wallet`

### Summary of file changes:
- `src/components/AppSidebar.tsx` — clickable wallet balance
- `src/components/TopNavbar.tsx` — clickable wallet, notification dropdown, profile avatar with menu
- `src/components/AppLayout.tsx` — pass onLogout to TopNavbar

