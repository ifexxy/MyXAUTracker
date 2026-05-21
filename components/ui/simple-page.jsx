export function SimplePage({ title, description }) {
  return (
    <section className="rounded-xl border border-white/10 bg-card p-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </section>
  );
}
