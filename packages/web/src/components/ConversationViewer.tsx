import { useEffect, useRef, useState } from "react";
import type { ConversationDetail } from "../lib/api.js";
import { conversationToMarkdown } from "../lib/api.js";
import { MessageBubble } from "./MessageBubble.js";
import { ProviderBadge } from "./ProviderBadge.js";
import { TagEditor } from "./TagEditor.js";

interface Props {
  detail: ConversationDetail | null;
  loading: boolean;
  onClose?: () => void;
  onTagsChanged?: (conversationId: string, tags: string[]) => void;
}

export function ConversationViewer({ detail, loading, onClose, onTagsChanged }: Props) {
  const [localTags, setLocalTags] = useState<string[]>([]);

  useEffect(() => {
    setLocalTags(detail?.conversation.tags ?? []);
  }, [detail?.conversation.id]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.conversation.id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
        <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4.02-.855L3 20l1.065-3.195A7.966 7.966 0 0 1 3 12C3 7.582 7.03 4 12 4s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">Select a conversation to view it</p>
      </div>
    );
  }

  const { conversation: conv, messages } = detail;

  function handleExport() {
    const md = conversationToMarkdown(detail!);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv.title ?? "conversation").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3 shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-200 mr-1"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 truncate">
            {conv.title ?? "Untitled conversation"}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <ProviderBadge provider={conv.provider} size="xs" />
            {conv.model && (
              <span className="text-[11px] text-slate-500">{conv.model}</span>
            )}
            <span className="text-[11px] text-slate-600">
              {new Date(conv.createdAt).toLocaleDateString()}
            </span>
          </div>
          <TagEditor
            conversationId={conv.id}
            tags={localTags}
            onChange={(tags) => {
              setLocalTags(tags);
              onTagsChanged?.(conv.id, tags);
            }}
          />
        </div>
        <button
          onClick={handleExport}
          title="Export as Markdown"
          className="shrink-0 flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} model={conv.model} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
