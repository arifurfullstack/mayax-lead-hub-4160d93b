import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LeadPurchasedProps {
  reference_code?: string
  price_paid?: number | string
  dealership_name?: string
  logo_url?: string
  lead?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    city?: string
    province?: string
    income?: string | number
    credit_range_min?: string | number
    credit_range_max?: string | number
    vehicle_preference?: string
    trade_in?: boolean
    trade_in_vehicle?: string
    bankruptcy?: string
    notes?: string
  }
}

const LeadPurchasedEmail = ({
  reference_code = 'REF-XXXXXX',
  price_paid = '0.00',
  dealership_name = 'Dealer',
  logo_url,
  lead = {},
}: LeadPurchasedProps) => {
  const fields: Array<[string, string]> = [
    ['First Name', lead.first_name ?? ''],
    ['Last Name', lead.last_name ?? ''],
    ['Email', lead.email ?? ''],
    ['Phone', lead.phone ?? ''],
    ['City', lead.city ?? ''],
    ['Province', lead.province ?? ''],
    ['Income', lead.income != null ? String(lead.income) : ''],
    ['Credit Range Min', lead.credit_range_min != null ? String(lead.credit_range_min) : ''],
    ['Credit Range Max', lead.credit_range_max != null ? String(lead.credit_range_max) : ''],
    ['Vehicle Preference', lead.vehicle_preference ?? ''],
    ['Trade In', lead.trade_in ? 'Yes' : 'No'],
    ['Trade-In Vehicle', lead.trade_in_vehicle ?? ''],
    ['Bankruptcy', lead.bankruptcy ?? ''],
    ['Notes', lead.notes ?? ''],
  ]

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New lead {reference_code} delivered to {dealership_name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {logo_url ? (
              <Img src={logo_url} alt="MayaX" width="140" style={logo} />
            ) : (
              <Heading style={brand}>MayaX</Heading>
            )}
          </Section>

          <Section style={content}>
            <Heading style={h1}>New Lead Delivered 🎉</Heading>
            <Text style={text}>
              Hi <strong>{dealership_name}</strong>, you've successfully purchased a new lead.
            </Text>

            <Section style={summary}>
              <Row>
                <Column style={summaryLabel}>Reference</Column>
                <Column style={summaryValue}>{reference_code}</Column>
              </Row>
              <Row>
                <Column style={summaryLabel}>Price Paid</Column>
                <Column style={summaryValue}>${Number(price_paid).toFixed(2)}</Column>
              </Row>
            </Section>

            <Heading as="h2" style={h2}>Lead Information</Heading>
            <Section style={table}>
              {fields.map(([label, value]) => (
                <Row key={label} style={tr}>
                  <Column style={td1}>{label}</Column>
                  <Column style={td2}>{value || '—'}</Column>
                </Row>
              ))}
            </Section>

            <Hr style={hr} />
            <Text style={footer}>
              Contact this lead promptly for the best conversion rate. Good luck!
            </Text>
            <Text style={footerSmall}>— The MayaX Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: LeadPurchasedEmail,
  subject: (d: Record<string, any>) =>
    `New Lead ${d?.reference_code ?? ''} — ${d?.lead?.first_name ?? ''} ${d?.lead?.last_name ?? ''}`.trim(),
  displayName: 'Lead purchased',
  previewData: {
    reference_code: 'REF-AB12CD',
    price_paid: 49.99,
    dealership_name: 'Acme Motors',
    lead: {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '+1-555-123-4567',
      city: 'Toronto',
      province: 'ON',
      income: '75000',
      credit_range_min: '650',
      credit_range_max: '720',
      vehicle_preference: 'SUV',
      trade_in: true,
      trade_in_vehicle: '2018 Honda Civic',
      bankruptcy: '',
      notes: 'Looking to purchase within 2 weeks.',
    },
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const header = {
  background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
  padding: '28px 32px',
  textAlign: 'center' as const,
}
const logo = { display: 'block', margin: '0 auto' }
const brand = { color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }
const content = { padding: '32px 32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0F1729', margin: '0 0 12px' }
const h2 = { fontSize: '16px', fontWeight: 600, color: '#0F1729', margin: '24px 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const summary = {
  background: '#F1F5F9',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '8px 0 8px',
}
const summaryLabel = { fontSize: '12px', color: '#64748B', fontWeight: 600, padding: '4px 0', width: '40%' }
const summaryValue = { fontSize: '13px', color: '#0F1729', fontWeight: 600, padding: '4px 0', textAlign: 'right' as const }
const table = { border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', margin: '0 0 16px' }
const tr = { borderBottom: '1px solid #E2E8F0' }
const td1 = {
  fontSize: '12px',
  color: '#64748B',
  fontWeight: 600,
  padding: '10px 14px',
  width: '40%',
  background: '#F8FAFC',
  verticalAlign: 'top' as const,
}
const td2 = { fontSize: '13px', color: '#0F1729', padding: '10px 14px', verticalAlign: 'top' as const }
const hr = { borderColor: '#E2E8F0', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#475569', margin: '0 0 8px' }
const footerSmall = { fontSize: '12px', color: '#94A3B8', margin: 0 }
