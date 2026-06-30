/**
 * lib/chat-types.ts
 *
 * Shared TypeScript types for the chat feature.
 * Kept in lib/ so both client components and future server/API code
 * can import from one place without circular dependencies.
 */

export type AdvisorId = string;

export interface Advisor {
  id: AdvisorId;
  name: string;
  description: string;
  /** Short label shown in the chat header and conversation list */
  shortName: string;
  /** Tailwind color classes for the advisor's avatar/accent */
  accentColor: string;
  iconLabel: string; // single emoji used as avatar fallback
  colorTheme?: any;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  provider?: string | null;
  model?: string | null;
}

export interface Conversation {
  id: string;
  advisorId: AdvisorId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  /** Preview of the last message — shown in the sidebar */
  lastMessage?: string;
}
