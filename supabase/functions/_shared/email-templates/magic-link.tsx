/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>MayaX</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Your login link ✨</Heading>
          <Text style={text}>
            Click the button below to log in to <strong>{siteName}</strong>. This link expires shortly for your security.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>Log In</Button>
          </Section>
          <Text style={footer}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
          <Text style={footerSmall}>— The MayaX Team</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const header = { background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)', padding: '28px 32px', textAlign: 'center' as const }
const brand = { color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }
const content = { padding: '32px 32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0F1729', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const buttonWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = { background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#475569', margin: '24px 0 8px' }
const footerSmall = { fontSize: '12px', color: '#94A3B8', margin: 0 }
