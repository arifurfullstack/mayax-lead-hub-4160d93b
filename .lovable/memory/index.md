# Project Memory

## Core
MayaX Lead Hub — dealer automotive lead marketplace. Light theme: white bg, lime-green primary (#84CC16).
Inter body, JetBrains Mono timers. Clean cards with white surfaces and subtle borders.
Lovable Cloud (Supabase) for auth/db/realtime. Lead PII (name/phone/email) hidden until purchased; location/income/credit/vehicle visible.
Tier access delays: VIP=0h, Elite=6h, Pro=12h, Basic=24h.

## Memories
- [Design tokens](mem://design/tokens) — Full color palette, glassmorphism utilities, grade border colors, tier glow colors
- [Database schema](mem://features/schema) — 8 tables: dealers, leads (with vehicle_make, vehicle_model), subscriptions, wallet_transactions, purchases, delivery_logs, autopay_settings, user_roles
- [Auth flow](mem://features/auth) — Email/password, dealer approval_status gates, ProtectedRoute component, admin role check
