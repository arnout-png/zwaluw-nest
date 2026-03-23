import type { Metadata } from 'next';
import { Poppins, Roboto } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Solliciteer bij Veilig Douchen',
  description: 'Bekijk onze openstaande vacatures en solliciteer direct online.',
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} ${roboto.variable} bg-white text-[#363636] antialiased min-h-screen flex flex-col`}>
      {/* Header */}
      <header className="bg-[#3A4141] px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <span className="font-poppins text-lg font-bold text-white tracking-wide">
            Veilig Douchen
          </span>
          <span className="text-xs text-white/60">Werken bij ons</span>
        </div>
      </header>

      {/* Teal accent bar */}
      <div className="h-1 bg-[#68b0a6]" />

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#3A4141] py-6 px-6 mt-16">
        <div className="mx-auto max-w-5xl text-center text-xs text-white/50">
          © {new Date().getFullYear()} Veilig Douchen. Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}
