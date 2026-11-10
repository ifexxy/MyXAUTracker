import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, P, UL, B } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply when you use XauTracker, including subscriptions, accounts and acceptable use.',
  alternates: { canonical: 'https://www.xautracker.com/terms' },
  robots: 'index, follow',
};

const SUPPORT_EMAIL = 'support@xautracker.com'; 
const link: React.CSSProperties = { color: 'var(--gold)', fontWeight: 700 };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro="The rules for using XAU Tracker. Please read them before you sign up." updated="November 10, 2026">
      <P>These Terms of Service (&quot;Terms&quot;) govern your use of XAU Tracker at xautracker.com (the &quot;Service&quot;), operated from Port Harcourt, Nigeria. By creating an account or using the Service, you agree to these Terms and to our <Link href="/privacy" style={link}>Privacy Policy</Link>. If you do not agree, do not use the Service.</P>

      <Section n={1} title="What XAU Tracker is">
        <P>XauTracker provides algorithmic gold (XAU/USD), Bitcoin and USD/CHF forecasts, market data and news, and a community area called Minds. It is an information service only.</P>
        <P><B>Not financial advice.</B> Nothing on the Service is investment, financial, legal or tax advice, and no forecast is a recommendation to buy or sell. Trading carries significant risk, and you can lose some or all of your capital. You are solely responsible for your trading decisions. Please read our <Link href="/disclaimer" style={link}>Disclaimer</Link>.</P>
      </Section>

      <Section n={2} title="Eligibility">
        <P>You must be at least 18 years old and able to enter a binding contract to use the Service.</P>
      </Section>

      <Section n={3} title="Your account">
        <UL>
          <li>You must give a valid email address that you control, and verify it with the code we send.</li>
          <li>Keep your password confidential. You are responsible for all activity on your account.</li>
          <li>One person may hold one account. Do not create multiple accounts, including to repeat the free trial.</li>
          <li>Do not share, sell or transfer your account or your access.</li>
        </UL>
      </Section>

      <Section n={4} title="Free trial">
        <P>New accounts receive a 3-day free trial. The trial is limited to one per person. We may end or refuse a trial, or suspend an account, if we believe the trial is being abused.</P>
      </Section>

      <Section n={5} title="Subscription and payment">
        <UL>
          <li>Full access requires a paid monthly plan, currently <B>$10 per month</B>, or <B>₦15,000 per month</B> for Nigerian residents. Prices may change; the price shown at checkout applies to your purchase, and we will give notice of a change before it affects an existing subscriber.</li>
          <li>Card, bank transfer and USSD payments are processed by Flutterwave. You may also pay by manual bank transfer, in which case we activate your access after we confirm your payment.</li>
          <li>Each payment gives you access for one month from the date it is confirmed. Access ends when that period ends unless you pay again or your plan renews.</li>
          <li>You are responsible for any fees charged by your bank or payment provider.</li>
        </UL>
      </Section>

      <Section n={6} title="Cancellation and refunds">
        <P>You can cancel at any time from your Account page. After you cancel, you keep access until the end of the period you have already paid for, and you will not be charged again.</P>
        <P>Because the Service delivers digital content immediately, payments are generally non-refundable, including for unused time. If you believe you were charged in error, or a technical fault prevented you from using the Service, email <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a> and we will review it fairly. Nothing here limits any rights you have under applicable consumer law.</P>
      </Section>

      <Section n={7} title="Acceptable use">
        <P>You agree not to:</P>
        <UL>
          <li>copy, scrape, resell, redistribute or republish our forecasts, data or content without our written permission;</li>
          <li>use bots, scripts or automated tools to access the Service or to create accounts;</li>
          <li>attempt to bypass payment, access limits, trial limits or security measures;</li>
          <li>interfere with or overload the Service, or probe it for vulnerabilities;</li>
          <li>use the Service for anything unlawful, or to harass, defraud or mislead others.</li>
        </UL>
      </Section>

      <Section n={8} title="Minds community">
        <P>You are responsible for what you post. Do not post anything unlawful, abusive, hateful, misleading, spammy or that infringes someone else&apos;s rights. Do not promote scams, signal-selling, or unlicensed investment schemes. By posting, you give us a non-exclusive, royalty-free licence to display your content on the Service. We may remove content at our discretion. Opinions shared by users are theirs, not ours, and are not financial advice.</P>
      </Section>

      <Section n={9} title="Suspension and termination">
        <P>We may suspend or terminate your account, with or without notice, if you breach these Terms, abuse the free trial, create multiple accounts, attempt fraud, or put the Service or other users at risk. A suspended user cannot sign in. If you believe a suspension was a mistake, contact <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a>. You may stop using the Service and ask us to delete your account at any time.</P>
        <P>If we terminate a paid account for a serious breach, we are not obliged to refund the unused part of the payment.</P>
      </Section>

      <Section n={10} title="Data sources and availability">
        <P>Market data and news come from third-party providers and may be delayed, inaccurate or interrupted. We do not guarantee that the Service will be uninterrupted, error-free or always available, and we may change, suspend or discontinue features at any time.</P>
      </Section>

      <Section n={11} title="Intellectual property">
        <P>The Service, including its design, forecasts, models, text and code, belongs to XauTracker or its licensors and is protected by law. We grant you a personal, limited, non-transferable, revocable right to use the Service for your own purposes while you comply with these Terms.</P>
      </Section>

      <Section n={12} title="Disclaimer of warranties">
        <P>The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by law, we make no warranties of any kind, express or implied, including accuracy, reliability, fitness for a particular purpose, or that any forecast will prove correct or profitable.</P>
      </Section>

      <Section n={13} title="Limitation of liability">
        <P>To the fullest extent permitted by law, Xautracker and its owner will not be liable for any trading or investment losses, lost profits, or indirect, incidental or consequential damages arising from your use of, or inability to use, the Service. Our total liability for any claim relating to the Service will not exceed the amount you paid us in the three months before the claim arose. Nothing in these Terms excludes liability that cannot be excluded by law.</P>
      </Section>

      <Section n={14} title="Changes to these Terms">
        <P>We may update these Terms from time to time. We will change the &quot;Last updated&quot; date, and for significant changes we will notify you by email or on the site. If you keep using the Service after a change takes effect, you accept the updated Terms.</P>
      </Section>

     

      <Section n={16} title="Contact">
        <P>XauTracker.com, Port Harcourt, Nigeria<br />Email: <a href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</a></P>
      </Section>
    </LegalPage>
  );
}
