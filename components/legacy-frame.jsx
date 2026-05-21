export function LegacyFrame({ src, title }) {
  return (
    <iframe
      title={title}
      src={src}
      style={{ width: '100%', height: '100dvh', border: '0', display: 'block' }}
    />
  );
}
