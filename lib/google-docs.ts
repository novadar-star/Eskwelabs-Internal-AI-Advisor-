/**
 * lib/google-docs.ts
 *
 * Google Docs API client — server-side only.
 *
 * Uses a Google service account with read-only Docs access.
 * Credentials come from environment variables only — never from the browser.
 */

import { google } from "googleapis";
import type { docs_v1 } from "googleapis";

// ── Auth client ────────────────────────────────────────────────────────────

let _authClient: Awaited<ReturnType<typeof buildAuthClient>> | null = null;

async function buildAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Google service account credentials are not configured. " +
        "Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  // The private key in .env.local has literal \n strings.
  // We unescape them back to real newlines for the PEM parser.
  // We also strip surrounding quotes that some editors add.
  const privateKey = rawKey
    .replace(/^["']|["']$/g, "")   // strip leading/trailing quotes
    .replace(/\\n/g, "\n");         // unescape \n → real newlines

  // Use GoogleAuth with explicit credentials object.
  // This handles both PKCS#8 ("BEGIN PRIVATE KEY") and PKCS#1 ("BEGIN RSA PRIVATE KEY")
  // automatically — no manual key parsing needed.
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });

  return auth;
}

async function getAuthClient() {
  if (!_authClient) {
    _authClient = await buildAuthClient();
  }
  return _authClient;
}

// ── Doc fetcher ────────────────────────────────────────────────────────────

/**
 * Fetch a Google Doc by its document ID and return its content as plain text.
 * Throws on auth failure, network failure, or if the doc is not accessible.
 */
export async function fetchGoogleDoc(
  docId: string
): Promise<{ text: string; revision: string }> {
  const auth = await getAuthClient();
  const docs = google.docs({ version: "v1", auth });

  const response = await docs.documents.get({ documentId: docId });

  const doc = response.data;
  const revision = doc.revisionId ?? "unknown";
  const text = extractText(doc);

  if (!text.trim()) {
    throw new Error(`Google Doc ${docId} returned empty content.`);
  }

  return { text, revision };
}

/**
 * Fetch only the title of a Google Doc by its document ID.
 * Cheaper than fetchGoogleDoc — does not extract or validate body text.
 * Used by the admin "Verify Doc" button as a lightweight accessibility check.
 * Throws on auth failure, network failure, or if the doc is not accessible.
 */
export async function fetchGoogleDocTitle(docId: string): Promise<string> {
  const auth = await getAuthClient();
  const docs = google.docs({ version: "v1", auth });

  const response = await docs.documents.get({ documentId: docId });
  return response.data.title ?? "(Untitled)";
}

// ── Text extractor ─────────────────────────────────────────────────────────

function extractText(doc: docs_v1.Schema$Document): string {
  const lines: string[] = [];

  for (const element of doc.body?.content ?? []) {
    if (element.paragraph) {
      const paraText = (element.paragraph.elements ?? [])
        .map((el) => el.textRun?.content ?? "")
        .join("");
      lines.push(paraText);
    }

    if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellContent of cell.content ?? []) {
            const cellText = (cellContent.paragraph?.elements ?? [])
              .map((el) => el.textRun?.content ?? "")
              .join("");
            if (cellText.trim()) lines.push(cellText);
          }
        }
      }
    }
  }

  return lines.join("").trim();
}
