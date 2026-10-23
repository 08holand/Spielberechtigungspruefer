# HMM Check

## Starten

- Der Workflow **Start application** startet die App mit `npm run dev` auf Port 5000.
- `npm test` führt die Tests für Ranglistenparser und Spielberechtigungsregeln aus.
- `npm run build` prüft die TypeScript-Typen und erstellt den Produktionsbuild.

## Ranglistendaten und Grenzen

- Die App verwendet die HMM-2026-Rangliste des Hamburger Schachverbands. Die gespeicherte Offline-Kopie hat den Quellenstand **19. Juni 2026**; die App versucht beim Start und auf Anforderung, aktuelle Daten abzurufen.
- Wenn der Live-Abruf nicht möglich ist, bleibt die Kopie verfügbar. Ihre Herkunft und der Fehlschlag einer Aktualisierung werden in der Oberfläche angezeigt.
- Die veröffentlichte Rangliste enthält keine früheren Spieleinsätze. Sie enthält außerdem keine vollständigen Aufstellungen der Landesliga und überregionaler Spielklassen. Deshalb zeigt die Prüfung diese Teile als offen, bis die fehlenden Angaben bestätigt sind.
- Ein angezeigtes Ergebnis ist eine Orientierung anhand des verzeichneten Ranglistenstands, keine verbindliche Entscheidung der Turnierleitung. In Zweifelsfällen gelten die offizielle Turnierordnung und die Auskunft des Hamburger Schachverbands.
- Die Vereinsauswahl enthält alle 40 Vereine aus der Vereinsspezifikation. Dort steht „39“, die aufgeführte Tabelle enthält jedoch 40 Einträge.
