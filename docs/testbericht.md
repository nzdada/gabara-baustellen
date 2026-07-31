# Gabara Baustellen – Testbericht (31.07.2026)

Alle Tests im Lokal-Modus durchgeführt (Chrome, Verwaltung Port 5420, Webseite Port 5410).
FastBill-Tests liefen ECHT gegen das Testkonto (nasirdada.98@gmail.com).

## Code-Review (vorab)

4 parallele Review-Blickwinkel (Admin-Seiten, Shared-Module, Monteur-Mobile, Sicherheit/Daten),
jedes Finding adversarial gegengeprüft: **13 bestätigte Findings, 8 Ursachen — alle gefixt:**

| # | Schwere | Problem | Fix |
|---|---|---|---|
| 1 | kritisch | Lokaler `store.add()` duplizierte Berichte/Spesen bei jedem Speichern (bis zur doppelten Abrechnung im Rechnungs-Wizard) | add() upsertet jetzt bei vorhandener id (wie Firebase setDoc) |
| 2 | hoch | FastBill-API-Key wurde als Klartext ins Produktions-Bundle kompiliert | Env-Fallback nur noch im Dev-Modus; per Grep im Bundle verifiziert: Key raus |
| 3 | hoch | Browser-Speicher voll → stiller Datenverlust | Laute Warnung + Fehleranzeige in den Formularen |
| 4 | hoch | Abnahme-Mängel crashten die Projekt-Detailansicht (Objekt als React-Child) | Mängelliste korrekt gerendert (Text + Frist) |
| 5 | hoch | Anfrage „Bestätigen" crashte bei Webseiten-Anfragen ohne Wunschtermin + legte je Versuch einen Kunden-Duplikat an | Ohne Termin wird nur der Kunde angelegt; Fehler sichtbar |
| 6 | hoch | Druck-PDFs: `<` oder `</script>` in Texten zerriss das Dokument (XSS-Vektor) | Alle Nutzereingaben HTML-escaped |
| 7 | hoch (V2) | photos-Firestore-Regel blockierte alle Foto-Reads/-Löschungen | Größencheck nur noch bei create/update |
| 8 | mittel | Monteur ohne Mitarbeiter-Profil sah kommentarlos nichts | Hinweis-Banner + Namens-Fallback bei Spesen |

## Test-Beispiele (mit Screenshots im Chat-Verlauf)

**Test 1 – Berichte-Eingang (Büro):** Reklamations-Entwurf „Farbabplatzer Treppenhaus" bearbeitet
und gespeichert → erscheint EINMAL (Duplikat-Fix bestätigt: `b-2`-Kopien vorher 1, nachher 1). ✅

**Test 2 – Projekte mit schlichter Pipeline:** Nur noch 6 Stufen + Archiv (Alle Offenen 3 ·
Angebot 1 · Beauftragt 1 · In Arbeit 1). Alt-Status („auftragsbestaetigung") wird automatisch
als „Beauftragt" angezeigt. Filterzeile je Spalte funktioniert. ✅

**Test 3 – Projekt-Detail:** Dreispalter mit Dokumentbaum (LV 9 · Bilder 3 · Regieberichte 1 ·
Reklamationen 1), Logbuch chronologisch, Projektvolumen live aus LV (7.760,00 € — nachgerechnet
korrekt, Bedarf/NEP ausgeschlossen). ✅

**Test 4 – LV-Editor:** OZ-Hierarchie mit Titel-Zwischensummen, Mengen/EP editierbar,
LV-Summe 7.760,00 €, „LV importieren" (CSV + PDF-Text-Assistent) vorhanden. ✅

**Test 5 – Abrechnung/FastBill (ECHT):** Rechnungs-Wizard: LV-Restmengen (820 m² Grundierung,
640 m² Erstanstrich, 6 Zargen) + freigegebener Regiebericht (186,50 €) + Fahrt-Spesen (13,50 €)
→ Netto 3.210,00 €, §13b-Hinweis, 10 % Sicherheitseinbehalt −321,00 € → **Zahlbetrag 2.889,00 €**.
„An FastBill übertragen": Kunde Bothmer wurde per customer.create angelegt, Rechnung liegt als
**Entwurf im echten FastBill-Konto** (invoice.create), Status-Abgleich + PDF-Link funktionieren. ✅

**Test 6 – Monteur-Handy „Heute" (375 px):** Login als Monteur → automatisch Handy-Ansicht:
nur zugewiesene Einsätze (Heute/Demnächst), große Karten mit Zeit, Navigation-Link,
„Zur Baustelle" / „Erledigt melden", Bottom-Tabs Heute·Baustellen·Spesen. ✅

**Test 7 – Monteur-Baustelle:** Fortschritt 41 % (3.205 € von 7.760 € — rechnet Ist-Eingaben
live ein), 4 große Aktions-Buttons (Regiebericht/Reklamation/Abnahme/Spesen), Arbeitsauftrag
mit großen Ist-Mengen-Feldern. Ist-Eingabe 100 m² auf Pos. 2.2 → gespeichert mit
istVon="Ahmad Monteur", istAm=heute (Debounce + blur-Flush). ✅

**Test 8 – Berichts-Formular im mam-Stil:** Nummerierte Sektionen wie in der mam_solar-App:
① Basisdaten (OK-Badge) → ② **VORHER – Zustand vor der Arbeit** (Pflicht-Badge, eigener
Kamera-Button) → ③ Beschreibung → ④ Arbeitszeit & Material → ⑤ **NACHHER – Ergebnis**
(Pflicht) → ⑥ Unterschriften (Kunde + Monteur). „Einreichen" bleibt gesperrt, bis
Vorher-Foto + Nachher-Foto + Beschreibung da sind (Hinweis nennt den fehlenden Abschnitt). ✅

**Zuweisung (Büro):** Im Termin-Dialog sind die Monteur-Chips jetzt direkt antippbar —
Zuweisung ändert sich sofort, der Monteur sieht den Einsatz auf dem Handy. ✅

## Bekannte Grenzen (dokumentiert)

- Lokal-Modus: Webseite und Verwaltung teilen sich keinen Browser-Speicher (verschiedene Ports) —
  Webseiten-Anfragen erscheinen erst im Firebase-Modus (V2) live im Büro.
- Browser-Speicher (~5 MB) begrenzt die Foto-Menge im Lokal-Modus — produktiv = Firebase.
- Firestore-Rules-Rollen-Feinschnitt (Monteur vs. Büro) kommt planmäßig beim Firebase-Go-Live.
