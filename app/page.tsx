"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [hasPayload, setHasPayload] = useState(false);
  const [scope, setScope] = useState<"0.3" | "0.7" | "1">("0.3");

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check opgeslagen payload + scope
  useEffect(() => {
    const existing = sessionStorage.getItem("quiz_payload");
    if (existing) setHasPayload(true);

    const savedScope = sessionStorage.getItem("quiz_scope");
    if (savedScope === "0.3" || savedScope === "0.7" || savedScope === "1") {
      setScope(savedScope);
    }
  }, []);

  function persistScope(nextScope: "0.3" | "0.7" | "1") {
    setScope(nextScope);
    sessionStorage.setItem("quiz_scope", nextScope);
  }

  async function uploadNewPhoto(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Kies eerst een foto.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("image", file);

      // Let op: zorg dat de URL overeenkomt met je route (/api/extract of /api/vision)
      const res = await fetch("/api/extract", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      // --- DIT IS HET NIEUWE DEEL VOOR DE BEVEILIGING ---
      if (!res.ok) {
        // Hier vangen we de 429 (Rate Limit) of 500 (API Error) op
        setError(data?.message || "Er ging iets mis bij het verwerken.");
        setLoading(false);
        return;
      }
      // ------------------------------------------------

      // ✅ payload + scope opslaan
      sessionStorage.setItem("quiz_payload", JSON.stringify(data.extracted));
      sessionStorage.setItem("quiz_scope", scope);
      setHasPayload(true);

      // 🔥 forceer reset van quiz
      window.location.href = "/quiz?reset=" + Date.now();
    } catch (err) {
      setError("Netwerkfout. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  function continueWithExisting() {
    sessionStorage.setItem("quiz_scope", scope);
    window.location.href = "/quiz?reset=" + Date.now();
  }

  function clearPayload() {
    sessionStorage.removeItem("quiz_payload");
    setHasPayload(false);
    setFile(null);
    setError(null);
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-4">Woordjes Trainer 📘</h1>

      <div className="mb-6 border p-4 rounded-lg">
        <p className="font-medium mb-2">Hoeveel wil je oefenen?</p>

        <label className="block cursor-pointer">
          <input
            type="radio"
            name="scope"
            value="0.3"
            checked={scope === "0.3"}
            onChange={() => persistScope("0.3")}
          />{" "}
          30% (kort oefenen)
        </label>

        <label className="block cursor-pointer">
          <input
            type="radio"
            name="scope"
            value="0.7"
            checked={scope === "0.7"}
            onChange={() => persistScope("0.7")}
          />{" "}
          70% (goed oefenen)
        </label>

        <label className="block cursor-pointer">
          <input
            type="radio"
            name="scope"
            value="1"
            checked={scope === "1"}
            onChange={() => persistScope("1")}
          />{" "}
          100% (alles)
        </label>
      </div>

      {hasPayload ? (
        <div className="space-y-4">

{/* --- NIEUW: Overzicht van de woorden --- */}
    <div className="bg-gray-50 border rounded-lg p-4 mb-4">
      <h2 className="font-bold text-lg mb-2">Gescande woorden 📋</h2>
      
      {/* We halen de data even uit de storage voor de weergave */}
      {(() => {
        const data = JSON.parse(sessionStorage.getItem("quiz_payload") || "{}");
        const items = data.items || [];
        const count = items.length;

        return (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Er zijn <strong>{count}</strong> woordparen gevonden.
            </p>
            <div className="max-h-40 overflow-y-auto border-t pt-2 space-y-1">
              {items.map((item: any, index: number) => (
                <div key={index} className="text-sm flex justify-between border-b border-gray-100 py-1">
                  <span className="font-medium text-blue-700">{item.a}</span>
                  <span className="text-gray-500">{Array.isArray(item.b) ? item.b.join(", ") : item.b}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
    {/* --- EINDE NIEUW --- */}

          <p className="text-lg">Wat wil je doen?</p>

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded transition-colors"
            onClick={continueWithExisting}
          >
            🔁 Start oefenen met deze {JSON.parse(sessionStorage.getItem("quiz_payload") || "{}").items?.length} woorden
    </button>

          <button
            className="w-full border border-gray-300 hover:bg-gray-50 px-4 py-3 rounded transition-colors"
            onClick={clearPayload}
          >
            📸 Andere foto uploaden
          </button>
        </div>
      ) : (
        <form onSubmit={uploadNewPhoto} className="border p-6 rounded-lg space-y-4">
          <p className="text-gray-600">Upload een foto van een woordenlijst uit je schoolboek.</p>

          <input
            type="file"
            accept="image/*"
            className="w-full"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 disabled:opacity-50 text-white px-4 py-3 rounded font-bold transition-opacity"
          >
            {loading ? "Bezig met analyseren..." : "Start oefenen"}
          </button>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </form>
      )}
    </main>
  );
}