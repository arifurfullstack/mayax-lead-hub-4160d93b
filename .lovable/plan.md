
# MayaX Lead Hub — Implementation Plan

## Overview
A dealer-only automotive lead marketplace where verified car dealerships browse, filter, and purchase AI-verified buyer leads. Premium dark theme with glassmorphism design.

## Phase 1: Foundation Setup

### Design System & Theme
- Set up dark theme with CSS variables: background #0F1729, surfaces #1B2A4A, glassmorphism panels with backdrop-blur
- Configure accent colors: primary blue #3B82F6, purple #8B5CF6, cyan #06B6D4, gold #C8A84E
- Add Inter font (body) and JetBrains Mono (timers)
- Create reusable glassmorphism card component with neon border glow variants

### Database Tables (Supabase)
- Create all 7 tables: dealers, leads, subscriptions, wallet_transactions, purchases, delivery_logs, autopay_settings
- Set up user_roles table for admin/dealer role management
- Configure RLS policies — critically, lead PII columns hidden until purchased
- Seed 30-50 sample leads with varied data

### Auth & Route Guards
- Supabase Auth with email/password
- ProtectedRoute component checking dealer approval_status
- Role-based routing: admin → /admin/*, approved dealer → /dashboard, pending/rejected/suspended → gate pages

## Phase 2: Auth Pages (Tasks 1-3)

### Login Page (/login)
- Split layout: left brand section with MayaX logo, tagline, trust badges on dark starfield background; right glassmorphism login card with neon border glow
- Email/password inputs with icons, "Forgot password?" link, gradient login button, "Create Dealer Account" secondary button
- Mobile: stacked vertically

### Registration Page (/register)
- 3-step form with progress indicator: Business Info → Dealer Details → Delivery Preferences
- Creates auth user + dealers row with status 'pending'
- Confirmation screen on completion

### Status Gate Pages
- /pending, /rejected, /suspended — each with appropriate icon, message, and glassmorphism card styling

## Phase 3: App Shell (Task 4)

### Top Navbar
- MayaX logo, center nav links (Dashboard, Marketplace, Orders, Wallet Balance), right side tier badge + dealer dropdown

### Left Sidebar
- Collapsible with menu items, wallet balance display at bottom, mobile hamburger overlay

## Phase 4: Core Features (Tasks 5-8)

### Subscription Plans (/subscription)
- 4 tier cards (Basic/Pro/Elite/VIP) with tier-specific neon glow borders and pricing
- VIP card with "Most Popular" badge and gold shimmer animation

### Wallet (/wallet)
- Balance display card, transaction history table with pagination and filters
- Add Funds modal with preset amounts ($100/$250/$500/$1000)

### Leads Marketplace (/marketplace)
- Search bar, tab buttons (All/New/Saved), sort dropdown
- Stats bar with real-time counts
- Lead table with masked PII, quality grade left-border colors, Buy Lead buttons
- Pagination controls

## Phase 5: Marketplace Logic (Tasks 9-13)

### Filter Sidebar
- Credit range, income range, quality grade, buyer type, documents, location, vehicle, lead age, price range filters
- URL query parameter persistence, mobile drawer

### Tier-Based Access & Countdowns
- Calculate unlock times per dealer tier (VIP=instant, Elite=6h, Pro=12h, Basic=24h)
- Live countdown timers in cyan monospace font
- "Upgrade to Unlock" buttons on locked leads

### Purchase Flow
- Atomic transaction via Edge Function with row locking
- Confirmation modal, success/failure handling
- Real-time marketplace updates via Supabase Realtime — sold leads fade out for all dealers

### Batch Purchase
- Checkbox selection, sticky bottom bar with total, sequential atomic purchases

## Phase 6: Supporting Pages (Tasks 14-17)

### Orders (/orders)
- Purchase history table with expandable rows showing full lead details (PII revealed post-purchase)

### Dashboard (/dashboard)
- Summary cards (wallet, tier, leads purchased), recent purchases, delivery health, quick actions

### Settings (/settings)
- Tabbed layout: Profile, Notifications, Webhook (with test button), Security (change password)

### AutoPay Settings
- Filter criteria form, leads per day, schedule, active days configuration

## Phase 7: Admin Panel (Tasks 18-19)

### Admin routes (/admin/*)
- Separate sidebar, dashboard with metrics
- Dealer management: approve/reject/suspend with reason modals
- Lead management: CRUD + bulk CSV import
- Transaction logs, delivery logs with retry capability
- Wallet management: issue credits, process refunds

## Phase 8: Delivery & Polish (Task 20)

### Lead Delivery Engine
- Edge Function: email via Resend + webhook delivery with retries
- Email templates: Welcome, Purchase Confirmation, Lead Delivery, Wallet Top-Up, Subscription, Low Balance Warning

### Final Polish
- Notification bell with unread count
- "Lead Heat" social proof indicators
- Loading skeletons, empty states, error states with retry
- Full mobile responsiveness
- Copy MayaX logo image into project assets
