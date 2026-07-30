# QA-Log — Testdurchführung 08.07.2026

Durchführung: automatisiert im Browser (lokale Dev-Server gegen die **produktive**
Firestore-Datenbank) + REST-Prüfungen (curl) gegen die deployten Security Rules.
Testdaten: Demo-Reset mit Szenario-Daten (siehe qa-testfaelle.md).

| Nr | Beschreibung | Soll | Ist | Status |
|---|---|---|---|---|
| T01 | PZR-Wording einheitlich | „… (PZR)" überall | Buchungskarte, Katalog (GOZ 1040), Baustein zeigen „(PZR)" | ✅ PASS |
| T02 | Listen-Highlight Patienten | Teal-Hintergrund + weiße Schrift | `bg-praxis-600`, Text weiß | ✅ PASS |
| T03 | Impressum/Datenschutz | Pflichtinhalte vorhanden | Google Ireland ✓, Frankfurt/EU ✓, Apps-Script-Mail-Datenfluss ✓, Footer-Links ✓ | ✅ PASS |
| T04 | Live-Toast bei neuer Anfrage | Toast + Ton ohne Reload | Anfrage per REST angelegt → Toast „Live Toast-Test · Kontrolluntersuchung · 15.7.2026 · 09:00" | ✅ PASS |
| T05 | Toast-Deep-Link | #/anfragen?id=… + Dialog offen | URL korrekt, Bestätigen-Dialog automatisch geöffnet, Karte mit Ring hervorgehoben | ✅ PASS |
| T06 | Odontogramm | 32 Zähne, Befund speichern | 32 Zähne gerendert, Zahn 36 „Karies" gespeichert, teal markiert; Zahn 17 Freitext ok | ✅ PASS |
| T07 | Risiko-Tags (Selma) | ⚠️ Angstpatient rot + Notiz | Tag ⚠️ Angstpatient, rote Notiz „ANGSTPATIENTIN", Befund 26 sichtbar; 🆕 Neukunde bei jungen Akten | ✅ PASS |
| T08 | GOZ-Vorschlag | Check → Vorschlag → Warenkorb | Check „Füllung" → Chip „+ GOZ 2080 … 90,00 €" → Position übernommen | ✅ PASS |
| T09 | Abrechnungs-Pipeline | Abschluss → „Bereit für Abrechnung" | Status `pruefen`, violette Sektion in Abrechnung, Kette Prüfen→Gestellt→Bezahlt | ✅ PASS |
| T10 | HKP-Warnung | Nur ohne genehmigten Plan | Werner+Krone (genehmigt): keine Warnung; Werner+Implantat: Warnung erscheint | ✅ PASS |
| T11 | HKP-Status-Tracker | 4 Status + gültig bis | Genehmigt mit „gültig bis" (Standard +6 Mon.), Abgelehnt rot, Ablaufwarnung implementiert | ✅ PASS |
| T12 | SEO | Title/h1/JSON-LD/WebP | Title „Zahnarzt Augsburg an der Wertachbrücke…", genau 1 h1, JSON-LD vorhanden, 11/11 Bilder WebP geladen; robots+sitemap deployed | ✅ PASS |
| T13 | 24h-Ausfallgebühr | §615-Posten + Status + Mail | Lina (heute 15:00) abgesagt → kurzfristig=true, ausfallgebuehr=ausstehend, Posten „§ 615 BGB 50 €", rechnung=pruefen, abgesagtAm gesetzt | ✅ PASS * |
| T14 | Blacklist | ≥2 kurzfristig gelistet + Sperre | Peter Grimm 2× + 100 € offen; „Sperren" → GESPERRT-Badge; Gebühren-KPI zeigt 100,00 € | ✅ PASS |
| T15 | Sperr-Block im Bestätigen | Warnung + Knopf deaktiviert | Grimm-Anfrage: rote GESPERRT-Warnung, „Termin bestätigen & anlegen" disabled | ✅ PASS |
| T16 | Dashboard-Chart + KPIs | 8-Wochen-Stapel + Tooltip | Chart grün/gelb/rot mit Legende, Summen-Labels, Hover-Tooltip; Ausfallquote 50 % (Szenario), Palette validiert (dataviz-Skript) | ✅ PASS |
| T17 | Feedback gültiger Token | Speichern + Danke-Seite | 1★ + Tag + Text über #/feedback?id=ter-t01&token=demo-fb-t01 gespeichert | ✅ PASS |
| T18 | Feedback falscher Token | Rules lehnen ab | Anonymer REST-Create mit falschem Token → HTTP 403 | ✅ PASS |
| T19 | Feedback-Alarm | Rot + zuerst + Nav-Badge | 2★-Seed: Nav-Badge „1" (pulsierend), „AKTION ERFORDERLICH" oben, ⭐-Schnitt angezeigt | ✅ PASS |
| T20 | Globale Einstellungen | Persistenz nach Reload | Stornofrist geändert + gespeichert → nach Reload korrekt aus settings/global geladen | ✅ PASS |
| T21 | Patient-Wiedererkennung | Telefon-Match | Werner-Anfrage: „Vorhandener Patient: Werner Altmann" automatisch vorgeschlagen | ✅ PASS |
| T22 | Editor-Tippen + Groß-Modus | Sofort sichtbar, Speichern & zurück | execCommand-Tipptest: sofort sichtbar (600-ms-Puffer), Vollbild-Editor speichert und schließt | ✅ PASS |
| T23 | Absage-Link (GAS) | Absage + Slot frei + Doppelklick-Schutz | Falscher Token: „Link ungültig"; gültig: „Termin abgesagt", Slot 404 (frei); 2. Klick: „Bereits abgesagt" | ✅ PASS |

\* T13-Hinweis: Die **Gebühren-Mail** und die **Feedback-Mails** benötigen die neue
Version von `seed/erinnerung.gs` im Apps-Script-Projekt (doPost-Typ `gebuehr` +
`sendeFeedbackAnfragen`). Bis zum GAS-Update funktioniert die komplette Logik in
der App, nur diese zwei Mail-Typen werden noch nicht zugestellt.

**Sicherheits-Regression mitgeprüft:** Patientendaten/Termine/Anfragen anonym → 403;
öffentlich lesbar nur `slots` (reine Zeitfenster). Feedback-Rule-Fix (Team-Create
erlaubt) während der QA gefunden und deployed.

Nach der Testdurchführung wurden die Demo-Daten zurückgesetzt (QA-Mutationen entfernt).
