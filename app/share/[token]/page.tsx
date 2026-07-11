import { notFound } from "next/navigation";
import { getSharedConversation } from "@/lib/queries/share-queries";
import ReadOnlyMessageList from "@/components/chat/ReadOnlyMessageList";
import type { Metadata } from "next";

// Mitigation Strategy Tradeoff: Implement short-TTL edge caching (60s)
// to absorb redundant reads from bots/scrapers since this route is unauthenticated.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shared Conversation",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedConversationPage({ params }: { params: { token: string } }) {
  const { token } = params;
  
  if (!token) {
    notFound();
  }

  const sharedData = await getSharedConversation(token);

  if (!sharedData) {
    notFound();
  }

  const { conversation, messages } = sharedData;
  const createdDate = new Date(conversation.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="flex h-screen w-full flex-col font-sans" style={{ backgroundColor: "var(--bg-base)" }}>
      <header className="flex h-[52px] items-center justify-between border-b px-6 shrink-0" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-base)" }}>
        <div className="flex flex-col">
          <h1 className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>{conversation.title}</h1>
          <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>Shared on {createdDate}</span>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden relative flex flex-col max-w-4xl mx-auto w-full">
        <ReadOnlyMessageList messages={messages} />
      </main>
    </div>
  );
}
