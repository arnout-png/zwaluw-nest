/**
 * ZwaluwNest — Create real production user accounts
 * Run once: npx tsx prisma/create-real-users.ts
 *
 * Creates accounts for the three new users with a temporary password.
 * They should change their password after first login.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ontbreekt — zet hem in .env voor je dit script draait.`);
  return value;
}

// Nooit hardcoderen: deze repo is publiek. Zet hem in .env (die is gitignored).
const TEMP_PASSWORD = requireEnv("SEED_MANAGER_PASSWORD");

async function upsertUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  jobTitle?: string;
}) {
  const { data: row, error } = await supabase
    .from("User")
    .upsert(
      { ...data, isActive: true },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id")
    .single();
  if (error) throw new Error(`User upsert (${data.email}): ${error.message}`);
  console.log(`  ✓ ${data.name} (${data.email}) — ${data.role}`);
  return row!.id as string;
}

async function main() {
  console.log("🦅 Creating real user accounts for ZwaluwNest...\n");
  console.log("Temporary password: uit SEED_MANAGER_PASSWORD\n");

  const hash = await bcrypt.hash(TEMP_PASSWORD, 12);

  await Promise.all([
    upsertUser({
      email: "nvdgroep@veiligdouchen.nl",
      passwordHash: hash,
      name: "Niels van de Groep",
      role: "ADMIN",
      jobTitle: "Hoofd Technische Dienst",
    }),
    upsertUser({
      email: "vmachiels@veiligdouchen.nl",
      passwordHash: hash,
      name: "Vincent Machiels",
      role: "ADMIN",
      jobTitle: "Salesmanager",
    }),
    upsertUser({
      email: "claudia@veiligdouchen.nl",
      passwordHash: hash,
      name: "Claudia Duivenvoorden",
      role: "BACKOFFICE",
      jobTitle: "Backoffice medewerker",
    }),
  ]);

  console.log("\n✅ Done. Users can log in at:");
  console.log("   https://www.werkenbijzwaluwcomfortsanitair.nl/login");
  console.log(`   Tijdelijk wachtwoord: ${TEMP_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
