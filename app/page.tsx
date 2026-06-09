/**
 * app/page.tsx
 *
 * Root route — "/" 
 *
 * This page has no UI. Its only job is to redirect:
 * - Authenticated users → /chat
 * - Unauthenticated users → /login
 *
 * The middleware handles unauthenticated redirects to /login automatically,
 * so this redirect targets authenticated users arriving at the root.
 *
 * This is a Server Component.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();

  if (session) {
    redirect("/chat");
  } else {
    redirect("/login");
  }
}
