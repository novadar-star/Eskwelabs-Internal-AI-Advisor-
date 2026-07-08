/**
 * lib/sheets-sync.ts
 *
 * Google Sheets → Supabase advisors table sync.
 *
 * Reads advisor configuration from a Google Sheet and upserts
 * into the `advisors` table. This allows admins to manage advisors
 * via a familiar spreadsheet interface.
 *
 * ═══════════════════════════════════════════════════════════════
 * EXPECTED SHEET FORMAT
 * ═══════════════════════════════════════════════════════════════
 * Row 1: Headers (exact column names below)
 * Row 2+: Advisor data
 *
 * Required columns:
 *   - advisor_id      (text, e.g. "data_dashboard")
 *   - advisor_name    (text, e.g. "Data Dashboard Advisor")
 *   - short_name      (text, e.g. "Data Dashboard")
 *   - is_active       (TRUE/FALSE)
 *   - prompt          (Google Doc URL or Doc ID)
 *   - purpose         (text description)
 *
 * Optional columns:
 *   - description     (text, shown on advisor picker)
 *   - icon            (text, icon label — defaults to "document")
 *
 * ═══════════════════════════════════════════════════════════════
 * ENV VARS
 * ═══════════════════════════════════════════════════════════════
 *   ADVISOR_REGISTRY_SHEET_ID — the Google Sheet ID
 *   (Uses same service account as Google Docs fetching)
 */

import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabase";

const SHEET_ID = process.env.ADVISOR_REGISTRY_SHEET_ID ?? "";

/**
 * Extract Google Doc ID from a URL or return as-is if already an ID.
 * Handles URLs like: https://docs.google.com/document/d/DOC_ID/edit
 */
function extractDocId(input: string): string {
  if (!input) return "";
  const match = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

/**
 * Build the Google Auth client for Sheets API (reuses the same service account).
 */
async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Google service account credentials not configured.");
  }

  const privateKey = rawKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

export interface SheetAdvisor {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  promptDocId: string;
  isActive: boolean;
  purpose: string;
}

/**
 * Fetch advisor rows from Google Sheets.
 * Returns parsed advisor objects ready for DB upsert.
 */
export async function fetchAdvisorsFromSheet(): Promise<SheetAdvisor[]> {
  if (!SHEET_ID) {
    throw new Error("ADVISOR_REGISTRY_SHEET_ID env var not set.");
  }

  const sheets = await getSheetsClient();

  // Read the first sheet, all rows
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A:H", // columns A through H
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    throw new Error("Sheet is empty or has no data rows (only headers).");
  }

  // First row is headers — normalize to lowercase
  const headers = rows[0].map((h: string) => h.toString().toLowerCase().trim().replace(/\s+/g, "_"));

  // Map column indices
  const colIdx = (name: string) => headers.indexOf(name);
  const idxId = colIdx("advisor_id");
  const idxName = colIdx("advisor_name");
  const idxShort = colIdx("short_name");
  const idxActive = colIdx("is_active");
  const idxPrompt = colIdx("prompt");
  const idxPurpose = colIdx("purpose");
  const idxDesc = colIdx("description");
  const idxIcon = colIdx("icon");

  if (idxId === -1 || idxName === -1) {
    throw new Error("Sheet must have 'advisor_id' and 'advisor_name' columns.");
  }

  const advisors: SheetAdvisor[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[idxId]?.toString().trim();
    const name = row[idxName]?.toString().trim();

    // Skip empty rows
    if (!id || !name) continue;

    const isActiveRaw = idxActive >= 0 ? row[idxActive]?.toString().trim().toUpperCase() : "TRUE";
    const promptRaw = idxPrompt >= 0 ? row[idxPrompt]?.toString().trim() : "";

    advisors.push({
      id: id.toLowerCase().replace(/\s+/g, "_"),
      name,
      shortName: idxShort >= 0 ? row[idxShort]?.toString().trim() || name : name,
      description: idxDesc >= 0 ? row[idxDesc]?.toString().trim() || "" : "",
      icon: idxIcon >= 0 ? row[idxIcon]?.toString().trim() || "document" : "document",
      promptDocId: extractDocId(promptRaw),
      isActive: isActiveRaw === "TRUE" || isActiveRaw === "1" || isActiveRaw === "YES",
      purpose: idxPurpose >= 0 ? row[idxPurpose]?.toString().trim() || "" : "",
    });
  }

  return advisors;
}

/**
 * Sync advisors from Google Sheet into the Supabase advisors table.
 * Upserts all rows (existing advisors are updated, new ones are created).
 * Returns the count of synced advisors.
 */
export async function syncAdvisorsFromSheet(): Promise<{ synced: number; advisors: SheetAdvisor[] }> {
  const advisors = await fetchAdvisorsFromSheet();

  if (advisors.length === 0) {
    return { synced: 0, advisors: [] };
  }

  const supabase = getSupabaseAdmin();

  // Upsert all advisors
  const { error } = await supabase
    .from("advisors")
    .upsert(
      advisors.map((a) => ({
        id: a.id,
        name: a.name,
        short_name: a.shortName,
        description: a.description,
        icon: a.icon,
        prompt_doc_id: a.promptDocId || null,
        is_active: a.isActive,
        purpose: a.purpose,
      })),
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return { synced: advisors.length, advisors };
}
