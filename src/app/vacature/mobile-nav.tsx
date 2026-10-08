'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Onderbalk op mobiel. Op een vacaturepagina is de rechterknop een altijd
 * zichtbare "Solliciteer"-knop: bezoekers uit de Facebook-app zien anders pas
 * na flink scrollen hoe ze kunnen solliciteren (de knop in de hero valt op een
 * telefoon precies achter deze balk).
 */
export function MobileNav() {
  const pathname = usePathname() ?? '';
  const onVacancy = /^\/vacature\/[^/]+$/.test(pathname) && pathname !== '/vacature/og';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl z-50 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.04)] border-t border-slate-100">
      <Link
        href="/vacature"
        className={`flex flex-col items-center justify-center rounded-2xl px-5 py-2 ${onVacancy ? 'text-slate-500' : 'bg-teal-50 text-teal-800'}`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Vacatures</span>
      </Link>
      <a
        href="https://veiligdouchen.nl/over-veilig-douchen/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center text-slate-500 px-5 py-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Over ons</span>
      </a>
      {onVacancy ? (
        <a
          href="#solliciteren"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#8b5000] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#8b5000]/20"
        >
          Solliciteer
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      ) : (
        <a
          href="https://veiligdouchen.nl/contact/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center text-slate-500 px-5 py-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Contact</span>
        </a>
      )}
    </nav>
  );
}
