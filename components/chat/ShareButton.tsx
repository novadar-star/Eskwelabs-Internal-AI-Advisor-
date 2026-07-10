"use client";

import { useState } from "react";

export default function ShareButton({ conversationId }: { conversationId: string }) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to generate share link");
      }
      const data = await res.json();
      setShareToken(data.shareToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async () => {
    setIsSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to revoke share link");
      }
      setShareToken(null);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Share conversation"
        className="flex h-7 w-7 items-center justify-center rounded transition-colors relative"
        style={{ color: "var(--ink-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-muted)"; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-md shadow-lg border z-50 p-4" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>Share Conversation</h3>
          <p className="text-xs mb-4" style={{ color: "var(--ink-muted)" }}>
            Anyone with the link can view this conversation.
          </p>
          
          {error && <div className="text-red-500 text-xs mb-2">{error}</div>}

          {!shareToken ? (
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full rounded-md px-3 py-2 text-sm font-medium transition-colors flex justify-center items-center cursor-pointer"
              style={{ backgroundColor: "var(--ink)", color: "var(--bg-base)" }}
            >
              {isSharing ? "Generating..." : "Generate Link"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/share/${shareToken}`}
                  className="flex-1 rounded-md border px-2 py-1 text-xs"
                  style={{ backgroundColor: "var(--bg-hover)", borderColor: "var(--border)", color: "var(--ink)" }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyToClipboard}
                  className="rounded-md px-3 py-1 text-xs font-medium transition-colors border cursor-pointer"
                  style={{ backgroundColor: copied ? "#10b981" : "var(--bg-hover)", borderColor: "var(--border)", color: copied ? "white" : "var(--ink)" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              
              <button
                onClick={handleRevoke}
                disabled={isSharing}
                className="w-full rounded-md px-3 py-2 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex justify-center items-center cursor-pointer"
              >
                {isSharing ? "Revoking..." : "Revoke Link"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
