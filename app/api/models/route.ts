import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Authenticated check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const advisorId = searchParams.get("advisorId");
  if (!advisorId) {
    return NextResponse.json({ error: "advisorId is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("model_config")
      .select("advisor_id, provider, model")
      .eq("advisor_id", advisorId)
      .single();

    if (error) {
      console.error("[api/models] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to fetch model." }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (err: any) {
    console.error("[api/models] Server error:", err.message || err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
