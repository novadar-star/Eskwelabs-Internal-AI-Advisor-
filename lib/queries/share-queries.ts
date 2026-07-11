import { getSupabaseAdmin, getSupabaseUserClient } from "../supabase";
import crypto from "crypto";

export async function createOrRotateShareLink(conversationId: string, userId: string) {
  // 1. Verify ownership via admin client with explicit user_id check (proven pattern)
  const adminClient = getSupabaseAdmin();
  const { data: conversation, error: verifyError } = await adminClient
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (verifyError || !conversation) {
    throw new Error("Conversation not found or access denied.");
  }

  const newToken = crypto.randomUUID();

  // 2. Perform atomic upsert
  
  const { data, error } = await adminClient
    .from("conversation_shares")
    .upsert(
      {
        conversation_id: conversationId,
        share_token: newToken,
        is_active: true,
      },
      { onConflict: "conversation_id" }
    )
    .select("share_token")
    .single();

  if (error) {
    throw new Error("Failed to create or rotate share link: " + error.message);
  }

  return data.share_token;
}

export async function revokeShareLink(conversationId: string, userId: string) {
  // 1. Verify ownership via admin client with explicit user_id check
  const adminClient = getSupabaseAdmin();
  const { data: conversation, error: verifyError } = await adminClient
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (verifyError || !conversation) {
    throw new Error("Conversation not found or access denied.");
  }

  // 2. Revoke via service_role client
  const { error } = await adminClient
    .from("conversation_shares")
    .update({ is_active: false })
    .eq("conversation_id", conversationId);

  if (error) {
    throw new Error("Failed to revoke share link: " + error.message);
  }
}

export async function getSharedConversation(shareToken: string) {
  const adminClient = getSupabaseAdmin();
  
  // 1. Validate the token and get the conversation ID
  // Explicitly filtering on is_active = true as per Section 7
  const { data: shareData, error: shareError } = await adminClient
    .from("conversation_shares")
    .select("conversation_id")
    .eq("share_token", shareToken)
    .eq("is_active", true)
    .single();

  if (shareError || !shareData) {
    return null; // Not found or inactive
  }

  const conversationId = shareData.conversation_id;

  // 2. Fetch the whitelisted conversation details
  const { data: conversation, error: convError } = await adminClient
    .from("conversations")
    .select("title, created_at")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return null;
  }

  // 3. Fetch the whitelisted messages
  // Explicitly ordering by created_at ASC and filtering roles/status as per Section 7
  const { data: messages, error: msgError } = await adminClient
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .eq("status", "ok")
    .order("created_at", { ascending: true });

  if (msgError) {
    throw new Error("Failed to fetch messages for shared conversation.");
  }

  return {
    conversation,
    messages: messages || [],
  };
}
