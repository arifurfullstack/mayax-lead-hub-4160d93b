/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { render } from 'npm:@react-email/render@0.0.17'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com'
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465')
const SMTP_USER = Deno.env.get('SMTP_USER') ?? ''
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') ?? ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') ?? SMTP_USER
const ADMIN_NOTIFY_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') ?? ''

// Templates that also notify the admin via BCC
const ADMIN_NOTIFY_TEMPLATES = new Set<string>([
  'lead-purchased',
  'leads-purchased-bulk',
  'wallet-topup',
  'wallet-topup-failed',
])

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface SendBody {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, unknown>
  idempotencyKey?: string
  cc?: string | string[]
  bcc?: string | string[]
  subjectOverride?: string
}

function asArray(v?: string | string[]): string[] {
  if (!v) return []
  return Array.isArray(v) ? v.filter(Boolean) : [v]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as SendBody
    if (!body?.templateName || !body?.recipientEmail) {
      return new Response(JSON.stringify({ error: 'templateName and recipientEmail are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const entry = TEMPLATES[body.templateName]
    if (!entry) {
      return new Response(JSON.stringify({ error: `Unknown template: ${body.templateName}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Idempotency: skip if already sent
    if (body.idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from('smtp_email_log')
        .select('id, status')
        .eq('idempotency_key', body.idempotencyKey)
        .eq('status', 'sent')
        .maybeSingle()
      if (existing) {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const data = body.templateData ?? {}
    const subject = body.subjectOverride
      ?? (typeof entry.subject === 'function' ? entry.subject(data) : entry.subject)

    const element = React.createElement(entry.component as React.ComponentType<any>, data)
    const html = await render(element)
    const text = await render(element, { plainText: true })

    const cc = asArray(body.cc)
    const bcc = asArray(body.bcc)
    if (ADMIN_NOTIFY_EMAIL && ADMIN_NOTIFY_TEMPLATES.has(body.templateName)) {
      if (!bcc.includes(ADMIN_NOTIFY_EMAIL)) bcc.push(ADMIN_NOTIFY_EMAIL)
    }

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASSWORD },
      },
    })

    let sendErr: string | null = null
    try {
      await client.send({
        from: SMTP_FROM,
        to: body.recipientEmail,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        content: text || ' ',
        html,
      })
    } catch (e) {
      sendErr = e instanceof Error ? e.message : String(e)
    } finally {
      try { await client.close() } catch { /* noop */ }
    }

    await supabaseAdmin.from('smtp_email_log').insert({
      template_name: body.templateName,
      recipient_email: body.recipientEmail,
      cc: cc.join(',') || null,
      bcc: bcc.join(',') || null,
      subject,
      idempotency_key: body.idempotencyKey ?? null,
      status: sendErr ? 'failed' : 'sent',
      error: sendErr,
    })

    if (sendErr) {
      console.error('send-smtp-email failed', sendErr)
      return new Response(JSON.stringify({ ok: false, error: sendErr }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('send-smtp-email error', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})