import { useState, useRef } from "react";
import { setTags } from "../lib/api.js";

interface Props {
  conversationId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ conversationId, tags, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function save(newTags: string[]) {
    setSaving(true);
    try {
      await setTags(conversationId, newTags);
      onChange(newTags);
    } catch {
      // silent — tags state stays unchanged
    } finally {
      setSaving(false);
    }
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag)) return;
    const next = [...tags, tag];
    setInputValue("");
    void save(next);
  }

  function removeTag(tag: string) {
    void save(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] text-slate-300"
        >
          #{tag}
          <button
            onClick={() => removeTag(tag)}
            className="text-slate-500 hover:text-slate-200 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(inputValue);
            }
          }}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
          placeholder="+ add tag"
          disabled={saving}
          className="w-20 rounded bg-transparent px-1 py-0.5 text-[11px] text-slate-400 placeholder-slate-600 outline-none focus:text-slate-200 focus:placeholder-slate-500"
        />
      </div>
    </div>
  );
}
