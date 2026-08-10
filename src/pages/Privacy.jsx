import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <main style={styles.page}>
      <Link to="/" style={styles.backLink}>← Back to home</Link>

      <article style={styles.card}>
        <p style={styles.eyebrow}>Legal</p>
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.updated}>Last updated: August 3, 2026</p>

        <Section title="1. Introduction">
          Marketplace respects your privacy. This Privacy Policy explains the
          personal information we collect, why we collect it, how we use it,
          and the choices available to you.
        </Section>

        <Section title="2. Information we collect">
          We may collect your name, email address, phone number, country,
          account role, property-listing information, identity or professional
          verification information, messages, payment-related records, and
          technical information such as device and usage data.
        </Section>

        <Section title="3. How we use your information">
          We use your information to create and manage your account, connect
          users involved in property transactions, verify professional
          credentials, process transactions, prevent fraud, improve the
          platform, communicate with you, and comply with legal obligations.
        </Section>

        <Section title="4. Sharing information">
          We only share personal information where necessary to provide the
          platform, complete a transaction, comply with the law, protect users,
          or work with trusted service providers such as hosting, payment, and
          verification providers.
        </Section>

        <Section title="5. Data security">
          We use reasonable technical and organisational safeguards to protect
          personal data. However, no internet-based service can guarantee
          absolute security.
        </Section>

        <Section title="6. Your rights">
          You may request access to, correction of, deletion of, or information
          about the use of your personal data, subject to applicable law and
          legitimate platform or legal requirements.
        </Section>

        <Section title="7. Data retention">
          We retain personal data only for as long as necessary for the
          purposes described in this policy, to resolve disputes, enforce
          agreements, and meet legal or regulatory obligations.
        </Section>

        <Section title="8. Changes to this policy">
          We may update this policy from time to time. When we make material
          changes, we will update the date above and, where appropriate, notify
          you through the platform or by email.
        </Section>

        <Section title="9. Contact us">
          For privacy questions or requests, contact us at:
          <br />
          <strong>Email:</strong> privacy@yourmarketplace.com
          <br />
          <strong>Business:</strong> Your Marketplace Name
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginTop: '28px' }}>
      <h2 style={{ color: '#5a1020', fontSize: '1.15rem' }}>{title}</h2>
      <p style={{ lineHeight: 1.75, color: '#4d4043' }}>{children}</p>
    </section>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px',
    background: '#faf8f8',
  },
  backLink: {
    display: 'block',
    maxWidth: '850px',
    margin: '0 auto 28px',
    color: '#661328',
    fontWeight: 700,
    textDecoration: 'none',
  },
  card: {
    maxWidth: '850px',
    margin: '0 auto',
    padding: 'clamp(24px, 5vw, 56px)',
    borderRadius: '18px',
    background: '#ffffff',
    boxShadow: '0 10px 30px rgba(71, 12, 28, 0.08)',
  },
  eyebrow: {
    margin: 0,
    color: '#7b1d35',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '10px 0 6px',
    color: '#4b0d1a',
  },
  updated: {
    margin: 0,
    color: '#806c72',
    fontSize: '0.9rem',
  },
};