/**
 * migrate-advisor-db.js
 *
 * Runs the database migration to rename advisor_3 to data_modeling.
 * First loads .env.local using dotenv, then invokes the
 * migrate_advisor_to_data_modeling RPC function in Supabase.
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local in the root directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Initialize Supabase Admin client using the service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("🚀 Initializing advisor migration in Supabase...");
  console.log(`Supabase URL: ${supabaseUrl}`);

  // Call the database migration function
  const { data, error } = await supabase.rpc('migrate_advisor_to_data_modeling');

  if (error) {
    console.error("❌ Migration failed!");
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log("✅ Database migration completed successfully!");
}

run();
