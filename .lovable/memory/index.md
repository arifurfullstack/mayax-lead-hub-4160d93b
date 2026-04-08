# Project Memory

## Core
MayaX Lead Hub — dealer automotive lead marketplace. Dark theme #0F1729 bg, #1B2A4A surfaces, glassmorphism panels.
Primary blue #3B82F6, purple #8B5CF6, cyan #06B6D4, gold #C8A84E. Inter body, JetBrains Mono timers.
Lovable Cloud (Supabase) for auth/db/realtime. Lead PII hidden until purchased (server-side enforced).
Tier access delays: VIP=0h, Elite=6h, Pro=12h, Basic=24h.

## Memories
- [Design tokens](mem://design/tokens) — Full color palette, glassmorphism utilities, grade border colors, tier glow colors
- [Database schema](mem://features/schema) — 8 tables: dealers, leads, subscriptions, wallet_transactions, purchases, delivery_logs, autopay_settings, user_roles
- [Auth flow](mem://features/auth) — Email/password, dealer approval_status gates, ProtectedRoute component, admin role check
- [Promo codes](mem://features/promo-codes) — Admin-managed promo codes with flat pricing for dealers, applied in marketplace and purchase edge function
