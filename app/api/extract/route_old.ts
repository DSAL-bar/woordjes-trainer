import OpenAI from "openai";
import { NextResponse } from "next/server";

console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY?.length);
console.log(
  "OPENAI_API_KEY starts with sk-:",
  process.env.OPENAI_API_KEY?.startsWith("sk-")
);


export const runtime = "nodejs"; // nodig voor Buffer

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function makePrompt() {
  return `
Je bent een woordenlijst-extractor voor schoolboeken.

Stap 1: bepaal welke TWEE talen op de foto staan.
Gebruik ISO codes: nl, en, de, fr, es.
Voorbeeld: nl + de.

Stap 2: haal woordparen uit de foto.

Geef je antwoord als EXACT JSON, zonder extra tekst.

JSON schema:
{
  "languages": { "a": "nl", "b": "de" },
  "items": [
    { "a": "woord in taal a", "b": ["vertaling 1", "vertaling 2"] }
  ]
}

Regels:
- "a" en "b" zijn de twee talen op de pagina.
- "b" mag meerdere synoniemen bevatten.
- Als iets onleesbaar is: sla het item over.
`;
}


export async function GET() {
  return NextResponse.json({ status: "ok", message: "GET werkt" });
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { status: "error", message: "OPENAI_API_KEY ontbreekt. Zet deze in .env.local en herstart npm run dev." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { status: "error", message: "Geen bestand ontvangen onder veldnaam 'image'." },
        { status: 400 }
      );
    }

    // File -> base64 data URL
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${base64}`;

    // Vision request (Responses API)
   const response = await client.responses.create({
  model: "gpt-4.1-mini",
  //response_format: { type: "json_object" }, // 🔑 DIT IS DE FIX
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: makePrompt() },
        {
          type: "input_image",
          image_url: dataUrl,
          detail: "low",
        } as any,
      ],
    },
  ],
});

//const text =
//  response.output_text ??
//  response.output?.[0]?.content?.[0]?.text;

const text = 
  (response as any).output_text ?? 
  (response as any).output?.[0]?.content?.[0]?.text ?? 
  "";

if (!text) {
  return NextResponse.json(
    { status: "error", message: "Geen tekst ontvangen van Vision model." },
    { status: 502 }
  );
}

    // Probeer JSON te parsen (als model toch iets extra’s teruggeeft, failen we netjes)
let parsed;
try {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Geen JSON-object gevonden in model-output.");
  }

  const jsonString = text.slice(jsonStart, jsonEnd + 1);
  parsed = JSON.parse(jsonString);
} catch (e) {
  return NextResponse.json(
    {
      status: "error",
      message: "Kon JSON niet extraheren uit model-output.",
      raw: text,
    },
    { status: 502 }
  );
}

    return NextResponse.json({
      status: "ok",
      extracted: parsed,
    });
} catch (err: any) {
  console.error("VISION ERROR:", err);

  return NextResponse.json(
    {
      status: "error",
      message: "Server error bij Vision extractie.",
      detail: String(err?.message ?? err),
    },
    { status: 500 }
  );
}
}
