const COLORS: Record<string, string> = {
  claude: "bg-amber-700/20 text-amber-300 border-amber-600/30",
  chatgpt: "bg-green-700/20 text-green-300 border-green-600/30",
  gemini: "bg-blue-700/20 text-blue-300 border-blue-600/30",
  perplexity: "bg-violet-700/20 text-violet-300 border-violet-600/30",
  other: "bg-gray-700/20 text-gray-300 border-gray-600/30",
};

const LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

interface Props {
  provider: string;
  size?: "sm" | "xs";
}

export function ProviderBadge({ provider, size = "sm" }: Props) {
  const cls = COLORS[provider] ?? COLORS["other"]!;
  const label = LABEL[provider] ?? provider;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded border font-medium ${pad} ${cls}`}>
      {label}
    </span>
  );
}
