const PROVIDERS = [
  { id: "", label: "All" },
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "gemini", label: "Gemini" },
  { id: "perplexity", label: "Perplexity" },
];

interface Props {
  provider: string;
  onProvider: (p: string) => void;
}

export function FilterBar({ provider, onProvider }: Props) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => onProvider(p.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            provider === p.id
              ? "bg-amber-500 text-slate-900"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
