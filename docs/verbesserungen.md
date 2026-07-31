# Experten-Prüfung: Verbesserungen (Stand 31.07.2026)

Zwei Prüfungen: **Produkt/UX** (Handwerker-Software-Blick) und **Baurecht**
(Gerichtsfestigkeit der Berichte nach VOB/B). ✅ = bereits umgesetzt.

## Rechtliche Prüfung der Berichte (Gerichtsfestigkeit)

| Status | Punkt | Warum wichtig |
|---|---|---|
| ✅ | Stundenlohnzettel je PERSON mit Name, Datum, Von–Bis | VOB/B § 15 Abs. 3 – sonst nicht prüffähig, Regieforderung abweisbar |
| ✅ | Fortlaufende Berichtsnummern (RB-/RK-/AB-JJJJ-NNN) auf jedem PDF + in Rechnungspositionen zitiert | Lückenlosigkeit, Beweiskette Rechnung → Nachweis |
| ✅ | Freigegebene/abgerechnete Berichte gesperrt (keine Änderung, kein Foto-Löschen) | Beweiswert: nachträglich änderbare Dokumente sind angreifbar (§ 286 ZPO) |
| ✅ | Anordnung der Regie-Arbeiten VOR Beginn dokumentiert (durch wen/wann/wie) | VOB/B § 15 Abs. 3 Satz 1 – ohne Anzeige kaum durchsetzbar |
| ✅ | Anerkennungsfiktion-Hinweis (6 Werktage) auf dem Regie-PDF | § 15 Abs. 3 – schärfste Waffe des Nachunternehmers |
| ✅ | Abnahme: Gegenstand (Teil-/Gesamtabnahme + Leistungsumfang) | Sonst mehrdeutig („nur Zustandsfeststellung?") |
| ✅ | Abnahme: Vorbehalte-Pflichtblock (Vertragsstrafe § 11 ja/nein + sonstige) | Dokumentiertes „nein" schneidet spätere Vertragsstrafen ab |
| ✅ | Abnahme: Unterschriften BEIDER Seiten Pflicht, mit Name/Funktion/Firma | Vertretungsbefugnis („der war nur Hausmeister") |
| ✅ | Gefahrübergang + Verjährung (VOB 4 J. / BGB 5 J.) mit Enddatum auf dem PDF | Klarheit über das anwendbare Regime |
| ✅ | Echte Zeitstempel (erfasst/eingereicht/freigegeben, durch wen) statt Druckdatum; Foto-Zeitstempel | „Wann war das wirklich?" – werktägliche Einreichung nachweisbar |
| ✅ | Reklamation: Rüge-Zugang, Frist, gerügt-durch | § 13 Abs. 5 VOB/B (Verjährung der Nachbesserung) |
| ⏳ | EXIF-Aufnahmezeit der Fotos sichern (vor Kompression auslesen) | Original-Aufnahmezeit als zusätzlicher Beweis (Aufwand: mittel) |
| ⏳ | Vertragsnummer/-datum am Projekt + auf jedem Dokument („Vertragsgrundlage: NU-Vertrag vom …") | Zuordnung Dokument → Vertrag (Aufwand: klein, V1.1) |
| ⏳ | Eigendruck-Rechnung: Steuernummer/USt-IdNr. + § 48b-Hinweis | Nur Fallback – offiziell rechnet FastBill (Aufwand: klein) |

## Produkt-/UX-Prüfung

| Status | Punkt |
|---|---|
| ✅ | **Parallele Kolonnen**: Zwei Trupps können jetzt zur selben Zeit auf verschiedenen Baustellen geplant werden (Kollision nur noch je gewähltem Monteur) |
| ✅ | **Rechnung löschen bucht zurück**: LV-Mengen/Berichte/Spesen werden wieder abrechenbar (vorher: Geld für immer „vergessen") |
| ✅ | **+ Rechnung direkt aus dem Projekt** (Wizard startet mit dem Projekt vorbelegt) |
| ✅ | Freigabe mit Zeitstempel + Person; „Bearbeiten" nur bei Entwurf/Eingereicht |
| ⏳ | Anfrage → Kunde → Projekt in einem Zug + Maler-Wording im Bestätigen-Dialog (statt Zahnarzt-Restdialog) — Aufwand mittel |
| ⏳ | Kalender-Chips: Projekt + Monteur-Farbpunkte („Wer ist morgen wo?") — klein |
| ⏳ | Mehrtägige Einsätze: „Täglich wiederholen bis"-Datum beim Anlegen — mittel |
| ⏳ | Monteur: Plus/Minus-Stepper + „Fertig"-Knopf für Ist-Mengen — klein |
| ⏳ | Offline-Banner in der Monteur-Ansicht („Keine Verbindung …") — klein |
| ⏳ | Foto-Kommentare („Treppenhaus EG") in Bericht + PDF — mittel |
| ⏳ | Freigabe nur nach Sichtprüfung + Zurückweisen mit Grund an den Monteur — klein |
| ⏳ | Webseite: Foto-Upload in der Anfrage + WhatsApp-Button — mittel |
| ⏳ | Diktier-Funktion (Sprache→Text) für Beschreibungen — klein |

Die ⏳-Punkte sind gute Kandidaten für V1.1 (vor oder direkt nach dem Firebase-Go-Live) —
Reihenfolge nach Wunsch.
