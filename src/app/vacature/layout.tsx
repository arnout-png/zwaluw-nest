import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Solliciteer bij Veilig Douchen',
  description: 'Bekijk onze openstaande vacatures en solliciteer direct online.',
};

export default function VacatureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} bg-[#fbf9f8] text-[#1b1c1c] antialiased min-h-screen flex flex-col`}>
      {/* Sticky nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 py-3">
          <Link href="/vacature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Zwaluw Comfortsanitair" className="h-9 w-auto" />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm tracking-wide">
            <Link href="/vacature" className="text-teal-700 border-b-2 border-orange-500 pb-1 hover:text-orange-500 transition-colors">
              Vacatures
            </Link>
            <a
              href="https://veiligdouchen.nl/over-veilig-douchen/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-orange-500 transition-colors"
            >
              Over ons
            </a>
            <a
              href="https://veiligdouchen.nl/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-orange-500 transition-colors"
            >
              Contact
            </a>
            <Link
              href="/vacature"
              className="bg-[#196961] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#145a54] transition-colors"
            >
              Solliciteer Nu
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 pb-24 md:pb-0 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-8 gap-4 max-w-7xl mx-auto">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-teal-900 font-bold">
              Zwaluw Comfortsanitair
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              © {new Date().getFullYear()} Zwaluw Comfortsanitair. Alle rechten voorbehouden.
            </p>
          </div>
          <div className="flex gap-6">
            <a href="https://veiligdouchen.nl/privacybeleid/" target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-teal-600 opacity-80">
              Privacy Policy
            </a>
            <a href="https://veiligdouchen.nl/privacybeleid/" target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-teal-600 opacity-80">
              Cookies
            </a>
            <a
              href="https://veiligdouchen.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-orange-600 font-bold hover:text-teal-600 opacity-80"
            >
              veiligdouchen.nl
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl z-50 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.04)] border-t border-slate-100">
        <Link href="/vacature" className="flex flex-col items-center justify-center bg-teal-50 text-teal-800 rounded-2xl px-5 py-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Vacatures</span>
        </Link>
        <a
          href="https://veiligdouchen.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center text-slate-500 px-5 py-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Over Ons</span>
        </a>
        <a href="#solliciteren" className="flex flex-col items-center justify-center text-slate-500 px-5 py-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] font-medium tracking-wider uppercase mt-1">Contact</span>
        </a>
      </nav>
    </div>
  );
}
