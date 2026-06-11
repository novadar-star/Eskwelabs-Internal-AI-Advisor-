/**
 * app/chat/page.tsx
 *
 * Server Component — entry point for the /chat route.
 * Reads the session and passes userId + email + role to ChatShell.
 * userId is needed by ChatShell to refresh the conversation list after
 * a new turn is persisted.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ChatShell from "@/app/chat/ChatShell";

export default async function ChatPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <ChatShell
      userId={session.user.id}
      userEmail={session.user.email ?? ""}
      userRole={session.user.role}
    />
  );
}
