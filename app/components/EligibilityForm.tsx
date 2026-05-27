"use client";

import { useState } from "react";
import { CLUBS, DEFAULT_CLUB_KUERZEL } from "@/lib/clubs";
import { SELECTABLE_LIGEN, EligibilityResult } from "@/lib/types";
import VerdictDisplay from "./VerdictDisplay";

type ApiResult = EligibilityResult & { fetchedAt?: string; error?: string };

export default function EligibilityForm() {
  const [ranglistennummer, setRanglistennummer] = useState("");
  const [clubKuerzel, setClubKuerzel] = useState(DEFAULT_CLUB_KUERZEL);
  const [targetLiga, setTargetLiga] = useState(SELECTABLE_LIGEN[0]);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/check-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranglistennummer, clubKuerzel, targetLiga }),
      });
      const data: ApiResult = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Unbekannter Fehler");
      } else {
        setResult(data);
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/ranglisten?refresh=1");
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Fehler beim Aktualisieren");
      } else {
        setError(null);
        // Clear previous result since data changed
        setResult(null);
      }
    } catch {
      setError("Netzwerkfehler beim Aktualisieren.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Ranglistennummer */}
        <div>
          <label
            htmlFor="ranglistennummer"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Ranglistennummer
          </label>
          <input
            id="ranglistennummer"
            type="text"
            inputMode="text"
            value={ranglistennummer}
            onChange={(e) => setRanglistennummer(e.target.value.trim())}
            placeholder="z. B. 3 oder 2a"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                       focus:border-hsv-green focus:outline-none focus:ring-2 focus:ring-hsv-green/30
                       disabled:opacity-50"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Position in der Rangliste des Vereins (z. B. 1–10 für die 1. Mannschaft)
          </p>
        </div>

        {/* Mannschaft */}
        <div>
          <label
            htmlFor="mannschaft"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Mannschaft (Verein)
          </label>
          <select
            id="mannschaft"
            value={clubKuerzel}
            onChange={(e) => setClubKuerzel(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                       focus:border-hsv-green focus:outline-none focus:ring-2 focus:ring-hsv-green/30
                       disabled:opacity-50 bg-white"
            disabled={loading}
          >
            {CLUBS.map((club) => (
              <option key={club.kuerzel} value={club.kuerzel}>
                {club.name}
              </option>
            ))}
          </select>
        </div>

        {/* Liga */}
        <div>
          <label
            htmlFor="liga"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Ziel-Liga
          </label>
          <select
            id="liga"
            value={targetLiga}
            onChange={(e) => setTargetLiga(e.target.value as typeof targetLiga)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                       focus:border-hsv-green focus:outline-none focus:ring-2 focus:ring-hsv-green/30
                       disabled:opacity-50 bg-white"
            disabled={loading}
          >
            {SELECTABLE_LIGEN.map((liga) => (
              <option key={liga} value={liga}>
                {liga}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Die Liga, in der der Spieler eingesetzt werden soll
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !ranglistennummer}
          className="w-full rounded-md bg-hsv-green px-4 py-2.5 text-sm font-semibold text-white
                     shadow-sm hover:bg-hsv-green-dark focus:outline-none focus:ring-2
                     focus:ring-hsv-green focus:ring-offset-2 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Prüfe…" : "Spielberechtigung prüfen"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Result */}
      {result && !error && <VerdictDisplay result={result} />}

      {/* Refresh button */}
      <div className="pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-gray-500 hover:text-hsv-green underline disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? "Aktualisiere…" : "Ranglisten-Daten aktualisieren"}
        </button>
        <p className="mt-0.5 text-xs text-gray-400">
          Daten werden stündlich automatisch aktualisiert.
        </p>
      </div>
    </div>
  );
}
