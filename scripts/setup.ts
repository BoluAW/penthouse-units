import { createInterface } from "readline/promises";
import bcrypt from "bcryptjs";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    console.error(
      "Couldn't find .env.local. Create it with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const name = (await rl.question("Admin's name: ")).trim();
  if (!name) {
    console.error("Name can't be empty.");
    rl.close();
    process.exit(1);
  }

  let pin = "";
  while (!/^\d{6}$/.test(pin)) {
    pin = (await rl.question("Admin's 6-digit PIN: ")).trim();
    if (!/^\d{6}$/.test(pin)) console.log("PIN must be exactly 6 digits.");
  }

  rl.close();

  const pinHash = await bcrypt.hash(pin, 10);

  const { data, error } = await supabase
    .from("people")
    .insert({ name, pin_hash: pinHash, is_admin: true })
    .select("id")
    .single();

  if (error) {
    console.error("Could not create admin:", error.message);
    process.exit(1);
  }

  console.log(`Admin "${name}" created (id: ${data.id}).`);
}

main();
