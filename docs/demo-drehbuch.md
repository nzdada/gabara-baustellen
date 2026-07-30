# Demo-Drehbuch: Vorstellung beim Zahnarzt

Ziel: In ~15 Minuten zeigen, wie Webseite, Terminbuchung, Verwaltung und Arzt-Cockpit
zusammenspielen – mit einem echten „Wow-Moment" (Live-Tablet).

## Vorbereitung (am Tag vorher)

1. **Firebase aktivieren** (einmalig, Anleitung in README.md, Konto nasiradada.98@gmail.com)
   und beide Apps deployen → zwei Internet-Adressen, von überall im Chrome erreichbar.
   *Ohne Firebase geht die Demo auch lokal auf einem Gerät – aber der Tablet-Live-Effekt
   zwischen zwei Geräten braucht Firebase.*
2. In der Verwaltung → **Einstellungen → „Demo-Daten zurücksetzen"** klicken
   (legt fiktive Patienten + heutige Termine an, damit das Cockpit „lebt").
3. Geräte: **Laptop** (Verwaltung), **Tablet** (Arzt-Cockpit, eingeloggt, Vollbild),
   **Handy** (öffentliche Webseite). Alle drei vorher einloggen/öffnen und testen.
4. Optional: Google Kalender im Admin verbinden, damit der Termin live im Kalender erscheint.

## Ablauf der Vorstellung

### 1. Einstieg (2 Min) – „Ihre neue Webseite"
- Laptop/Beamer: neue Webseite zeigen. Kurz scrollen: Leistungen, Team (mit Martha!),
  Öffnungszeiten – „alles Ihre echten Inhalte, nur moderner".
- Satz dazu: *„Die Webseite kennt keine Patientendaten – sie ist komplett von der Verwaltung getrennt."*

### 2. Terminbuchung aus Patientensicht (3 Min) – am Handy
- Dem Zahnarzt das Handy geben: **„Buchen Sie selbst einen Termin."**
- 3 Schritte: Anliegen antippen → freien Termin antippen → Name + Telefon → fertig.
- Zeigen: Bei „Ich habe Schmerzen" gibt es keine Online-Buchung, sondern die Aufforderung
  anzurufen (mit Anruf-Knopf) – Schmerzpatienten gehören ans Telefon.

### 3. Verwaltung (4 Min) – am Laptop
- **Anfragen**: Die eben gebuchte Anfrage ist schon da (Live!). Auf „Bestätigen" klicken –
  das System erkennt automatisch, ob der Patient schon existiert, sonst legt es ihn an.
- **Kalender**: Der Termin steht sofort in der Wochenansicht. (Falls verbunden: auch im
  Google Kalender – dort nur als „Kontrolle – M. M.", Datenschutz!)
- **Patienten**: Suche zeigen, Patientenakte mit Behandlungshistorie öffnen.
- **Erinnerungen** (Einstellungen): Zeigen, dass morgen automatisch erinnert wird
  (E-Mail automatisch, Ohne-E-Mail-Liste zum Anrufen).

### 4. Der Wow-Moment: Arzt-Cockpit live (4 Min)
- Dem Zahnarzt das **Tablet** in die Hand geben: Arzt-Cockpit mit den heutigen Terminen,
  aktueller Patient groß, Allergie-Warnung rot, letzte Behandlungen darunter.
- Jetzt am **Laptop** (Rolle: Empfang/Assistenz) im Termin die Zusammenfassung tippen:
  *„Füllung 25 gelegt, Anästhesie"* + Häkchen setzen.
- → **Erscheint live auf seinem Tablet, ohne dass er etwas tut.** Das ist der Kernsatz:
  *„Sie sehen während der Behandlung immer den aktuellen Stand – auch wenn das Team am Empfang dokumentiert."*
- **Bilder & Scans:** Auf dem Tablet „📷 Foto aufnehmen" tippen (öffnet direkt die Kamera) –
  das Foto erscheint sofort auch am Laptop im Termin. Umgekehrt am Laptop einen „Scan"
  hochladen → erscheint live auf dem Tablet. *„Intraoral-Scans oder Situationsfotos hängen
  direkt am Termin – nichts geht mehr verloren."*
- Auch abgesagte Termine sieht der Arzt (rot, durchgestrichen) – er erkennt Lücken sofort.
- Auf dem Tablet „Behandlung abschließen" tippen → Status überall grün.

### 5. Import & Abschluss (2 Min)
- **Import**: Beispiel-CSV (seed/patienten-beispiel.csv) hochladen – Spalten werden automatisch
  erkannt, 10 Patienten in 5 Sekunden drin. *„So kommen Ihre Bestandsdaten aus dem Altsystem rein."*
- **Datenschutz-Folie** aus der Präsentation: Trennung, Frankfurt-Server, Login, Kürzel im Kalender.
- **Kosten**: 0 €/Monat Betrieb. Nächste Schritte besprechen.

## Wenn etwas schiefgeht (Plan B)

- Internet weg? → Beide Apps laufen auch lokal im Demo-Modus auf dem Laptop
  (Buchung + Verwaltung + Cockpit in zwei Browser-Tabs nebeneinander – Live-Update
  funktioniert auch zwischen Tabs).
- Vor der Demo Daten „verbraucht"? → Einstellungen → Demo-Daten zurücksetzen (10 Sekunden).
- Login-Daten Demo-Modus: empfang@praxis-demo.de bzw. arzt@praxis-demo.de, Passwort demo2026.
