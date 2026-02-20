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

      const res = await fetch("/api/extract", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Upload mislukt.");
        return;
      }

      // ✅ payload + scope opslaan
      sessionStorage.setItem("quiz_payload", JSON.stringify(data.extracted));
      sessionStorage.setItem("quiz_scope", scope);
      setHasPayload(true);

      // 🔥 forceer reset van quiz
      window.location.href = "/quiz?reset=" + Date.now();
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  function continueWithExisting() {
    // Scope ook toepassen bij verdergaan
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

      {/* ✅ Scope altijd zichtbaar */}
      <div className="mb-6 border p-4 rounded-lg">
        <p className="font-medium mb-2">Hoeveel wil je oefenen?</p>

        <label className="block">
          <input
            type="radio"
            name="scope"
            value="0.3"
            checked={scope === "0.3"}
            onChange={() => persistScope("0.3")}
          />{" "}
          30% (kort oefenen)
        </label>

        <label className="block">
          <input
            type="radio"
            name="scope"
            value="0.7"
            checked={scope === "0.7"}
            onChange={() => persistScope("0.7")}
          />{" "}
          70% (goed oefenen)
        </label>

        <label className="block">
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
          <p className="text-lg">Wat wil je doen?</p>

          <button
            className="w-full bg-blue-600 text-white px-4 py-3 rounded"
            onClick={continueWithExisting}
          >
            🔁 Ga verder met dezelfde woorden
          </button>

          <button
            className="w-full border px-4 py-3 rounded"
            onClick={clearPayload}
          >
            📸 Nieuwe foto uploaden
          </button>
        </div>
      ) : (
        <form onSubmit={uploadNewPhoto} className="border p-6 rounded-lg space-y-4">
          <p>Upload een foto van een woordenlijst uit je schoolboek.</p>

         <input
  type="file"
  accept="image/*"
  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
/>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded"
          >
            {loading ? "Bezig..." : "Start oefenen"}
          </button>

          {error && <p className="text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
