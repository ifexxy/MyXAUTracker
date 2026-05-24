'use client';

import Footer from '@/components/Footer';

export default function ContactPage() {
  return (
    <>
      <section className="px-[20px] pt-[28px] pb-[18px] text-center">
        <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.3, color: 'var(--ink)' }}>
          Contact<span style={{ color: 'var(--gold)' }}>.</span>
        </h1>
        <p style={{ maxWidth: 340, margin: '14px auto 0', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.65 }}>
          Get in touch with the XauTracker team.
        </p>
      </section>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <div className="grid grid-cols-2 gap-[8px]">
          <a href="https://wa.me/2348131560586" target="_blank" rel="noopener" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-bold rounded-[8px] no-underline" style={{ background: '#25D366', color: '#000' }}>
            <i className="fa-brands fa-whatsapp" /> WhatsApp
          </a>
          <a href="mailto:ifexxy9@gmail.com" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-semibold rounded-[8px] no-underline" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-envelope" /> Email
          </a>
        </div>
      </div>

      <div className="mx-[20px] mb-[18px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Send us a message</h2>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Name</label>
            <input type="text" placeholder="Your name" style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Email</label>
            <input type="email" placeholder="you@email.com" style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 800 }}>Message</label>
            <textarea placeholder="How can we help?" rows={4} style={{ display: 'block', width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--ink)', fontSize: 14, padding: '12px 14px', outline: 'none', lineHeight: 1.6 }} />
          </div>
          <button type="submit" className="w-full py-[13px] text-[14px] font-bold rounded-[12px] cursor-pointer flex items-center justify-center gap-[8px]"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>
            <i className="fa-solid fa-paper-plane" /> Send Message
          </button>
        </form>
      </div>

      <Footer />
    </>
  );
}
