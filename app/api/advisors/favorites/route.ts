import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseUserClient } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseUserClient(session.user.id);
    // RLS ensures they can only see their own rows
    const { data, error } = await supabase
      .from("user_advisor_favorites")
      .select("advisor_id");

    if (error) throw error;
    
    return NextResponse.json({ favorites: data.map((row) => row.advisor_id) });
  } catch (error) {
    console.error("[GET /api/advisors/favorites] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { advisor_id } = await req.json();
    if (!advisor_id) {
      return NextResponse.json({ error: "Missing advisor_id" }, { status: 400 });
    }

    const supabase = await getSupabaseUserClient(session.user.id);
    const { error } = await supabase
      .from("user_advisor_favorites")
      .insert({ user_id: session.user.id, advisor_id });

    // 23505 is unique violation, ignore if already favorited
    if (error && error.code !== "23505") throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/advisors/favorites] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const advisor_id = searchParams.get("advisor_id");

    if (!advisor_id) {
      return NextResponse.json({ error: "Missing advisor_id" }, { status: 400 });
    }

    const supabase = await getSupabaseUserClient(session.user.id);
    const { error } = await supabase
      .from("user_advisor_favorites")
      .delete()
      .eq("user_id", session.user.id)
      .eq("advisor_id", advisor_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/advisors/favorites] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
