import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  // ── 1. Explicit 401 for unauthenticated requests ──────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const advisorId = searchParams.get("advisor") || "all";

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  // Security: escape ILIKE wildcards to prevent pattern injection
  const safeQuery = query.replace(/%/g, "\\%").replace(/_/g, "\\_");

  try {
    // ── 2. Initialize Admin Client (with explicit user_id filtering) ─────
    const supabase = getSupabaseAdmin();

    // ── 3. Query Conversations by Title ──────────────────────────────────
    let conversationsQuery = supabase
      .from("conversations")
      .select("id, title, advisor_id, created_at, updated_at")
      .eq("user_id", userId)
      .ilike("title", `%${safeQuery}%`)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (advisorId && advisorId !== "all") {
      conversationsQuery = conversationsQuery.eq("advisor_id", advisorId);
    }

    const { data: titleMatches, error: titleError } = await conversationsQuery;

    if (titleError) {
      console.error("[search] Conversations title query error:", titleError.message);
      return NextResponse.json(
        { error: "Failed to search conversations." },
        { status: 500 }
      );
    }

    // ── 4. Query Messages by Content ──────────────────────────────────────
    let messagesQuery = supabase
      .from("messages")
      .select(`
        content,
        conversation_id,
        conversations!inner (
          id,
          title,
          advisor_id,
          created_at,
          updated_at,
          user_id
        )
      `)
      .eq("user_id", userId)
      .ilike("content", `%${safeQuery}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (advisorId && advisorId !== "all") {
      messagesQuery = messagesQuery.eq("conversations.advisor_id", advisorId);
    }

    const { data: contentMatches, error: contentError } = await messagesQuery;

    if (contentError) {
      console.error("[search] Messages content query error:", contentError.message);
      return NextResponse.json(
        { error: "Failed to search messages." },
        { status: 500 }
      );
    }

    // ── 5. In-Memory Merge, Deduplication, & Truncation ────────────────────
    const resultsMap = new Map<string, {
      conversation_id: string;
      title: string;
      advisor_id: string;
      matched_message_preview: string | null;
      created_at: string;
      updated_at: string;
    }>();

    // Map title matches
    if (titleMatches) {
      for (const c of titleMatches) {
        resultsMap.set(c.id, {
          conversation_id: c.id,
          title: c.title,
          advisor_id: c.advisor_id,
          matched_message_preview: null,
          created_at: c.created_at,
          updated_at: c.updated_at,
        });
      }
    }

    // Map message matches (truncating matched_message_preview to max 120 chars)
    if (contentMatches) {
      for (const m of contentMatches) {
        const conv = m.conversations as any;
        if (!conv) continue;

        const preview = m.content ? m.content.substring(0, 120) : "";

        if (resultsMap.has(conv.id)) {
          // If the conversation is already in the map, prioritize showing the message preview
          const existing = resultsMap.get(conv.id)!;
          if (!existing.matched_message_preview) {
            existing.matched_message_preview = preview;
          }
        } else {
          resultsMap.set(conv.id, {
            conversation_id: conv.id,
            title: conv.title,
            advisor_id: conv.advisor_id,
            matched_message_preview: preview,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
          });
        }
      }
    }

    // ── 6. Sort & Limit to 20 Results ─────────────────────────────────────
    const results = Array.from(resultsMap.values())
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20);

    return NextResponse.json(results);

  } catch (err: any) {
    console.error("[search] Server error:", err.message || err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
