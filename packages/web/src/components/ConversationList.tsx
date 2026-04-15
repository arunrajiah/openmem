import type { Conversation } from "@openmem/shared";
import type { SearchResult } from "../lib/api.js";
import { ProviderBadge } from "./ProviderBadge.js";

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Browse mode: conversation list ───────────────────────────────────────────

interface ConvListProps {
  conversations: Conversation[];
  selected: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function ConversationList({ conversations, selected, onSelect, loading }: ConvListProps) {
  if (loading) return <LoadingRows />;
  if (!conversations.length) return (
    <div className="p-6 text-center text-sm text-slate-500">No conversations yet.</div>
  );

  return (
    <ul className="divide-y divide-slate-800">
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c.id)}
            className={`w-full px-4 py-3 text-left hover:bg-slate-800/60 transition-colors ${
              selected === c.id ? "bg-slate-800" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <ProviderBadge provider={c.provider} size="xs" />
              <span className="text-[11px] text-slate-500 shrink-0">{fmtDate(c.updatedAt)}</span>
            </div>
            <p className="text-sm text-slate-200 font-medium truncate">
              {c.title ?? "Untitled conversation"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {c.messageCount} message{c.messageCount !== 1 ? "s" : ""}
              {c.model ? ` · ${c.model}` : ""}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Search mode: result list ──────────────────────────────────────────────────

interface SearchListProps {
  results: SearchResult[];
  selected: string | null;
  onSelect: (conversationId: string) => void;
  total: number;
  query: string;
  loading: boolean;
}

export function SearchResultList({
  results,
  selected,
  onSelect,
  total,
  query,
  loading,
}: SearchListProps) {
  if (loading) return <LoadingRows />;
  if (!results.length) return (
    <div className="p-6 text-center text-sm text-slate-500">
      No results for <span className="text-slate-300">"{query}"</span>
    </div>
  );

  return (
    <>
      <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-800">
        {total} result{total !== 1 ? "s" : ""} for "{query}"
      </div>
      <ul className="divide-y divide-slate-800">
        {results.map((r) => (
          <li key={r.messageId}>
            <button
              onClick={() => onSelect(r.conversationId)}
              className={`w-full px-4 py-3 text-left hover:bg-slate-800/60 transition-colors ${
                selected === r.conversationId ? "bg-slate-800" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <ProviderBadge provider={r.provider} size="xs" />
                <span className="text-[11px] text-slate-500 shrink-0">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-200 font-medium truncate">
                {r.conversationTitle ?? "Untitled conversation"}
              </p>
              {/* Render the FTS5 <mark> snippet */}
              <p
                className="text-xs text-slate-400 mt-1 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-slate-800">
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-4 py-3 animate-pulse space-y-2">
          <div className="h-2.5 w-16 rounded bg-slate-700" />
          <div className="h-3 w-3/4 rounded bg-slate-700" />
          <div className="h-2.5 w-1/2 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  );
}
