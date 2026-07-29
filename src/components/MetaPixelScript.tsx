import Script from 'next/script';
import { META_PIXEL_ID } from '@/lib/meta-pixel';

/**
 * Meta Pixel browser-init + PageView.
 *
 * Wordt uitsluitend geladen via de /vacature-layout, dus alleen op de
 * publieke vacaturesectie waar Meta-ads op landen. Het interne portal blijft
 * pixel-vrij.
 *
 * strategy="afterInteractive": de Pixel laadt direct na React-hydration, vóór
 * window.onload. Dat is essentieel om vroege-bouncers vanaf een ad te pixelen —
 * met "lazyOnload" vuurt PageView pas na window.onload en mis je een groot deel
 * van de bezoekers (BrochureFlow zag daar historisch -43% leadvolume door).
 */
export default function MetaPixelScript() {
  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s){
            if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
            t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)
          }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `,
      }}
    />
  );
}
