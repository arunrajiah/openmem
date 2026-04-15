import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "@openmem/shared";
import {
  listConversations,
  searchMessages,
  getConversation,
  listTags,
  type ConversationDetail,
  type SearchResult,
  type TagCount,
} from "./lib/api.js";
import { SearchBar } from "./components/SearchBar.js";
import { FilterBar } from "./components/FilterBar.js";
import { ConversationList, SearchResultList } from "./components/ConversationList.js";
import { ConversationViewer } from "./components/ConversationViewer.js";
import { SettingsPanel } from "./components/SettingsPanel.js";

export default function App() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Browse mode
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);

  // Search mode
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // Tags
  const [allTags, setAllTags] = useState<TagCount[]>([]);

  // Detail pane
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mobile: show detail pane over list
  const [showDetail, setShowDetail] = useState(false);

  const isSearching = query.trim().length > 0;

  // Load tag list
  useEffect(() => {
    listTags().then((r) => setAllTags(r.tags)).catch(() => undefined);
  }, [detail]); // refresh after detail changes (tags may have been edited)

  // Load conversations list (browse mode)
  useEffect(() => {
    if (isSearching) return;
    setConvLoading(true);
    listConversations({
      provider: provider || undefined,
      tag: activeTag || undefined,
      limit: 100,
    })
      .then((r) => setConversations(r.conversations))
      .catch(console.error)
      .finally(() => setConvLoading(false));
  }, [provider, activeTag, isSearching]);

  // Run search (search mode)
  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    setSearchLoading(true);
    searchMessages({ q: query, provider: provider || undefined, limit: 50 })
      .then((r) => { setSearchResults(r.results); setSearchTotal(r.total); })
      .catch(console.error)
      .finally(() => setSearchLoading(false));
  }, [query, provider, isSearching]);

  // Load conversation detail
  const selectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setShowDetail(true);
    setDetailLoading(true);
    getConversation(id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, []);

  // Update tags in local conversation list after editing
  const handleTagsChanged = useCallback(
    (conversationId: string, tags: string[]) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, tags } : c)),
      );
    },
    [],
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Settings modal */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col w-full md:w-80 lg:w-96 shrink-0 border-r border-slate-800 ${
          showDetail ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Branding + search */}
        <div className="px-4 pt-4 pb-3 space-y-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-slate-100">OpenMem</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">
              local
            </span>
          </div>
          <SearchBar value={query} onChange={setQuery} autoFocus />
          <FilterBar provider={provider} onProvider={(p) => { setProvider(p); setActiveTag(""); }} />

          {/* Tag filter row (shown only when tags exist) */}
          {allTags.length > 0 && !isSearching && (
            <div className="flex gap-1.5 flex-wrap">
              {allTags.slice(0, 8).map(({ tag }) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                    activeTag === tag
                      ? "bg-slate-500 text-slate-100"
                      : "bg-slate-800/70 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <SearchResultList
              results={searchResults}
              selected={selectedId}
              onSelect={selectConversation}
              total={searchTotal}
              query={query}
              loading={searchLoading}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              selected={selectedId}
              onSelect={selectConversation}
              loading={convLoading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">~/.openmem/openmem.db</span>
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Open settings"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <main
        className={`flex flex-1 flex-col min-w-0 ${
          showDetail ? "flex" : "hidden md:flex"
        }`}
      >
        <ConversationViewer
          detail={detail}
          loading={detailLoading}
          onClose={() => setShowDetail(false)}
          onTagsChanged={handleTagsChanged}
        />
      </main>
    </div>
  );
}
