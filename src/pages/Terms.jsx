import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <main style={styles.page}>
      <Link to="/" style={styles.backLink}>← Back to home</Link>

      <div style={styles.header}>
        <p style={styles.eyebrow}>Legal</p>
        <h1 style={styles.title}>Terms and Conditions</h1>
        <p style={styles.text}>
          Read our complete Terms and Conditions document below.
        </p>

        <a
          href="/documents/terms-and-conditions.pdf"
          target="_blank"
          rel="noreferrer"
          style={styles.downloadButton}
        >
          Open or download the Terms PDF
        </a>
      </div>

      <iframe
        title="Terms and Conditions"
        src="/documents/terms-and-conditions.pdf"
        style={styles.document}
      />
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px',
    background: '#faf8f8',
    color: '#2a1016',
  },
  backLink: {
    display: 'block',
    maxWidth: '1000px',
    margin: '0 auto 28px',
    color: '#661328',
    fontWeight: 700,
    textDecoration: 'none',
  },
  header: {
    maxWidth: '1000px',
    margin: '0 auto 24px',
    padding: '32px',
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
    margin: '10px 0',
    color: '#4b0d1a',
  },
  text: {
    margin: '0 0 22px',
    lineHeight: 1.6,
  },
  downloadButton: {
    display: 'inline-block',
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#5a1020',
    color: '#ffffff',
    fontWeight: 700,
    textDecoration: 'none',
  },
  document: {
    display: 'block',
    width: '100%',
    maxWidth: '1000px',
    height: '75vh',
    margin: '0 auto',
    border: '1px solid #e4d5d9',
    borderRadius: '12px',
    background: '#ffffff',
  },
};