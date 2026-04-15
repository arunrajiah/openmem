import type { Message } from "@openmem/shared";

interface Props {
  message: Message;
  model?: string | null;
}

export function MessageBubble({ message, model }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar dot */}
      <div
        className={`mt-1 h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
          isUser
            ? "bg-slate-600 text-slate-200"
            : "bg-amber-600/20 text-amber-300 border border-amber-600/30"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <span className="text-[11px] text-slate-500">
          {isUser ? "You" : model ?? "Assistant"}
          {"  "}
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-slate-700 text-slate-100 rounded-tr-sm"
              : "bg-slate-800/80 text-slate-200 rounded-tl-sm border border-slate-700/50"
          }`}
        >
          {message.content}
        </div>
        {message.tokensEstimate != null && (
          <span className="text-[10px] text-slate-600">{message.tokensEstimate} tokens</span>
        )}
      </div>
    </div>
  );
}
