import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGeminiTakeout } from "./gemini.js";

// ── Shape A: full conversation transcript ────────────────────────────────────

test("parseGeminiTakeout parses Shape A (full transcripts)", () => {
  const json = JSON.stringify({
    conversations: [
      {
        id: "gemini-conv-1",
        title: "My chat",
        createTime: "2024-06-01T00:00:00Z",
        turns: [
          { role: "user", text: "what is 2+2?" },
          { role: "model", text: "It is 4." },
        ],
      },
    ],
  });
  const turns = [...parseGeminiTakeout(json)];
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, "user");
  assert.equal(turns[0]!.content, "what is 2+2?");
  assert.equal(turns[1]!.role, "assistant");
  assert.equal(turns[1]!.content, "It is 4.");
});

test("parseGeminiTakeout Shape A sets provider=gemini source=import", () => {
  const json = JSON.stringify({
    conversations: [
      {
        id: "c1",
        turns: [{ role: "user", text: "hello" }],
      },
    ],
  });
  const [t] = [...parseGeminiTakeout(json)];
  assert.equal(t!.provider, "gemini");
  assert.equal(t!.source, "import");
});

test("parseGeminiTakeout Shape A uses 'messages' key as well as 'turns'", () => {
  const json = JSON.stringify({
    conversations: [
      {
        id: "c1",
        messages: [{ role: "user", text: "hi" }, { role: "model", text: "hello" }],
      },
    ],
  });
  const turns = [...parseGeminiTakeout(json)];
  assert.equal(turns.length, 2);
});

// ── Shape B: activity log ────────────────────────────────────────────────────

test("parseGeminiTakeout parses Shape B (activity log array)", () => {
  const json = JSON.stringify([
    {
      title: "Search",
      time: "2024-06-01T00:00:00Z",
      activitySegments: [
        { textContentSegment: { contentValue: "explain quantum computing" } },
      ],
    },
    {
      title: "Search 2",
      time: "2024-06-01T00:01:00Z",
      snippet: "what is the weather?",
    },
  ]);
  const turns = [...parseGeminiTakeout(json)];
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, "user");
  assert.equal(turns[0]!.content, "explain quantum computing");
  assert.equal(turns[1]!.content, "what is the weather?");
});

test("parseGeminiTakeout Shape B skips entries with no text", () => {
  const json = JSON.stringify([
    { title: "Empty", time: "2024-06-01T00:00:00Z" },
    { title: "Has text", time: "2024-06-01T00:01:00Z", snippet: "real query" },
  ]);
  const turns = [...parseGeminiTakeout(json)];
  assert.equal(turns.length, 1);
  assert.equal(turns[0]!.content, "real query");
});

test("parseGeminiTakeout Shape A ignores unknown roles", () => {
  const json = JSON.stringify({
    conversations: [
      {
        id: "c1",
        turns: [
          { role: "system", text: "be helpful" },
          { role: "user", text: "hi" },
        ],
      },
    ],
  });
  const turns = [...parseGeminiTakeout(json)];
  assert.equal(turns.length, 1);
  assert.equal(turns[0]!.role, "user");
});

test("parseGeminiTakeout throws on completely unknown format", () => {
  assert.throws(
    () => [...parseGeminiTakeout(JSON.stringify({ completely: "unknown" }))],
    /Unrecognised Gemini Takeout format/,
  );
});
