import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PUBLIC_SITE_HOSTS, queryString } from "@/lib/site-url";

/**
 * Root van het domein.
 *
 * - Ingelogde medewerkers → dashboard.
 * - Anonieme bezoekers op werkenbijzwaluwcomfortsanitair.nl → het publieke
 *   vacatureoverzicht (dat is wat een sollicitant op dit domein zoekt; een
 *   loginscherm is daar een doodlopende weg). Querystring (utm/fbclid) gaat mee.
 * - Overige hosts (zwaluw-portal.vercel.app, localhost) → login, zoals voorheen.
 *
 * /login blijft rechtstreeks bereikbaar voor medewerkers (ook gelinkt in de
 * footer van de vacaturepagina's).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  if (PUBLIC_SITE_HOSTS.includes(host)) {
    redirect(`/vacature${queryString(await searchParams)}`);
  }

  redirect("/login");
}
