import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOrRotateShareLink, revokeShareLink } from "@/lib/queries/share-queries";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  try {
    const shareToken = await createOrRotateShareLink(conversationId, userId);
    return NextResponse.json({ shareToken });
  } catch (error: any) {
    console.error("[POST /api/conversations/[id]/share]", error);
    // Return 404 to avoid leaking existence of another user's conversation on ownership failure
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userId = session.user.id;
  const conversationId = params.id;

  try {
    await revokeShareLink(conversationId, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/conversations/[id]/share]", error);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}
