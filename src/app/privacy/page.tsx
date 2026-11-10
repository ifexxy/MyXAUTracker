import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, P, UL, B } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy for Xautracker',
  description: 'How XauTracker collects, uses and protects your personal data.',
  alternates: { canonical: 'https://www.xautracker.com/privacy' },
  robots: 'index, follow',
};

const SUPPORT_EMAIL = 'support@xautracker.com'; // 

const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: 13 };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="What we collect, why we collect it, and the choices you have." updated="November 10, 2026">
      <P>XauTracker (&quot;we&quot;, &quot;us&quot;) provides gold, Bitcoin and USD/CHF price forecasts and a community area called Minds at xautracker.com. This policy explains what personal data we collect, why, and the choices you have.</P>

      <Section n={1} title="Data we collect">
        <P><B>Account data.</B></P>
        <UL>
          <li>Your email address and password. Your password is handled by Google Firebase Authentication; we never see or store it in readable form.</li>
          <li>If you created your account before we switched to email verification, we may also hold the phone number you used then.</li>
        </UL>
        <P><B>Verification data.</B></P>
        <UL>
          <li>When you sign up we email you a 6-digit code. We store only a hashed (scrambled) version of it, and it expires after 10 minutes.</li>
          <li>Our signup form uses Google reCAPTCHA to block bots. reCAPTCHA collects hardware and software information and sends it to Google, under <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontWeight: 700 }}>Google&apos;s Privacy Policy</a>.</li>
        </UL>
        <P><B>Subscription and payment data.</B></P>
        <UL>
          <li>Your plan status (trial, active, expired), trial and subscription dates, and the date and amount of your last payment.</li>
          <li>Card and online payments are processed by Flutterwave. We never see or store your card details; Flutterwave handles them under its own privacy policy. If you pay by manual bank transfer, we see the transfer details needed to confirm your payment.</li>
        </UL>
        <P><B>Usage and security data.</B></P>
        <UL>
          <li>The IP address you used when you signed up, your most recent IP addresses, and the time you were last active.</li>
          <li>We use this to run the service, detect duplicate or abusive accounts, and keep the platform secure.</li>
        </UL>
        <P><B>Content you post.</B> Anything you post in the Minds community is stored with your account.</P>
      </Section>

      <Section n={2} title="How we use your data">
        <UL>
          <li>To create and run your account and give you access to forecasts.</li>
          <li>To manage your free trial and subscription, and process payments.</li>
          <li>To send verification codes and essential account emails, such as password resets.</li>
          <li>To prevent fraud, abuse and multiple free-trial accounts, and to suspend accounts that break our rules.</li>
          <li>To keep the service reliable and fix problems.</li>
        </UL>
        <P>We do not sell your personal data, and we do not use it for third-party advertising.</P>
      </Section>

      <Section n={3} title="Account suspension">
        <P>If we believe an account is abusing the service, for example by creating multiple accounts to repeat the free trial, we may suspend it. A suspended account cannot sign in. We may record the date of the suspension and an internal reason.</P>
      </Section>

      <Section n={4} title="Who we share data with">
        <P>We share data only with the service providers that run XauTracker:</P>
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...td, textAlign: 'left', color: 'var(--ink)' }}>Provider</th>
                <th style={{ ...td, textAlign: 'left', color: 'var(--ink)' }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={td}>Google Firebase</td><td style={td}>Authentication and database storage</td></tr>
              <tr><td style={td}>Vercel</td><td style={td}>Website hosting and servers</td></tr>
              <tr><td style={td}>Resend</td><td style={td}>Sending verification and account emails</td></tr>
              <tr><td style={td}>Google reCAPTCHA</td><td style={td}>Bot protection at signup</td></tr>
              <tr><td style={td}>Flutterwave</td><td style={td}>Payment processing</td></tr>
            </tbody>
          </table>
        </div>
        <P>We may also disclose information if the law requires it, or to protect our rights and our users.</P>
      </Section>

      <Section n={5} title="How long we keep it">
        <P>We keep your account data while your account is active. If you ask us to delete your account, we remove your personal data within a reasonable time, except where we must keep certain records (such as payment records) for legal or accounting reasons, or to enforce a suspension. Verification codes are deleted once used or expired.</P>
      </Section>

      <Section n={6} title="Security">
        <P>Data is transmitted over HTTPS and stored with reputable providers. No system is perfectly secure, so we cannot guarantee absolute security, but we take reasonable steps to protect your data.</P>
      </Section>

      <Section n={7} title="Your rights">
        <P>Under the Nigeria Data Protection Act 2023 and similar laws, you may have the right to access, correct or delete your personal data, to object to or restrict certain processing, and to complain to the Nigeria Data Protection Commission. To make a request, email us at <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--gold)', fontWeight: 700 }}>{SUPPORT_EMAIL}</a>.</P>
      </Section>

      <Section n={8} title="Cookies and local storage">
        <P>We use browser storage and cookies only as needed to keep you signed in and remember your preferences, such as light or dark theme. Firebase and reCAPTCHA may set their own cookies or identifiers.</P>
      </Section>

      <Section n={9} title="Children">
        <P>XAU Tracker is not intended for anyone under 18, and we do not knowingly collect data from children.</P>
      </Section>

      <Section n={10} title="International transfers">
        <P>Our providers may process data outside Nigeria, including in the United States and the European Union. We rely on those providers&apos; safeguards for such transfers.</P>
      </Section>

      <Section n={11} title="Changes to this policy">
        <P>We may update this policy. When we do, we will change the &quot;Last updated&quot; date, and for significant changes we will notify you by email or on the site.</P>
      </Section>

      <Section n={12} title="Contact">
        <P>XauTracker, Port Harcourt, Nigeria<br />Email: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--gold)', fontWeight: 700 }}>{SUPPORT_EMAIL}</a></P>
        <P>See also our <Link href="/terms" style={{ color: 'var(--gold)', fontWeight: 700 }}>Terms of Service</Link> and <Link href="/disclaimer" style={{ color: 'var(--gold)', fontWeight: 700 }}>Disclaimer</Link>.</P>
      </Section>
    </LegalPage>
  );
}
