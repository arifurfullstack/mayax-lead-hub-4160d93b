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

interface LeadSummary {
  reference_code?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  city?: string
  province?: string
  vehicle_preference?: string
  price_paid?: number | string
}

interface LeadsPurchasedBulkProps {
  dealership_name?: string
  total_paid?: number | string
  lead_count?: number
  logo_url?: string
  leads?: LeadSummary[]
}

const LeadsPurchasedBulkEmail = ({
  dealership_name = 'Dealer',
  total_paid = '0.00',
  lead_count = 0,
  logo_url,
  leads = [],
}: LeadsPurchasedBulkProps) => {
  const count = lead_count || leads.length

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{count} new leads delivered to {dealership_name}</Preview>
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
            <Heading style={h1}>{count} New Leads Delivered 🎉</Heading>
            <Text style={text}>
              Hi <strong>{dealership_name}</strong>, you've successfully purchased{' '}
              <strong>{count}</strong> new {count === 1 ? 'lead' : 'leads'}.
            </Text>

            <Section style={summary}>
              <Row>
                <Column style={summaryLabel}>Leads Purchased</Column>
                <Column style={summaryValue}>{count}</Column>
              </Row>
              <Row>
                <Column style={summaryLabel}>Total Paid</Column>
                <Column style={summaryValue}>${Number(total_paid).toFixed(2)}</Column>
              </Row>
            </Section>

            <Heading as="h2" style={h2}>Your New Leads</Heading>
            {leads.map((lead, idx) => (
              <Section key={lead.reference_code ?? idx} style={leadCard}>
                <Row>
                  <Column style={leadHeaderLeft}>
                    <Text style={refCode}>{lead.reference_code ?? '—'}</Text>
                    <Text style={leadName}>
                      {lead.first_name ?? ''} {lead.last_name ?? ''}
                    </Text>
                  </Column>
                  <Column style={leadHeaderRight}>
                    <Text style={leadPrice}>${Number(lead.price_paid ?? 0).toFixed(2)}</Text>
                  </Column>
                </Row>
                <Section style={leadBody}>
                  {lead.email && (
                    <Row style={leadRow}>
                      <Column style={leadFieldLabel}>Email</Column>
                      <Column style={leadFieldValue}>{lead.email}</Column>
                    </Row>
                  )}
                  {lead.phone && (
                    <Row style={leadRow}>
                      <Column style={leadFieldLabel}>Phone</Column>
                      <Column style={leadFieldValue}>{lead.phone}</Column>
                    </Row>
                  )}
                  {(lead.city || lead.province) && (
                    <Row style={leadRow}>
                      <Column style={leadFieldLabel}>Location</Column>
                      <Column style={leadFieldValue}>
                        {[lead.city, lead.province].filter(Boolean).join(', ')}
                      </Column>
                    </Row>
                  )}
                  {lead.vehicle_preference && (
                    <Row style={leadRow}>
                      <Column style={leadFieldLabel}>Vehicle</Column>
                      <Column style={leadFieldValue}>{lead.vehicle_preference}</Column>
                    </Row>
                  )}
                </Section>
              </Section>
            ))}

            <Hr style={hr} />
            <Text style={footer}>
              Contact these leads promptly for the best conversion rate. Good luck!
            </Text>
            <Text style={footerSmall}>— The MayaX Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: LeadsPurchasedBulkEmail,
  subject: (d: Record<string, any>) => {
    const count = d?.lead_count ?? d?.leads?.length ?? 0
    return `${count} New ${count === 1 ? 'Lead' : 'Leads'} Delivered — $${Number(d?.total_paid ?? 0).toFixed(2)}`
  },
  displayName: 'Leads purchased (bulk)',
  previewData: {
    dealership_name: 'Acme Motors',
    total_paid: 149.97,
    lead_count: 3,
    leads: [
      {
        reference_code: 'REF-AB12CD',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '+1-555-123-4567',
        city: 'Toronto',
        province: 'ON',
        vehicle_preference: 'SUV',
        price_paid: 49.99,
      },
      {
        reference_code: 'REF-EF34GH',
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        phone: '+1-555-234-5678',
        city: 'Vancouver',
        province: 'BC',
        vehicle_preference: 'Sedan',
        price_paid: 49.99,
      },
      {
        reference_code: 'REF-IJ56KL',
        first_name: 'Sarah',
        last_name: 'Lee',
        email: 'sarah@example.com',
        phone: '+1-555-345-6789',
        city: 'Calgary',
        province: 'AB',
        vehicle_preference: 'Truck',
        price_paid: 49.99,
      },
    ],
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
const summaryLabel = { fontSize: '12px', color: '#64748B', fontWeight: 600, padding: '4px 0', width: '60%' }
const summaryValue = { fontSize: '13px', color: '#0F1729', fontWeight: 700, padding: '4px 0', textAlign: 'right' as const }
const leadCard = {
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  margin: '0 0 12px',
  overflow: 'hidden',
}
const leadHeaderLeft = {
  background: '#F8FAFC',
  padding: '10px 14px',
  borderBottom: '1px solid #E2E8F0',
  width: '70%',
}
const leadHeaderRight = {
  background: '#F8FAFC',
  padding: '10px 14px',
  borderBottom: '1px solid #E2E8F0',
  textAlign: 'right' as const,
}
const refCode = { fontSize: '11px', color: '#3B82F6', fontWeight: 700, margin: 0, letterSpacing: '0.3px' }
const leadName = { fontSize: '14px', color: '#0F1729', fontWeight: 600, margin: '2px 0 0' }
const leadPrice = { fontSize: '14px', color: '#0F1729', fontWeight: 700, margin: 0 }
const leadBody = { padding: '6px 0' }
const leadRow = {}
const leadFieldLabel = {
  fontSize: '12px',
  color: '#64748B',
  fontWeight: 600,
  padding: '6px 14px',
  width: '30%',
  verticalAlign: 'top' as const,
}
const leadFieldValue = {
  fontSize: '13px',
  color: '#0F1729',
  padding: '6px 14px',
  verticalAlign: 'top' as const,
}
const hr = { borderColor: '#E2E8F0', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#475569', margin: '0 0 8px' }
const footerSmall = { fontSize: '12px', color: '#94A3B8', margin: 0 }
