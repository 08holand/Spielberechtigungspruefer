"use client";

import { EligibilityResult } from "@/lib/types";

interface Props {
  result: EligibilityResult & { fetchedAt?: string };
}

const VERDICT_CONFIG = {
  "spielberechtigt": {
    icon: "✅",
    label: "Spielberechtigt",
    className: "bg-green-50 border-green-400 text-green-900",
    iconBg: "bg-green-100",
  },
  "nicht-spielberechtigt": {
    icon: "❌",
    label: "Nicht spielberechtigt",
    className: "bg-red-50 border-red-400 text-red-900",
    iconBg: "bg-red-100",
  },
  "eingeschraenkt": {
    icon: "⚠️",
    label: "Eingeschränkt spielberechtigt",
    className: "bg-yellow-50 border-yellow-400 text-yellow-900",
    iconBg: "bg-yellow-100",
  },
} as const;

export default function VerdictDisplay({ result }: Props) {
  const config = VERDICT_CONFIG[result.verdict];

  return (
    <div className={`rounded-lg border-2 p-5 ${config.className}`}>
      <div className="flex items-start gap-3">
        <span className={`text-2xl rounded-full p-1 ${config.iconBg}`} aria-hidden>
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg leading-tight">{config.label}</p>
          <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
          {result.checkedParagraphs.length > 0 && (
            <p className="mt-2 text-xs opacity-70">
              Geprüfte Paragraphen: {result.checkedParagraphs.join(", ")}
            </p>
          )}
          {result.fetchedAt && (
            <p className="mt-1 text-xs opacity-60">
              Ranglisten-Stand:{" "}
              {new Date(result.fetchedAt).toLocaleString("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
