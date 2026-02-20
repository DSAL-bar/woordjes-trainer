"use client";

import { useEffect, useMemo, useState } from "react";

/* =======================
   Types
======================= */

type LangCode = string;

type Extracted = {
  languages: { a: LangCode; b: LangCode };
  items: { a: string; b: string[] }[];
};

type Direction = "A_TO_B" | "B_TO_A";
type Mode = "MC" | "TYPE";

/* =======================
   Helpers
======================= */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeBase(text: string) {
  return stripDiacritics(text)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeGermanExtras(text: string) {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function phoneticNormalize(text: string, lang?: LangCode) {
  let t = normalizeBase(text);

  if (lang === "de") {
    t = normalizeGermanExtras(t);
  }

  t = t.replace(/[-\s]/g, "");
  t = t
    .replace(/ij|ei/g, "y")
    .replace(/ou|au/g, "w")
    .replace(/ph/g, "f")
    .replace(/v/g, "f")
    .replace(/z/g, "s")
    .replace(/c/g, "k")
    .replace(/ch/g, "g");

  t = t.replace(/(.)\1+/g, "$1");
  t = t.replace(/dt$/g, "t");

  return t;
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function revealLetters(word: string, percentage: number) {
  const count = Math.max(1, Math.floor(word.length * percentage));
  return word.slice(0, count) + "_".repeat(word.length - count);
}

/* =======================
   Component
======================= */

export default function QuizPage() {
  const [payload, setPayload] = useState<Extracted | null>(null);
  const [bank, setBank] = useState<Extracted["items"]>([]);
  const [questions, setQuestions] = useState<
    { item: Extracted["items"][0]; direction: Direction; mode: Mode }[]
  >([]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [hintLevel, setHintLevel] = useState(0);

useEffect(() => {
    if (payload) {
      document.title = `${payload.languages.a.toUpperCase()} → ${payload.languages.b.toUpperCase()} · Woordjes Trainer`;
    }
  }, [payload]);

  /* =======================
     INIT / RESET BIJ NIEUWE FOTO
  ======================= */

  useEffect(() => {
    const raw = sessionStorage.getItem("quiz_payload");
    if (!raw) {
      setPayload(null);
      return;
    }

    try {
      const parsed: Extracted = JSON.parse(raw);
      setPayload(parsed);

      const shuffled = shuffle(parsed.items);
      setBank(shuffled);

      const serie1 = shuffle([
        ...shuffled.slice(0, 5).map((it) => ({
          item: it,
          direction: "A_TO_B" as Direction,
          mode: "MC" as Mode,
        })),
        ...shuffled.slice(5, 10).map((it) => ({
          item: it,
          direction: "B_TO_A" as Direction,
          mode: "MC" as Mode,
        })),
      ]);

      const serie2 = shuffle([
        ...shuffled.slice(10, 13).map((it) => ({
          item: it,
          direction: "A_TO_B" as Direction,
          mode: "TYPE" as Mode,
        })),
        ...shuffled.slice(13, 16).map((it) => ({
          item: it,
          direction: "B_TO_A" as Direction,
          mode: "TYPE" as Mode,
        })),
      ]);

      setQuestions([...serie1, ...serie2]);
      setIndex(0);
      setScore(0);
      setFeedback(null);
      setAnswer("");
      setHintLevel(0);
    } catch {
      setPayload(null);
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  if (!payload || questions.length === 0) {
    return (
      <main className="p-8">
        <p>Geen quizdata gevonden. Ga terug en upload een foto.</p>
      </main>
    );
  }

if (index >= questions.length) {
  return (
    <main className="p-8 max-w-md text-center space-y-4">
      <h1 className="text-3xl font-bold">Klaar 🎉</h1>

      <p>
        Score: <strong>{score}</strong> / {questions.length}
      </p>

      <p className="text-gray-600">
        Goed gedaan! Je hebt alle vragen afgerond.
      </p>

      <button
        className="bg-blue-600 text-white px-6 py-3 rounded"
        onClick={() => {
          window.location.href = "/";
        }}
      >
        🔁 Start opnieuw
      </button>
    </main>
  );
}


  const { item, direction, mode } = questions[index];

  const questionText = direction === "A_TO_B" ? item.a : item.b[0];
  const correctAnswers = direction === "A_TO_B" ? item.b : [item.a];
  const bookAnswer = correctAnswers[0];

  const answerLang = direction === "A_TO_B" ? payload.languages.b : payload.languages.a;

  const options =
    mode === "MC"
      ? shuffle([
          bookAnswer,
          ...shuffle(
            bank.filter((x) => x !== item).map((x) =>
              direction === "A_TO_B" ? x.b[0] : x.a
            )
          ).slice(0, 3),
        ])
      : [];

  function acceptable(userAnswer: string) {
    const user = normalizeBase(userAnswer);

    for (const c of correctAnswers) {
      const c0 = normalizeBase(c);

      if (user === c0) return { ok: true, reason: "exact" as const };

      const d = levenshtein(user, c0);
      if (d <= Math.max(1, Math.round(c0.length * 0.25)))
        return { ok: true, reason: "almost" as const };

      const pu = phoneticNormalize(user, answerLang);
      const pc = phoneticNormalize(c0, answerLang);
      const pd = levenshtein(pu, pc);
      if (pd <= Math.max(1, Math.round(pc.length * 0.3)))
        return { ok: true, reason: "almost" as const };
    }
    return { ok: false as const };
  }

  function chooseMC(opt: string) {
    if (normalizeBase(opt) === normalizeBase(bookAnswer)) {
      setScore((s) => s + 1);
      setFeedback("✅ Goed!");
    } else {
      setFeedback(`❌ Fout. Goed antwoord: ${bookAnswer}`);
    }
  }

  function checkType() {
    const verdict = acceptable(answer);

    if (verdict.ok) {
      setScore((s) => s + 1);
      if (verdict.reason === "exact") {
        setFeedback("✅ Goed!");
      } else {
        setFeedback(
          `🟠 Bijna goed!\nJe antwoord: "${answer}"\nBoek-antwoord: "${bookAnswer}"`
        );
      }
    } else {
      setFeedback(`❌ Fout. Goed antwoord: ${bookAnswer}`);
    }
  }

  function next() {
    setAnswer("");
    setFeedback(null);
    setHintLevel(0);
    setIndex((i) => i + 1);
  }

  function renderHint() {
    if (mode !== "TYPE" || hintLevel === 0) return null;

    if (hintLevel === 1) {
      return (
        <p className="text-sm text-gray-600 mt-2">
          Hint: begint met <strong>{bookAnswer[0]}</strong> ({bookAnswer.length} letters)
        </p>
      );
    }
    if (hintLevel === 2) {
      return (
        <p className="text-sm text-gray-600 mt-2 font-mono">
          {revealLetters(bookAnswer, 0.3)}
        </p>
      );
    }
    return (
      <p className="text-sm text-gray-600 mt-2 font-mono">
        {revealLetters(bookAnswer, 0.8)}
      </p>
    );
  }

  return (
    <main className="p-8 max-w-md">
      <h1 className="text-2xl font-bold mb-2">
        {mode === "MC" ? "Serie 1 – Meerkeuze" : "Serie 2 – Typen"}
      </h1>

      <p className="text-sm text-gray-600 mb-4">
        Vraag {index + 1} van {questions.length}
      </p>

      <div className="mb-4">
        <strong className="text-lg">{questionText}</strong>
        {renderHint()}
      </div>

      {mode === "MC" && !feedback && (
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => chooseMC(opt)}
              className="w-full border rounded p-2 text-left hover:bg-gray-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {mode === "TYPE" && !feedback && (
        <>
          <input
            className="border p-2 w-full mb-3"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Typ je antwoord"
          />
          <div className="flex gap-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={checkType}>
              Check
            </button>
            <button
              className="border px-4 py-2 rounded"
              onClick={() => setHintLevel((h) => Math.min(h + 1, 3))}
            >
              Hint 💡
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div className="mt-4 whitespace-pre-line">
          <p className="mb-2">{feedback}</p>
          <button className="underline text-blue-600" onClick={next}>
            Volgende →
          </button>
        </div>
      )}
    </main>
  );
}
