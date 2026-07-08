/**
 * app/api/admin/advisors/sync/route.ts
 *
 * POST /api/admin/advisors/sync
 *
 * Syncs advisor configuration from Google Sheets into the advisors table.
 * Admin only. Reads the sheet specified by ADVISOR_REGISTRY_SHEET_ID env var,
 * upserts all rows into the DB.
 *
 * This allows admins to manage advisors via a Google Sheet:
 *   - Add a new row → new advisor appears after sync
 *   - Set is_active to FALSE → advisor hidden after sync
 *   - Change prompt URL → new prompt doc used after sync + cache refresh
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAdvisorsFromSheet } from "@/lib/sheets-sync";
import { logEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const result = await syncAdvisorsFromSheet();

    logEvent({
      event: "admin_model_changed",
      userId: session.user.id,
      metadata: {
        action: "sheet_sync",
        synced: result.synced,
        advisorIds: result.advisors.map((a) => a.id),
        email: session.user.email,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Synced ${result.synced} advisor(s) from Google Sheets.`,
      advisors: result.advisors.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive })),
    });
  } catch (err) {
    console.error("[api/admin/advisors/sync] Error:", (err as Error).message);
    return NextResponse.json(
      { error: (err as Error).message || "Sync failed." },
      { status: 500 }
    );
  }
}
