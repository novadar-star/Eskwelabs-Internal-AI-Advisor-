require("dotenv").config({ path: ".env.local" });

async function getOpenAPI() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const res = await fetch(url, {
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  
  const json = await res.json();
  const tables = Object.keys(json.definitions || json.components?.schemas || {});
  console.log("Tables in OpenAPI spec:", tables);
}

getOpenAPI();
