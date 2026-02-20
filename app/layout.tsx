import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Woordjes Trainer",
    template: "%s · Woordjes Trainer",
  },
  description: "Oefen woordjes met foto's uit je schoolboek",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
