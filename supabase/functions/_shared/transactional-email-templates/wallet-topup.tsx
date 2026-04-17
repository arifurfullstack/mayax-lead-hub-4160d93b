import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface WalletTopupProps {
  dealership_name?: string
  amount?: number | string
  new_balance?: number | string
  gateway?: string
  reference?: string
  date?: string
}

const gatewayLabel = (g?: string) => {
  if (!g) return 'Payment'
  if (g === 'stripe') return 'Credit/Debit Card'
  if (g === 'paypal') return 'PayPal'
  if (g === 'bank_transfer') return 'Bank Transfer'
  return g.replace(/_/g, ' ')
}

const WalletTopupEmail = ({
  dealership_name = 'Dealer',
  amount = '0.00',
  new_balance = '0.00',
  gateway = '',
  reference = '',
  date = new Date().toLocaleString(),
}: WalletTopupProps) => {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your wallet has been topped up with ${Number(amount).toFixed(2)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>MayaX</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Wallet Top-Up Confirmed ✅</Heading>
            <Text style={text}>
              Hi <strong>{dealership_name}</strong>, we've successfully credited your MayaX wallet.
            </Text>

            <Section style={amountBox}>
              <Text style={amountLabel}>Amount Added</Text>
              <Text style={amountValue}>${Number(amount).toFixed(2)}</Text>
            </Section>

            <Section style={summary}>
              <Row style={tr}>
                <Column style={td1}>New Balance</Column>
                <Column style={td2}>${Number(new_balance).toFixed(2)}</Column>
              </Row>
              <Row style={tr}>
                <Column style={td1}>Payment Method</Column>
                <Column style={td2}>{gatewayLabel(gateway)}</Column>
              </Row>
              {reference && (
                <Row style={tr}>
                  <Column style={td1}>Reference</Column>
                  <Column style={td2}>{reference}</Column>
                </Row>
              )}
              <Row style={trLast}>
                <Column style={td1}>Date</Column>
                <Column style={td2}>{date}</Column>
              </Row>
            </Section>

            <Hr style={hr} />
            <Text style={footer}>
              Your funds are now available to purchase leads in the marketplace.
            </Text>
            <Text style={footerSmall}>— The MayaX Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WalletTopupEmail,
  subject: (d: Record<string, any>) =>
    `Wallet topped up — $${Number(d?.amount ?? 0).toFixed(2)} added`,
  displayName: 'Wallet top-up',
  previewData: {
    dealership_name: 'Acme Motors',
    amount: 250,
    new_balance: 532.50,
    gateway: 'stripe',
    reference: 'ch_3Pq...',
    date: new Date().toLocaleString(),
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
const brand = { color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }
const content = { padding: '32px 32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0F1729', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const amountBox = {
  background: 'linear-gradient(135deg, #EFF6FF 0%, #ECFEFF 100%)',
  border: '1px solid #BAE6FD',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '16px 0 20px',
}
const amountLabel = { fontSize: '12px', color: '#64748B', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const amountValue = { fontSize: '32px', color: '#0F1729', fontWeight: 700, margin: 0 }
const summary = { border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', margin: '0 0 8px' }
const tr = { borderBottom: '1px solid #E2E8F0' }
const trLast = {}
const td1 = {
  fontSize: '12px',
  color: '#64748B',
  fontWeight: 600,
  padding: '10px 14px',
  width: '40%',
  background: '#F8FAFC',
  verticalAlign: 'top' as const,
}
const td2 = { fontSize: '13px', color: '#0F1729', padding: '10px 14px', verticalAlign: 'top' as const, fontWeight: 500 }
const hr = { borderColor: '#E2E8F0', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#475569', margin: '0 0 8px' }
const footerSmall = { fontSize: '12px', color: '#94A3B8', margin: 0 }
