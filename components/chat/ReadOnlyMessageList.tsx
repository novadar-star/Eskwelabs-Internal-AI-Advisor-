import MarkdownRenderer from "./MarkdownRenderer";

interface ReadOnlyMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface ReadOnlyMessageListProps {
  messages: ReadOnlyMessage[];
}

export default function ReadOnlyMessageList({ messages }: ReadOnlyMessageListProps) {
  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-6"
      style={{ backgroundColor: "var(--bg-base)" }}
      role="log"
      aria-label="Conversation messages"
    >
      {messages.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <p className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
            No messages available in this shared conversation.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {messages.map((message) => (
          <ReadOnlyMessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

function ReadOnlyMessageBubble({ message }: { message: ReadOnlyMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-end gap-2 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold select-none"
        style={
          isUser
            ? { backgroundColor: "var(--bg-hover)", color: "var(--ink-muted)" }
            : { backgroundColor: "var(--avatar-ai-bg)", color: "var(--avatar-ai-text)" }
        }
        aria-hidden="true"
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={`flex max-w-[72%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className="rounded-md px-3.5 py-2.5 text-[14px] leading-relaxed"
          style={
            isUser
              ? { backgroundColor: "var(--bubble-user-bg)", color: "var(--bubble-user-text)" }
              : { backgroundColor: "var(--bubble-ai-bg)", color: "var(--bubble-ai-text)", border: "1px solid var(--bubble-ai-border)" }
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Timestamp */}
        <div
          className="flex items-center gap-3 text-[11px] min-h-[18px] select-none"
          style={{ color: "var(--ink-muted)" }}
        >
          <span>{formatTime(new Date(message.created_at))}</span>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}
