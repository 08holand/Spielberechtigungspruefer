import EligibilityForm from "@/components/EligibilityForm";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="bg-hsv-green-light border border-green-200 rounded-lg px-5 py-4">
        <h2 className="font-semibold text-hsv-green text-sm mb-1">
          Spielberechtigung prüfen
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Gib die Ranglistennummer des Spielers ein, wähle den Verein und die
          Ziel-Liga aus. Die App prüft die Spielberechtigung gemäß{" "}
          <strong>§13–§16</strong> der Turnierordnung des Hamburger
          Schachverbandes.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <EligibilityForm />
      </div>

      <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-sm text-gray-600">
        <summary className="font-semibold text-gray-800 cursor-pointer select-none">
          Regelübersicht §13–§16
        </summary>
        <div className="mt-4 space-y-3 leading-relaxed">
          <div>
            <strong className="text-hsv-green">§13 Ranglisten</strong>
            <p>
              Jede Mannschaft besteht aus 8 Spielern + bis zu 2 Ersatzspielern.
              Die 1. Mannschaft hat Nummern 1–10, die 2. Mannschaft 11–20 usw.
              In der Landesliga dürfen nur gemeldete Spieler eingesetzt werden.
            </p>
          </div>
          <div>
            <strong className="text-hsv-green">§14 Bundesliga / Oberliga-Nord / Landesliga</strong>
            <p>
              Wer als Ersatzspieler in einer dieser Ligen eingesetzt wurde,
              verliert für die gleiche Runde die Spielberechtigung in tieferen
              Mannschaften. Nach 3 Einsätzen ist kein Einsatz in tieferen
              Mannschaften mehr möglich. Landesliga-Spieler dürfen insgesamt
              maximal 9× in der Landesliga und höheren Ligen spielen.
            </p>
          </div>
          <div>
            <strong className="text-hsv-green">§15 Ersatzspieler (Stadtliga abwärts)</strong>
            <p>
              Spieler aus tieferen Klassen oder der Reserveliste dürfen
              höchstens 3× als Ersatzspieler in einer höheren Klasse eingesetzt
              werden. Kein Spieler darf für mehrere Mannschaften in derselben
              oder Parallelklassen spielen.
            </p>
          </div>
          <div>
            <strong className="text-hsv-green">§16 Nachmeldungen</strong>
            <p>
              Pro Mannschaft darf ein Spieler mit a-Nummer nachgemeldet werden
              (z. B. 2a). Dieser ist nur für die gemeldete Mannschaft
              spielberechtigt. Nachmeldungen sind für die Landesliga
              ausgeschlossen.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
