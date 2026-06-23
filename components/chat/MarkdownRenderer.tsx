"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  try {
    if (!content) return null;

    // Normalize newlines
    const normalized = content.replace(/\r\n/g, "\n");
    // Split into blocks by double newlines or more
    const blocks = normalized.split(/\n\n+/);

    return (
      <div className="space-y-3">
        {blocks.map((block, blockIdx) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // 1. Code Block
          if (trimmed.startsWith("```")) {
            const lines = trimmed.split("\n");
            const codeLines = lines.slice(1);
            // Check if last line contains closing backticks
            if (codeLines.length > 0 && codeLines[codeLines.length - 1].trim().startsWith("```")) {
              codeLines.pop();
            }
            return (
              <pre
                key={blockIdx}
                className="my-3 overflow-x-auto rounded bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 p-3 text-[13px] font-mono text-zinc-900 dark:text-zinc-200 leading-normal"
              >
                <code>{codeLines.join("\n")}</code>
              </pre>
            );
          }

          // 2. Headings (# to ######)
          if (trimmed.startsWith("#")) {
            const match = trimmed.match(/^(#{1,6})\s+([\s\S]*)$/);
            if (match) {
              const level = match[1].length;
              const text = match[2];
              const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

              let classes = "font-semibold text-ink my-2";
              if (level === 1) classes += " text-[16px] border-b pb-1 border-theme";
              else if (level === 2) classes += " text-[15px]";
              else if (level === 3) classes += " text-[14px]";
              else if (level === 4) classes += " text-[13.5px] opacity-90";
              else if (level === 5) classes += " text-[13px] opacity-80";
              else classes += " text-[12.5px] opacity-70";

              return (
                <HeadingTag key={blockIdx} className={classes}>
                  {parseInline(text)}
                </HeadingTag>
              );
            }
          }

          // 3. Horizontal Rule
          if (trimmed === "---" || trimmed === "***") {
            return (
              <hr
                key={blockIdx}
                className="my-4 border-t border-zinc-200/80 dark:border-zinc-800/80"
              />
            );
          }

          // 4. Unordered or Ordered Lists
          const lines = trimmed.split("\n");
          const firstLine = lines[0].trim();
          const isUnordered = firstLine.startsWith("- ") || firstLine.startsWith("* ");
          const isOrdered = /^\d+\.\s/.test(firstLine);

          if (isUnordered || isOrdered) {
            const items: string[] = [];
            lines.forEach((line) => {
              const lineTrim = line.trim();
              if (isUnordered && (lineTrim.startsWith("- ") || lineTrim.startsWith("* "))) {
                items.push(lineTrim.substring(2));
              } else if (isOrdered && /^\d+\.\s/.test(lineTrim)) {
                items.push(lineTrim.replace(/^\d+\.\s/, ""));
              } else if (items.length > 0) {
                // If it's a multi-line list item, append to the last item
                items[items.length - 1] += "\n" + line;
              } else {
                items.push(line);
              }
            });

            const ListTag = isOrdered ? "ol" : "ul";
            const listStyle = isOrdered ? "list-decimal pl-5 space-y-1 my-1.5" : "list-disc pl-5 space-y-1 my-1.5";

            return (
              <ListTag key={blockIdx} className={listStyle}>
                {items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed text-zinc-900 dark:text-zinc-100">
                    {parseInline(item)}
                  </li>
                ))}
              </ListTag>
            );
          }

          // 5. Regular Paragraph
          return (
            <p key={blockIdx} className="leading-relaxed text-zinc-900 dark:text-zinc-100">
              {lines.map((line, lineIdx) => (
                <span key={lineIdx}>
                  {parseInline(line)}
                  {lineIdx < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    );
  } catch (error) {
    console.warn("[MarkdownRenderer] Error parsing markdown, falling back to raw text:", error);
    return (
      <pre className="whitespace-pre-wrap font-sans text-ink leading-relaxed text-[14px]">
        {content}
      </pre>
    );
  }
}

/**
 * Parses inline formatting: **bold**, *italic*, and `inline code`.
 * Employs splits via Regex and builds native React components to prevent XSS.
 */
function parseInline(text: string): React.ReactNode[] {
  // Matches: **bold**, *italic*, `inline code`
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-zinc-900 dark:text-zinc-50">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[13px] text-zinc-900 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/30"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
