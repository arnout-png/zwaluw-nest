import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import MetaPixelScript from '@/components/MetaPixelScript';
import { PUBLIC_SITE_URL } from '@/lib/site-url';
import { COMPANY } from '@/lib/vacature';
import { AttributionCapture } from './attribution-capture';
import { MobileNav } from './mobile-nav';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const SITE_NAME = 'Werken bij Zwaluw Comfortsanitair';

/**
 * Publieke werken-bij-sectie. Het portal zelf staat op noindex (root layout);
 * deze sectie juist niet: vacatures moeten vindbaar zijn (Google for Jobs) en
 * netjes delen op Facebook. Pagina's overschrijven title/description/og.
 */
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: `Vacatures | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Werken bij Zwaluw Comfortsanitair in Zeewolde: bekijk onze openstaande vacatures en solliciteer direct online.',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    siteName: SITE_NAME,
    locale: 'nl_NL',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function VacatureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} bg-[#fbf9f8] text-[#1b1c1c] antialiased min-h-screen flex flex-col`}>
      {/* Meta Pixel — alleen op de publieke vacaturesectie, niet op het interne portal */}
      <MetaPixelScript />
      <AttributionCapture />

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
            <a href={COMPANY.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-teal-600 opacity-80">
              Privacy &amp; cookies
            </a>
            <Link href="/login" className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-teal-600 opacity-80">
              Inloggen medewerkers
            </Link>
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
      <MobileNav />
    </div>
  );
}
