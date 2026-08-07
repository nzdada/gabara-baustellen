# Lessons Learned V1 → Bauplan für V2

> Stand 02.08.2026 · Grundlage: das Demo-System V1.2 (online seit 01.08.2026)
> Zweck: Was wir aus dem Demo-Bau gelernt haben – und wie V2 stabiler und sicherer wird.
> Alle Aussagen sind am echten Code dieses Projekts belegt, nicht allgemeine Lehrbuchregeln.

---

## 0. Was V1 war – und was es geleistet hat

V1 war ein **Demo-System, um herauszufinden, was der Betrieb wirklich braucht**. Diese Aufgabe
hat es erfüllt: In wenigen Tagen stand ein vollständiger Durchstich von der Kundenanfrage über
Leistungsverzeichnis, Einsatzplanung und Baudokumentation bis zur Rechnung in FastBill.

**Das ist der eigentliche Gewinn aus V1 – und der wichtigste Baustein für V2:**

| Was V1 erarbeitet hat | Warum das wertvoll bleibt |
|---|---|
| Fachwissen im System (VOB/B §15 Stundenlohnzettel, §12 Abnahme, §13b, LV mit Ist-Mengen, Sicherheitseinbehalt) | Das ist die eigentliche Denkarbeit. Sie gilt unverändert für V2 – nur die Technik darunter wird neu. |
| Erprobte Abläufe (Kalender → Baustelle → Bericht → Freigabe → Abrechnung) | Ein Ablauf, den man am Bildschirm durchgeklickt hat, ist ein besseres Pflichtenheft als jedes Papier. |
| Entscheidung „FastBill statt Eigenbau" | Rechnungsnummern, E-Rechnung, Mahnwesen selbst zu bauen wäre der teuerste Irrweg gewesen. Diese Entscheidung war richtig und bleibt. |
| Zweisprachigkeit Deutsch/Arabisch | Passt zur Belegschaft, ist inhaltlich fertig (840 Textbausteine) und lässt sich übernehmen. |
| Zwei Prüfungen (Code + Baurecht) | Haben echte Geldfehler gefunden, bevor sie Geld gekostet haben. Siehe Lehre 12. |

**Und das ist die ehrliche Kehrseite:** V1 ist gewachsen, nicht geplant. Es entstand als Kopie
einer Zahnarztpraxis-Software, und vieles wurde nachträglich draufgesetzt. Für ein Demo ist das
genau richtig – für ein System, in dem echte Kundendaten, Stundennachweise und Rechnungen liegen,
reicht es nicht. Die folgenden Lehren sagen, wo.

---

## 1. Die vier teuersten Lehren

### Lehre 1: Eine Vorlage zu kopieren war richtig – sie nicht sofort umzubenennen war falsch

**Was passiert ist:** In der Datenbank heißen Kunden bis heute `patients`, Termine `appointments`,
das Feld für den Monteur `arzt`, der Titel `behandlung`. Jedes Termin-Dokument schleppt tote Felder
aus der Zahnarztwelt mit (`befunde`, `leistungen`, `stornoToken`, `feedbackToken`) – geschrieben,
aber nirgends gelesen. Schlimmer: Es gibt **zwei Wahrheiten** für dieselbe Sache. „Wer ist
zugewiesen?" steht in `mitarbeiterIds` *und* im Altfeld `arzt`; „Wie heißt der Termin?" steht an
zehn Stellen als `termin.titel || termin.behandlung`.

**Die Lehre:** Ein geerbter Name ist billig, solange eine Person den Code kennt. Teuer wird er,
sobald eine zweite Wahrheit danebensteht – dann zeigt der Bericht einen Namen und die Rechnung
einen anderen, und niemand kann den Fehler nachstellen.

**Für V2:** Sauberes Datenmodell **als allererstes Arbeitspaket** (`kunden`, `einsaetze`,
`kundeId`, `titel`; `arzt` und die toten Felder ersatzlos weg), Migration per einmaligem Skript,
**bevor** echte Daten drin sind. Danach ein Feld-Schema an einer Stelle, gegen das Formulare *und*
Sicherheitsregeln arbeiten. Regel für die Zukunft: *Vorlagen dürfen kopiert werden, aber die
Umbenennung ist Teil von Paket 0 und nicht optional.*

### Lehre 2: Der Weg, auf dem Geld entsteht, muss unteilbar sein

**Was passiert ist:** Der teuerste Fehler des Projekts war ein Doppelt-Verbuchen (gefunden im
Code-Review: Berichte wurden beim Speichern dupliziert und wären doppelt abgerechnet worden). Der
wurde behoben – aber der Abrechnungsschritt selbst schreibt bis heute **nacheinander** in vier
Bereiche: Rechnung anlegen, Restmengen fortschreiben, Berichte auf „abgerechnet", Spesen auf
„erstattet". Bricht dazwischen das Netz ab, existiert die Rechnung, aber die Mengen sind nicht
fortgeschrieben – dieselbe Leistung lässt sich ein zweites Mal abrechnen.

**Die Lehre:** Bei Geld gibt es kein „halb erledigt". Genau an dieser Stelle entstehen die Fehler,
die den Ruf beim Auftraggeber kosten – Rückforderungen sind schlimmer als eine fehlende Funktion.

**Für V2:** Der komplette Abrechnungsschritt läuft in **einer Transaktion** – entweder alles oder
nichts. Zusätzlich Wiederhol-Sicherheit: Die Rechnungs-Kennung wird in jede fortgeschriebene
Position geschrieben, dann erkennt ein zweiter Durchlauf, dass er schon gelaufen ist.

### Lehre 3: Ein Anmeldekonto darf nicht automatisch Chef sein

**Was passiert ist:** In den Zugriffsregeln steht eine Übergangsregel: Wer angemeldet ist, aber
kein hinterlegtes Mitarbeiter-Profil hat, wird **wie das Büro behandelt** und darf fast alles lesen
und ändern. Sie war als Kulanz gedacht, damit sich niemand aussperrt. Praktisch ist sie ein
Generalschlüssel – wenn in Firebase die Selbstregistrierung aktiv ist, kann sich jemand Fremdes
ein Konto anlegen und käme an alle Kunden-, Baustellen- und Rechnungsdaten.

**Die Lehre:** Sicherheitsregeln dürfen keine „Notausgänge nach oben" haben. Ein Zustand, der
eigentlich nie eintreten soll, tritt genau dann ein, wenn es weh tut.

**Für V2:** Rolle nicht aus einem Datenbank-Dokument ableiten, sondern **fest ins Anmelde-Token**
(Firebase Custom Claims) – vergeben von einer Server-Funktion, nicht änderbar vom Browser. Wer
keine Rolle hat, hat **keine** Rechte (nicht alle). Selbstregistrierung abschalten; Konten legt das
Büro an.

### Lehre 4: Was online läuft, muss gesichert sein – auf beiden Ebenen

**Was passiert ist:** Zwei Lücken derselben Art. Erstens: Der Stand, der gerade online arbeitet,
steht in **keinem Commit** – rund 9.000 Zeilen Arbeit existieren nur auf einer Festplatte in
Augsburg. Zweitens: Von den Firestore-Daten gibt es **keine Sicherung** – der kostenlose
Firebase-Tarif kann gar keine. Und der Knopf „Beispieldaten zurücksetzen" löscht im Online-Betrieb
den **echten** Bestand hinter einer einzigen Rückfrage.

**Die Lehre:** „Es läuft" ist nicht dasselbe wie „es ist sicher". Ohne Sicherung ist jeder
Fehlklick und jeder Plattenschaden endgültig – ausgerechnet bei den Dokumenten, die man Jahre
später braucht (Stundenzettel, Abnahmeprotokolle).

**Für V2:** (1) Ausgeliefert wird nur aus einem sauberen, eingecheckten Stand – erzwungen durch ein
Deploy-Skript. (2) Nächtliche automatische Sicherung aller Daten (JSON-Export ins Firmen-Drive,
30 Tage) **plus** ein Knopf „Alles sichern" vor riskanten Schritten. (3) Der Rückweg wird einmal
echt durchgespielt – eine Sicherung, die nie zurückgespielt wurde, ist keine Sicherung.
(4) Demo- und Löschfunktionen gehören nicht in die Produktionsoberfläche.

---

## 2. Technik: Was in V2 anders gebaut werden muss

| # | Lehre aus V1 | Empfehlung V2 | Priorität |
|---|---|---|---|
| 5 | **Zwei Datenwege sind einer zu viel.** Der Speicher hat einen Lokal- und einen Firebase-Modus – zwei vollständige Umsetzungen, doppelt zu pflegen. Der teure Duplikat-Fehler steckte ausgerechnet im Lokal-Modus. Und Vorführen im Lokal-Modus beweist nichts, weil Rechte und Transaktionen dort andere Wege gehen. | Nur noch Firestore. Zum Entwickeln und Vorführen den **Firebase-Emulator** (kostenlos, offline, gleiche Regeln wie echt). Offline auf der Baustelle deckt Firestores eingebaute Offline-Funktion ab. | hoch |
| 6 | **Die App lädt fast überall alles.** 82 Stellen abonnieren eine komplette Datensammlung, nur 16 filtern. Das Menü lädt auf *jeder* Seite alle Berichte inklusive Unterschriftsbildern, nur für zwei Zahlen-Bapperl. Bei 3 Baustellen unauffällig – bei 30 Baustellen und zwei Jahren Historie lädt jeder Seitenaufruf Megabytes, ausgerechnet beim Monteur mit schlechtem Netz. | Jede Abfrage bekommt **Filter + Begrenzung**; Listen laden seitenweise nach. Zähler als vorberechnete Werte statt Vollabo. Archivdaten nur auf Anforderung. | hoch |
| 7 | **Fotos liegen als Text in der Datenbank.** Um im Gratis-Tarif zu bleiben, wurden Bilder in die Dokumente eingebettet (max. 1 MB), statt Firebase Storage zu nutzen. Das begrenzt die Bildqualität, bläht jede Abfrage auf und macht Sicherungen groß. | Fotos nach **Firebase Storage**, im Dokument nur der Verweis. Kostenentscheidung dafür bewusst treffen (Storage setzt den Bezahltarif voraus – mit gesetztem Budget-Alarm). | hoch |
| 8 | **Querschnitt-Themen kamen zu spät.** Mehrsprachigkeit, Design-System, Dunkelmodus und Entwurfs-Sicherung wurden nachträglich über eine fertige Oberfläche gelegt. Jede dieser Nachrüstungen hat *jede* Seite angefasst – entsprechend hoch war das Risiko. | Diese vier Dinge in V2 **von Tag 1** festlegen: Textbausteine statt fester Texte, ein Design-System, Farbvariablen (hell/dunkel), Formular-Entwürfe als gemeinsamer Baustein. Kostet am Anfang zwei Tage, spart später Wochen. | hoch |
| 9 | **Jedes Formular ist ein Einzelstück.** Berichts-, Spesen- und Terminformular lösen dieselben Aufgaben (Eingaben halten, prüfen, speichern, Entwurf sichern) jeweils eigen. | Ein gemeinsamer Formular-Baustein mit Prüfregeln aus dem Feld-Schema. Neue Formulare sind dann Konfiguration statt Programmierung. | mittel |
| 10 | **Namens-Altlasten bis in die Einstellungen.** 535 Farbklassen heißen `praxis-*`, das Firmenlogo heißt im Code `ZahnLogo`, die Firmendaten liegen unter `praxisName`. | Reine Namensarbeit, ein Vormittag – gehört in dasselbe Paket 0 wie Lehre 1. | mittel |

---

## 3. Sicherheit: Was für echte Kundendaten fehlt

| # | Lücke in V1 | Empfehlung V2 | Priorität |
|---|---|---|---|
| 11 | **Der FastBill-Schlüssel liegt im Zugriff des Browsers.** Er steht in der Datenbank bzw. wird über eine Weiterleitung gereicht. Beim ersten Bauversuch wäre er sogar fest ins ausgelieferte Programm kompiliert worden (im Code-Review gefunden und behoben). | Kein Zugangsschlüssel im Browser. FastBill-Aufrufe laufen über eine **Server-Funktion** (Cloud Function), der Schlüssel liegt in der Server-Konfiguration. Der Browser ruft nur „erstelle Rechnung X" auf. | kritisch |
| 12 | **Kein Änderungsverlauf.** Berichte gelten nach Freigabe als „gesperrt", das Büro kann die Freigabe aber jederzeit zurücknehmen und danach alles ändern – **unbemerkt**. Für die angestrebte Gerichtsfestigkeit (VOB/B §15) ist das der schwache Punkt. | **Prüfspur** (Audit-Log): Wer hat wann was geändert – nur von der Server-Seite beschreibbar, für niemanden löschbar. Freigegebene Berichte zusätzlich als unveränderliche Kopie ablegen. | hoch |
| 13 | **DSGVO ist nur ein Text.** Die Datenschutzerklärung verspricht Löschung und Auskunft – im System gibt es beides nicht. Anfragen von Interessenten bleiben mit Name, Telefon und E-Mail dauerhaft liegen. FastBill als zweiter Datenempfänger wird nicht genannt. Im Impressum fehlen Registergericht und HRB-Nummer (Pflicht für eine GmbH). | Aufbewahrungsfristen ins Datenmodell (Anfragen 6 Monate, Berichte/Rechnungen 10 Jahre), nächtliche Löschroutine, Knöpfe „Auskunft erteilen" und „Kunde löschen", AV-Verträge mit Google und FastBill, Verarbeitungsverzeichnis. Registerdaten ins Impressum. | hoch |
| 14 | **Ein Passwort schützt den ganzen Betrieb.** Keine zweite Stufe, keine Sperre nach Fehlversuchen – und Anmeldungen werden nirgends protokolliert. Nach einem Vorfall ließe sich nicht einmal feststellen, ob jemand drin war. | **Zwei-Faktor-Pflicht** für alle Büro-Konten, Sperre nach Fehlversuchen, Anmeldeprotokoll in der Prüfspur. Gefährliche Aktionen mit erneuter Passwortabfrage. | mittel |

---

## 4. Betrieb: Damit V2 im Alltag trägt

| # | Lehre aus V1 | Empfehlung V2 | Priorität |
|---|---|---|---|
| 15 | **Nur eine Umgebung.** Es gibt ausschließlich die Produktion. Die Sicherheitsregeln wurden zum ersten Mal *im Echtbetrieb* geprüft. Eine falsche Zeile sperrt alle Monteure aus – mitten am Arbeitstag. | Zweites Firebase-Projekt als **Testumgebung** (kostenlos), Emulator lokal, Vorschau-Adressen mit Ablaufdatum für Kundenabnahmen. | kritisch |
| 16 | **Null automatische Tests.** Alle drei real gefundenen Fehlerarten (Doppelt-Speichern, fehlendes Escaping im PDF, Rechenfehler bei Restmengen/Einbehalt) sind reine Rechen- und Textlogik – sie wären mit wenigen Zeilen Prüfcode in Sekunden aufgefallen. | Bewusst **klein halten: ca. 50 schnelle Tests** für den Rechenkern (Restmenge, Einbehalt, §13b, Zahlenformat „120,50", Datum), die Datenhaltung (kein Duplikat, keine doppelte Nummer) und das Escaping. Dazu Regeltests im Emulator. Keine aufwendige Oberflächen-Automatisierung – die kostet hier mehr, als sie bringt. | hoch |
| 17 | **Fehler bleiben unsichtbar.** Stürzt beim Monteur eine Seite ab, erfährt das Büro es nur per Anruf. Es gibt kein Fehlerprotokoll und keine sichtbare Versionsnummer – man weiß nicht einmal, ob jemand den aktuellen Stand geladen hat. | Fehlerprotokoll in der Datenbank (Zeitpunkt, Nutzer, Seite, Meldung, Version), eine Zeile „Fehler letzte 7 Tage" im Dashboard, Versionskennung in der Fußzeile. | hoch |
| 18 | **Veröffentlichen ist Handarbeit.** Kein Deploy-Skript: Wer den Bauschritt vergisst, lädt klaglos den alten Stand erneut hoch – die Änderung *gilt* als veröffentlicht, ist es aber nicht. | Ein `npm run deploy`, das die ganze Kette erzwingt: sauberer Stand → Tests → beide Apps bauen → veröffentlichen → Version markieren und sichern. | hoch |
| 19 | **Die Dokumentation ist zur zweiten Wahrheit geworden.** Vier Dokumente beschreiben denselben Zustand und widersprechen sich – „Sind die Sicherheitsregeln aktiv?" wird dreimal unterschiedlich beantwortet. | **Ein** kurzes Betriebsdokument (zwei Seiten). Alles Zustandshafte gehört *in die App*: laufende Version, FastBill verbunden ja/nein, letzte Sicherung, Fehler der letzten Woche. Was die Anwendung über sich selbst anzeigt, kann sich nicht widersprechen. Fachliche Herleitungen (VOB, Baurecht) dürfen ausführlich bleiben. | mittel |

---

## 5. Zusammenarbeit: Was wir über die Arbeitsweise gelernt haben

**Lehre 20: Zwei Bearbeiter brauchen zwei Arbeitskopien, nicht zwei Absprachen.**
Zeitweise arbeiteten zwei KI-Agenten im selben Verzeichnis. Die Konfliktvermeidung lief über
Disziplinregeln in einer Textdatei („nur anhängen, nie umsortieren"). Das funktioniert genau so
lange, wie sich alle erinnern. → **V2:** Ein Zweig je Arbeitspaket, getrennte Arbeitskopien,
Zusammenführen erst wenn Tests und Bau grün sind. Dann löst das Werkzeug die Konflikte, statt dass
eine Textdatei sie verhindern muss.

**Lehre 21: Kleine Commits statt Arbeitstage.**
Einzelne Commits umfassten mehrere tausend Zeilen. Danach lässt sich nicht mehr sagen, welche
Änderung einen Fehler mitgebracht hat – Zurückrollen heißt dann, auch alles Funktionierende
wegzuwerfen. → **V2:** Ein Commit = ein abgeschlossener Gedanke.

**Lehre 22: Die beiden Prüfungen waren das Beste, was wir gemacht haben.**
Der Code-Review fand 13 echte Fehler, darunter die doppelte Abrechnung und den Schlüssel im
Programmpaket. Die baurechtliche Prüfung fand, dass die Berichte ohne Namen je Person, ohne
fortlaufende Nummern und ohne Anordnungsnachweis vor Gericht wenig wert gewesen wären. Beides
hätte man im Echtbetrieb teuer bezahlt. → **V2:** Prüfung nicht am Ende, sondern **nach jedem
größeren Paket** – und die Fachprüfung (Baurecht/Steuer) *vor* dem Bau der Formulare.

**Lehre 23: Fachliche Anforderungen zuerst, Technik danach.**
Was V1 wirklich gut macht, ist nicht die Technik, sondern das eingearbeitete Fachwissen. Die
teuersten Nacharbeiten entstanden dort, wo zuerst gebaut und danach gefragt wurde (Stunden je
Person, Vorbehalte im Abnahmeprotokoll, Nummernkreise). → **V2:** Erst mit dem Auftraggeber die
Dokumente festlegen, die am Ende herauskommen sollen – dann rückwärts das Datenmodell bauen.

---

## 6. Vorschlag: So bauen wir V2

**Reihenfolge ist wichtiger als Tempo.** Die ersten drei Pakete liefern keine sichtbare neue
Funktion – sie sind das Fundament, das V1 fehlt.

| Paket | Inhalt | Warum zuerst |
|---|---|---|
| **0 – Fundament** | Sauberes Datenmodell + Umbenennung, Feld-Schema an einer Stelle, i18n/Design/Dunkelmodus/Entwürfe von Anfang an, nur Firestore (Emulator zum Entwickeln) | Später wird jede dieser Änderungen mit jedem Monat Echtdaten teurer |
| **1 – Sicherheit** | Rollen über Anmelde-Token, Selbstregistrierung aus, FastBill über Server-Funktion, Prüfspur, 2FA fürs Büro | Bevor echte Kundendaten drin sind |
| **2 – Betrieb** | Test- und Produktivumgebung, Deploy-Skript, automatische Sicherung + Rückspielprobe, ca. 50 Tests, Fehlerprotokoll | Damit ab Tag 1 nichts verloren gehen kann |
| **3 – Fachlichkeit** | Übernahme aus V1: LV, Berichte, Abnahme, Stundenlisten, FastBill – aber auf dem neuen Fundament, mit den baurechtlichen Anforderungen von Anfang an | Das ist erprobt, hier ist wenig Risiko |
| **4 – Kundenwünsche** | Was Gabara aus dem Demo-Betrieb meldet | Jetzt erst, und auf stabilem Grund |
| **5 – Handy-App** | Flutter-App für die Monteure (Fork der MAM-App) | Wenn die Datenseite steht |

**Was aus V1 direkt übernommen werden kann:** die fachlichen Inhalte (LV-Logik, Berichtsaufbau
nach VOB, PDF-Vorlagen, Textbausteine), die Übersetzungen, die Wissensdatenbank, die
Prüf-Erkenntnisse – und dieses Dokument als Merkzettel.

**Was V1 bleibt:** ein laufendes Demo, mit dem Gabara den Alltag testen kann. Genau dafür wurde es
gebaut. Alles, was dabei an Wünschen und Ärgernissen auffällt, ist das Pflichtenheft für V2.

---

## 7. Der eine Satz zum Mitnehmen

> V1 hat bewiesen, **was** gebaut werden muss. V2 muss beweisen, dass es **trägt** – und das
> entscheidet sich in den ersten drei Paketen, bevor die erste neue Funktion entsteht.
