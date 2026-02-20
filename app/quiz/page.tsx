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
type Mode = "MC" | "MATCH" | "TYPE";

type Item = Extracted["items"][0];

type Question =
  | { mode: "MC" | "TYPE"; item: Item; direction: Direction }
  | { mode: "MATCH"; items: Item[] };

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
  return text.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function phoneticNormalize(text: string, lang?: LangCode) {
  let t = normalizeBase(text);
  if (lang === "de") t = normalizeGermanExtras(t);

  t = t
    .replace(/[-\s]/g, "")
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
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function revealLetters(word: string, pct: number) {
  const count = Math.max(1, Math.floor(word.length * pct));
  return word.slice(0, count) + "_".repeat(word.length - count);
}

/* =======================
   Component
======================= */

export default function QuizPage() {
  /* ---------- STATE ---------- */
  const [payload, setPayload] = useState<Extracted | null>(null);
  const [bank, setBank] = useState<Item[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);

  const [feedback, setFeedback] = useState<string | null>(null);

  // TYPE
  const [answer, setAnswer] = useState("");
  const [hintLevel, setHintLevel] = useState(0);

  // MATCH
  const [leftPick, setLeftPick] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});

  /* ---------- DERIVED (hooks altijd bovenaan) ---------- */
  const q: Question | undefined = questions[index];

  const matchRight = useMemo(() => {
    if (!q || q.mode !== "MATCH") return [];
    return shuffle(q.items.map((it) => it.b[0]));
  }, [index, q]);

  const progress = questions.length > 0 ? Math.round(((Math.min(index, questions.length - 1) + 1) / questions.length) * 100) : 0;

  /* ---------- INIT ---------- */
  useEffect(() => {
    const raw = sessionStorage.getItem("quiz_payload");
    if (!raw) {
      setPayload(null);
      setQuestions([]);
      return;
    }

    const scopeRaw = sessionStorage.getItem("quiz_scope");
    const scope = scopeRaw === "0.3" ? 0.3 : scopeRaw === "0.7" ? 0.7 : 1;

    try {
      const parsed: Extracted = JSON.parse(raw);
      setPayload(parsed);

      document.title = `${parsed.languages.a.toUpperCase()} → ${parsed.languages.b.toUpperCase()} · Woordjes Trainer`;

      const shuffled = shuffle(parsed.items);
      const scopedCount = Math.max(1, Math.round(shuffled.length * scope));
      const scoped = shuffled.slice(0, scopedCount);
      setBank(scoped);

      // 35 / 35 / 30
      const mcCount = Math.round(scoped.length * 0.35);
      const matchCount = Math.round(scoped.length * 0.35);

      const mcItems = scoped.slice(0, mcCount);
      const matchItems = scoped.slice(mcCount, mcCount + matchCount);
      const typeItems = scoped.slice(mcCount + matchCount);

      const mcQ: Question[] = mcItems.map((it, i) => ({
        mode: "MC",
        item: it,
        direction: i % 2 === 0 ? "A_TO_B" : "B_TO_A",
      }));

      const matchQ: Question[] = [];
      for (let i = 0; i < matchItems.length; i += 3) {
        const g = matchItems.slice(i, i + 3);
        if (g.length === 3) matchQ.push({ mode: "MATCH", items: g });
      }

      const typeQ: Question[] = typeItems.map((it, i) => ({
        mode: "TYPE",
        item: it,
        direction: i % 2 === 0 ? "A_TO_B" : "B_TO_A",
      }));

      setQuestions([...shuffle(mcQ), ...matchQ, ...shuffle(typeQ)]);

      // reset
      setIndex(0);
      setScore(0);
      setFeedback(null);
      setAnswer("");
      setHintLevel(0);
      setLeftPick(null);
      setMatches({});
    } catch {
      setPayload(null);
      setQuestions([]);
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  /* ---------- EARLY RETURNS (na hooks) ---------- */
  if (!payload || questions.length === 0) {
    return (
      <main className="p-8">
        <p>Geen quizdata gevonden. Ga terug en upload een foto.</p>
      </main>
    );
  }

  // ✅ BELANGRIJK: einde-check vóórdat we q gaan gebruiken
  if (index >= questions.length) {
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <main className="p-8 max-w-md text-center space-y-6">
        <div className="text-6xl">
          {percentage >= 80 ? "🏆" : percentage >= 60 ? "⭐" : "👍"}
        </div>

        <h1 className="text-3xl font-bold">Goed gedaan!</h1>

        <p className="text-lg">
          Je score: <strong>{score}</strong> / {questions.length}
        </p>

        <p className="text-gray-600">
          {percentage >= 80
            ? "Fantastisch! Je hebt deze woorden echt goed geoefend."
            : percentage >= 60
              ? "Goed bezig! Nog een keer oefenen maakt je nóg beter."
              : "Prima start! Oefenen helpt je verder."}
        </p>

        <div className="space-y-3">
          <button
            className="w-full bg-blue-600 text-white px-6 py-3 rounded"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            🔁 Ga naar begin
          </button>

          <button
            className="w-full border px-6 py-3 rounded"
            onClick={() => {
              window.location.href = "/quiz?reset=" + Date.now();
            }}
          >
            🔄 Opnieuw oefenen met deze woorden
          </button>
        </div>
      </main>
    );
  }

  // vanaf hier is q wél nodig; hij hoort nu altijd te bestaan
  if (!q) {
    return (
      <main className="p-8">
        <p>Even laden…</p>
      </main>
    );
  }

  function next() {
    setFeedback(null);
    setAnswer("");
    setHintLevel(0);
    setLeftPick(null);
    setMatches({});
    setIndex((i) => i + 1);
  }

  /* ============== UI snippet: progress header ============== */
  const ProgressHeader = () => (
    <div className="mb-4">
      <div className="h-2 w-full bg-gray-200 rounded">
        <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-gray-600 mt-1 text-right">
        {Math.min(index + 1, questions.length)} / {questions.length}
      </p>
    </div>
  );

  /* =======================
     MATCH
  ======================= */
  if (q.mode === "MATCH") {
    const pairedCount = Object.keys(matches).length;

    return (
      <main className="p-8 max-w-md">
        <ProgressHeader />

        <h1 className="text-2xl font-bold mb-2">Serie 2 – Zoek de koppels</h1>
        <p className="text-sm text-gray-600 mb-4">
          Klik eerst links op <strong>A/B/C</strong> en klik daarna rechts op <strong>1/2/3</strong>.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-medium mb-2">Links</p>

            {q.items.map((it, i) => {
              const label = String.fromCharCode(65 + i);
              const isSelected = leftPick === i;
              const hasMatch = matches[i] !== undefined;

              return (
                <button
                  key={i}
                  className={[
                    "block w-full border rounded p-2 mb-2 text-left",
                    isSelected ? "bg-blue-100 border-blue-500" : "hover:bg-gray-50",
                    hasMatch ? "opacity-90" : "",
                  ].join(" ")}
                  onClick={() => setLeftPick(i)}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>{label}.</strong> {it.a}
                    </span>
                    {hasMatch && <span className="text-sm text-gray-600">→ {matches[i] + 1}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <p className="font-medium mb-2">Rechts</p>

            {matchRight.map((val, rIdx) => (
              <button
                key={rIdx}
                className="block w-full border rounded p-2 mb-2 text-left hover:bg-gray-50"
                onClick={() => {
                  if (leftPick === null) return;
                  setMatches((prev) => ({ ...prev, [leftPick]: rIdx }));
                  setLeftPick(null);
                }}
              >
                <strong>{rIdx + 1}.</strong> {val}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-700 border rounded p-3">
          <p className="font-medium mb-2">Jouw koppels</p>
          {pairedCount === 0 ? (
            <p className="text-gray-600">Nog geen koppels gemaakt.</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(matches)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([leftIdx, rightIdx]) => (
                  <p key={leftIdx}>
                    {String.fromCharCode(65 + Number(leftIdx))} → {Number(rightIdx) + 1}
                  </p>
                ))}
            </div>
          )}
        </div>

        <button
          className={[
            "mt-4 w-full px-4 py-3 rounded",
            pairedCount === 3 ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600",
          ].join(" ")}
          disabled={pairedCount !== 3}
          onClick={() => {
            // (later: echte correct-check per koppel)
            setScore((s) => s + 1);
            setFeedback("✅ Goed gekoppeld!");
          }}
        >
          Check koppels ({pairedCount}/3)
        </button>

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

  /* =======================
     MC / TYPE
  ======================= */
  const item = q.item;
  const dir = q.direction;

  const questionText = dir === "A_TO_B" ? item.a : item.b[0];
  const correctAnswers = dir === "A_TO_B" ? item.b : [item.a];
  const bookAnswer = correctAnswers[0];
  const answerLang = dir === "A_TO_B" ? payload.languages.b : payload.languages.a;

  const options =
    q.mode === "MC"
      ? shuffle([
          bookAnswer,
          ...shuffle(
            bank
              .filter((x) => x !== item)
              .map((x) => (dir === "A_TO_B" ? x.b[0] : x.a))
          ).slice(0, 3),
        ])
      : [];

  function acceptable(userAnswer: string) {
    const user = normalizeBase(userAnswer);

    for (const c of correctAnswers) {
      const c0 = normalizeBase(c);

      if (user === c0) return { ok: true, reason: "exact" as const };

      const d = levenshtein(user, c0);
      if (d <= Math.max(1, Math.round(c0.length * 0.25))) return { ok: true, reason: "almost" as const };

      const pu = phoneticNormalize(user, answerLang);
      const pc = phoneticNormalize(c0, answerLang);
      const pd = levenshtein(pu, pc);
      if (pd <= Math.max(1, Math.round(pc.length * 0.3))) return { ok: true, reason: "almost" as const };
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
        setFeedback(`✅ Goed!\nBoek-antwoord: "${bookAnswer}"`);
      } else {
        setFeedback(`🟠 Bijna goed!\nJe antwoord: "${answer}"\nBoek-antwoord: "${bookAnswer}"`);
      }
    } else {
      setFeedback(`❌ Fout. Goed antwoord: ${bookAnswer}`);
    }
  }

function renderHint(mode: Mode, book: string) {
  if (mode !== "TYPE" || hintLevel === 0) return null;

  if (hintLevel === 1) {
    return (
      <p className="text-sm text-gray-600 mt-2">
        Hint: begint met <strong>{book[0]}</strong> ({book.length} letters)
      </p>
    );
  }
  if (hintLevel === 2) {
    return (
      <p className="text-sm text-gray-600 mt-2 font-mono">
        {revealLetters(book, 0.3)}
      </p>
    );
  }
  return (
    <p className="text-sm text-gray-600 mt-2 font-mono">
      {revealLetters(book, 0.8)}
    </p>
  );
}
  return (
    <main className="p-8 max-w-md">
      <ProgressHeader />

      <h1 className="text-2xl font-bold mb-2">
        {q.mode === "MC" ? "Serie 1 – Meerkeuze" : "Serie 3 – Open vragen"}
      </h1>

      <div className="mb-4">
        <strong className="text-lg">{questionText}</strong>
        {renderHint(q.mode, bookAnswer)}
      </div>

      {q.mode === "MC" && !feedback && (
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

      {q.mode === "TYPE" && !feedback && (
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
            <button className="border px-4 py-2 rounded" onClick={() => setHintLevel((h) => Math.min(h + 1, 3))}>
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
