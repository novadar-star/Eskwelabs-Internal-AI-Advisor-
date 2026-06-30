const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, './.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const url = `${supabaseUrl}/rest/v1/pg_constraint`;
  const headers = {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Accept-Profile': 'pg_catalog'
  };

  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    console.log("Response status:", res.status);
    console.log("Response headers:", [...res.headers.entries()]);
    console.log("Response body:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

check();
