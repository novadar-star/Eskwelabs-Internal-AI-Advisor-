/**
 * app/chat/page.tsx
 *
 * Server Component — entry point for the /chat route.
 * Reads the session, checks consent_given from the users table,
 * and passes everything to ChatShell.
 *
 * consent_given is fetched server-side so the modal state is
 * authoritative from the DB — not from localStorage, which could
 * be cleared or spoofed.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import ChatShell from "@/app/chat/ChatShell";

export default async function ChatPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Read consent_given from DB. Default to false if query fails — the
  // modal is a safety net, so defaulting to "show" is the safe choice.
  let consentGiven = false;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("users")
      .select("consent_given")
      .eq("id", session.user.id)
      .single();
    consentGiven = data?.consent_given ?? false;
  } catch {
    // DB unreachable — show the modal (fail safe)
    consentGiven = false;
  }

  return (
    <ChatShell
      userId={session.user.id}
      userEmail={session.user.email ?? ""}
      userRole={session.user.role}
      consentGiven={consentGiven}
    />
  );
}
