# Datenschutz- & Hosting-Konzept

**Praxis an der Wertachbrücke – digitales Termin- und Verwaltungssystem**
Stand: Juli 2026

---

## 1. Grundprinzip: Trennung von Webseite und Patientendaten

Das System besteht aus **zwei komplett getrennten Anwendungen** mit getrennten Internet-Adressen:

| | Öffentliche Webseite | Praxis-Verwaltung (Admin) |
|---|---|---|
| Wer hat Zugriff? | Jeder (Patienten) | Nur das Praxis-Team mit Login |
| Welche Daten sieht sie? | **Keine Patientendaten** – nur freie/belegte Uhrzeiten | Patienten, Termine, Zusammenfassungen |
| Adresse | z. B. praxis-wertachbruecke-demo.web.app | eigene, nicht verlinkte Adresse |

Die Webseite kann technisch **gar nicht** auf Patientendaten zugreifen: Die Zugriffsregeln der
Datenbank (Firestore Security Rules, Datei `firestore.rules`) erlauben ohne Anmeldung nur zwei Dinge:

1. **Lesen der belegten Zeitfenster** (`slots`) – diese enthalten ausschließlich Datum und Uhrzeit, nie Namen.
2. **Anlegen einer Terminanfrage** (`requests`) – schreiben ja, aber **lesen kann Anfragen niemand ohne Login**.

Alles andere (Patienten, Termine, Behandlungs-Zusammenfassungen) ist nur mit Praxis-Login erreichbar.

## 2. Wo liegen die Daten?

- **Datenbank:** Google Firebase **Firestore in der Region europe-west3 (Frankfurt am Main)** –
  die Daten bleiben auf Servern in Deutschland/EU.
- **Webseiten-Hosting:** Firebase Hosting (weltweites CDN, ausgeliefert wird nur die Oberfläche,
  keine Patientendaten in den ausgelieferten Dateien).
- **Terminkalender:** Google Kalender des Praxis-Kontos. **Wichtig:** Im Kalender steht bewusst
  **nur Behandlungsart + Kürzel** (z. B. „PZR – S. R."), niemals der volle Name, Telefonnummer oder
  Diagnosen. Die vollständigen Daten liegen ausschließlich in der geschützten Datenbank; die
  Verknüpfung läuft über eine unsichtbare technische ID.
- **Übertragung:** ausschließlich verschlüsselt über HTTPS/TLS.

## 3. Wer kommt an die Daten?

- **Praxis-Team:** persönliche Zugänge (E-Mail + Passwort) über Firebase Authentication.
  Mitarbeiter, die ausscheiden, werden mit einem Klick deaktiviert.
- **Arzt-Cockpit (Tablet):** läuft innerhalb der geschützten Verwaltung – ohne Login kein Zugriff.
  Empfehlung: Tablet mit Geräte-PIN und automatischer Sperre.
- **Niemand sonst:** Es gibt keine öffentliche Schnittstelle zu Patientendaten.

## 4. DSGVO-Pflichten für den Produktivbetrieb (Checkliste für die Praxis)

Für die **Demo** werden ausschließlich **fiktive Patienten** verwendet – datenschutzrechtlich unkritisch.
Vor dem Echtbetrieb mit realen Patientendaten:

- [ ] **Auftragsverarbeitungsvertrag (AVV)** mit Google abschließen – für Firebase/Google Cloud ist das
  das „Cloud Data Processing Addendum", online mit wenigen Klicks akzeptierbar. Gleiches für
  Google Workspace (Kalender/E-Mail); empfohlen wird ein **Google Workspace**-Konto statt privatem Gmail.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** um das System ergänzen (Terminverwaltung).
- [ ] **Datenschutzerklärung der Webseite** anpassen (Terminanfrage-Formular: Zweck, Speicherdauer).
- [ ] **Datenschutzbeauftragten** (falls die Praxis einen hat: i. d. R. ab 20 Personen mit ständiger
  Datenverarbeitung) das Konzept vorlegen.
- [ ] Zwei-Faktor-Anmeldung für das Praxis-Google-Konto aktivieren.
- [ ] Regelmäßige Datenexporte (CSV) als Backup – Exportfunktion ist eingebaut.

## 5. Ehrliche Grenzen des Systems

- Das System ist die **Termin- und Organisationsebene** der Praxis. Es ersetzt **nicht** die
  zertifizierte Praxisverwaltungssoftware (PVS) für Abrechnung (KZV), Röntgen und Patientenakte.
  Behandlungs-Zusammenfassungen sind Organisationsnotizen, keine rechtssichere Dokumentation.
- Google Kalender ist ein US-Anbieter. Durch die Kürzel-Regel (Punkt 2) stehen dort keine
  identifizierenden Patientendaten; wer das ganz ausschließen will, kann den Google-Sync abschalten –
  der Kalender in der Verwaltung funktioniert auch ohne.
- Kostenlose Free-Tier-Kontingente (Firebase Spark) reichen für eine Einzelpraxis komfortabel;
  bei starkem Wachstum entstehen geringe Kosten (wenige €/Monat, Blaze-Tarif).

## 6. Kostenübersicht

| Baustein | Anbieter | Kosten |
|---|---|---|
| Webseite + Verwaltung Hosting | Firebase Hosting | 0 € (Free-Tier) |
| Datenbank | Firestore (Frankfurt) | 0 € (Free-Tier, 50k Lesezugriffe/Tag) |
| Login / Benutzer | Firebase Authentication | 0 € |
| Terminkalender | Google Kalender | 0 € |
| Termin-Erinnerungen | Google Apps Script | 0 € |
| Eigene Domain (optional) | z. B. praxis-wertachbruecke.de umziehen | ~10–15 €/Jahr |
| Empfohlen für Echtbetrieb: Google Workspace | Google | ab 5,75 €/Monat/Konto |
