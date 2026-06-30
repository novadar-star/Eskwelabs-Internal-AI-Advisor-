require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function testInsert() {
  console.log("Checking project:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  const { data, error } = await supabase
    .from("advisors")
    .select("id")
    .limit(1);

  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS, table exists. Data:", data);
  }
}

testInsert();
