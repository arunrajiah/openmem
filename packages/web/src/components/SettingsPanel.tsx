import { useEffect, useState } from "react";
import { getStats, type DbStats } from "../lib/api.js";

interface Props {
  onClose: () => void;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function SettingsPanel({ onClose }: Props) {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 text-sm">
          {/* Database stats */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Database
            </h3>
            {err ? (
              <p className="text-red-400 text-xs">{err}</p>
            ) : stats ? (
              <div className="space-y-2">
                <StatRow label="Conversations" value={stats.conversations.toLocaleString()} />
                <StatRow label="Messages" value={stats.messages.toLocaleString()} />
                <StatRow label="Database size" value={fmtBytes(stats.dbSizeBytes)} />
                <StatRow label="Oldest conversation" value={fmtDate(stats.oldestConversation)} />
                <StatRow label="Newest activity" value={fmtDate(stats.newestConversation)} />
                {Object.keys(stats.byProvider).length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-slate-500 mb-1.5">By provider</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.byProvider).map(([p, n]) => (
                        <span key={p} className="text-xs text-slate-400 bg-slate-800 rounded px-2 py-0.5">
                          {p}: {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-32 rounded bg-slate-700" />
                    <div className="h-3 w-16 rounded bg-slate-700" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Data location */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Data location
            </h3>
            <p className="text-xs text-slate-400 font-mono bg-slate-800 rounded px-3 py-2">
              ~/.openmem/openmem.db
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Override with{" "}
              <code className="text-slate-400">OPENMEM_DATA_DIR</code> env var before starting the companion.
            </p>
          </section>

          {/* Capture settings */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Capture
            </h3>
            <p className="text-xs text-slate-400">
              Provider capture is controlled by the browser extension. After
              installing, click the OpenMem extension icon to configure which
              providers are active.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Companion server runs on{" "}
              <code className="text-slate-400">127.0.0.1:7410</code>.
            </p>
          </section>

          {/* Links */}
          <section className="border-t border-slate-800 pt-4 flex gap-4">
            <a
              href="https://github.com/openmem/openmem"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              GitHub ↗
            </a>
            <a
              href="https://github.com/openmem/openmem/blob/main/docs/quickstart.md"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Quickstart ↗
            </a>
            <span className="ml-auto text-xs text-slate-700">v0.0.0</span>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-medium tabular-nums">{value}</span>
    </div>
  );
}
