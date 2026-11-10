import Footer from '@/components/Footer';

/* Shared layout for text-heavy legal pages (Privacy, Terms). */
export function LegalPage({
  title, intro, updated, children,
}: { title: string; intro: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          {title}<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 360, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>{intro}</p>
        <p style={{ margin: '10px 0 0', color: 'var(--ink-4)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
          Last updated {updated}
        </p>
      </section>

      <div className="mx-[20px] mb-[18px]" style={{ maxWidth: 760, marginInline: 'auto', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 18px' }}>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75 }}>{children}</div>
      </div>

      <Footer />
    </>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: -0.2 }}>
        <span style={{ color: 'var(--gold)', marginRight: 6 }}>{n}.</span>{title}
      </h2>
      {children}
    </section>
  );
}

export const P = ({ children }: { children: React.ReactNode }) => <p style={{ marginBottom: 10 }}>{children}</p>;

export const UL = ({ children }: { children: React.ReactNode }) => (
  <ul style={{ margin: '0 0 10px', paddingLeft: 20, listStyle: 'disc' }}>{children}</ul>
);

export const B = ({ children }: { children: React.ReactNode }) => <strong style={{ color: 'var(--ink)' }}>{children}</strong>;
