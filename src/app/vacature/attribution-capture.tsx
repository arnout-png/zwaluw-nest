'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { captureAttribution } from '@/lib/attribution';

/**
 * Legt bij elke paginaweergave in /vacature de herkomst vast (utm-tags,
 * fbclid, referrer), zodat die bij het solliciteren nog bekend is — ook als de
 * bezoeker eerst nog doorklikte. Rendert niets.
 */
export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution();
  }, [pathname]);
  return null;
}
