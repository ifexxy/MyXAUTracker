import dynamic from 'next/dynamic';

const PredictClient = dynamic(() => import('./PredictClient'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)' }} />
    </div>
  ),
});

export default function PredictPage() {
  return <PredictClient />;
}
