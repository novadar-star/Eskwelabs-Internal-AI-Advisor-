import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseUserClient } from "@/lib/supabase";
import { getAdvisor } from "@/lib/advisors";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── 1. Explicit 401 for unauthenticated requests ──────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation ID is required." },
      { status: 400 }
    );
  }

  try {
    // ── 2. Initialize User-Scoped Client ─────────────────────────────────
    const supabase = await getSupabaseUserClient(userId);

    // ── 3. Fetch Conversation (natural RLS enforcement) ──────────────────
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, title, advisor_id, user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      console.error("[export] Supabase conversation query error:", convError.message);
      return NextResponse.json(
        { error: "Failed to export conversation." },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    // Secondary safety guard
    if (conversation.user_id !== userId) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    // ── 4. Fetch Messages ordered by created_at asc ───────────────────────
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("[export] Supabase messages query error:", msgError.message);
      return NextResponse.json(
        { error: "Failed to export conversation." },
        { status: 500 }
      );
    }

    // ── 5. Format Plain Text File Content ────────────────────────────────
    const advisor = getAdvisor(conversation.advisor_id);
    const advisorName = advisor ? advisor.name : conversation.advisor_id;

    const formattedDate = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      dateStyle: "long",
      timeStyle: "medium",
    });

    let fileContent = `Eskwelabs AI Advisor — ${advisorName}
Conversation: ${conversation.title}
Exported: ${formattedDate}
────────────────────────────────────────

`;

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        const roleLabel = msg.role === "user" ? "[You]" : "[Advisor]";
        fileContent += `${roleLabel}\n${msg.content}\n\n`;
      }
    }

    // Trim trailing newlines cleanly
    fileContent = fileContent.trimEnd() + "\n";

    // ── 6. Filename Sanitization Rules ───────────────────────────────────
    const sanitizedTitle = conversation.title
      .replace(/[^a-zA-Z0-9 -]/g, "") // strip all except alphanumerics, spaces, and hyphens
      .replace(/\s+/g, "_")           // replace spaces with underscores
      .substring(0, 50);              // truncate to 50 chars max
    const filename = `${sanitizedTitle || "conversation"}.txt`;

    // ── 7. Return plain text file download response ──────────────────────
    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    console.error("[export] Server error:", err.message || err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
