import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spielberechtigungsprüfer – HMM",
  description:
    "Prüft die Spielberechtigung für die Hamburger Mannschaftsmeisterschaft gemäß §13–§16 der Turnierordnung des Hamburger Schachverbandes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="bg-hsv-green text-white shadow-md">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              ♟
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Spielberechtigungsprüfer
              </h1>
              <p className="text-xs text-green-200 leading-tight">
                Hamburger Mannschaftsmeisterschaft
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-2xl mx-auto px-4 py-4 text-xs text-gray-500 text-center">
            Grundlage: Turnierordnung des Hamburger Schachverbandes e. V., §13–§16 (Stand: Oktober 2025).
            Keine Gewähr für Richtigkeit und Vollständigkeit.
          </div>
        </footer>
      </body>
    </html>
  );
}
