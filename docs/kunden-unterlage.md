# Gabara Baustellen-System — Unterlage für Kundengespräch und Anleitung

> Rohmaterial für Präsentation und Bedienungsanleitung.
> Stand 01.08.2026 · Alle Angaben aus dem laufenden System, nicht aus der Planung.
> Was noch nicht fertig ist, steht in Abschnitt 10 — bitte nicht versprechen.

---

## 1. In einem Satz

Ein Baustellen-System für den Malerbetrieb: Das Büro plant im Kalender, der Monteur
dokumentiert auf der Baustelle mit dem Handy, und aus derselben Erfassung entstehen
Stundenzettel und Rechnung — ohne dass irgendetwas zweimal getippt wird.

## 2. Wofür es gebaut ist

Gabara arbeitet überwiegend als Subunternehmer für Generalunternehmer. Damit hängen
drei Dinge zusammen, die auf Papier regelmäßig Geld kosten:

**Zusatzarbeiten ohne Nachweis.** Die Bauleitung ordnet auf der Baustelle etwas an,
das nicht im Leistungsverzeichnis steht. Nach § 15 Abs. 3 VOB/B müssen Stundenlohn-
arbeiten dem Auftraggeber **vor Beginn angezeigt** werden, und der Stundenlohnzettel
muss zeitnah eingereicht werden. Fehlt die Anzeige oder der Zettel, ist die Forderung
im Streitfall schwer durchzusetzen.

**Stunden, die am Monatsende rekonstruiert werden.** Wer den Zettel drei Wochen
später ausfüllt, schätzt. Das trifft die Lohnabrechnung und die
Berufsgenossenschaft gleichermaßen.

**Mengen, die niemand nachhält.** Ohne laufenden Abgleich zwischen vertraglicher
Menge (LV), tatsächlich geleisteter Menge und bereits abgerechneter Menge weiß am
Monatsende niemand genau, was noch offen ist.

Das System setzt an genau diesen drei Stellen an — nicht an der Buchhaltung, die
bleibt bei FastBill.

## 3. Der Weg einer Baustelle

```
Anfrage / Auftrag
      ↓
Kunde anlegen  (Typ: Generalunternehmer oder Privat, §13b oder 19 % USt)
      ↓
Baustelle anlegen  (Nummer P-2026-001 wird vorgeschlagen)
      ↓
Leistungsverzeichnis importieren  (CSV oder Text aus dem PDF)
      ↓
Einsätze im Kalender planen  (welche Kolonne, welche LV-Positionen)
      ↓
Monteur arbeitet und dokumentiert am Handy
      ↓
Büro gibt den Bericht frei   ← ab hier gesperrt, Beweiswert
      ↓
Stundenzettel je Mitarbeiter   +   Rechnung nach FastBill
```

Jede Stufe baut auf der vorigen auf. Was der Monteur einmal erfasst, wandert ohne
Abtippen in den Stundenzettel **und** in die Rechnung.

## 4. Zwei Ansichten, ein System

### Das Büro (am Rechner)

Vollzugriff. Startseite ist der **Kalender** — Wochenansicht, jede Kolonne in
eigener Farbe. Daneben Baustellen, Leistungsverzeichnisse, Berichte, Kunden,
Stundenlisten, Abrechnung und ein Dashboard mit dem Ergebnis je Baustelle.

### Der Monteur (am Handy)

Bewusst reduziert. Er sieht **nur seine eigenen Einsätze**, kann Berichte und
Spesen erfassen, Fotos aufnehmen und unterschreiben lassen. Er sieht keine Preise,
keine anderen Baustellen und keine Kundendaten. Es gibt nichts einzurichten — er
meldet sich an und ist in seiner Ansicht.

**Verkaufsargument:** Ein Monteur muss nichts lernen außer „Einsatz antippen,
Formular ausfüllen, einreichen". Die Reihenfolge gibt das Formular vor.

## 5. Die Bausteine im Einzelnen

### Kalender

Wochenansicht Montag bis Freitag, Samstag nur wenn gearbeitet wird. In eine freie
Fläche klicken legt einen Einsatz an — Tag und Uhrzeit sind schon eingetragen.
Baustelle wählen, Monteure antippen, fertig. Die Farbe eines Einsatzes richtet
sich nach dem **zuerst** zugewiesenen Monteur, so ist auf einen Blick zu sehen,
welche Kolonne wo ist.

Für Folgetage auf derselben Baustelle gibt es „Kopieren (+1 Tag)".

Überschneidungen sind erlaubt — mehrere Kolonnen arbeiten parallel; zwei Einsätze
zur selben Zeit stehen nebeneinander.

### Baustellen und Leistungsverzeichnis

Fünf Stufen: Offen → Beauftragt → In Arbeit → Abrechnung → Abgeschlossen.

Das LV wird importiert, nicht abgetippt: **CSV-Datei laden oder den Text aus dem
LV-PDF einfügen.** Die Spalten ordnet das System selbst zu. In der Vorschau steht
unten die LV-Summe — die hält man gegen die Endsumme auf dem Papier-LV. Stimmt sie,
wird übernommen.

Danach zeigt jede Position drei Mengen nebeneinander:

| | |
|---|---|
| **Soll** | was im Vertrag steht |
| **Ist** | was der Monteur gemeldet hat |
| **Abgerechnet** | was schon in einer Rechnung war |

Das ist der laufende Überblick, der auf Papier fehlt.

### Berichte und Nachweise

Drei Sorten, jede mit eigener fortlaufender Nummer:

- **Regiebericht** (RB-2026-001) — Stundenlohnarbeiten
- **Reklamation** (RK-…) — Mängelrüge mit Frist
- **Abnahme** (AB-…) — Teil- oder Gesamtabnahme mit Vorbehalten

Der Regiebericht ist der wichtigste. Das Formular fragt **zuerst** nach der
Anordnung: wer hat sie erteilt, wann, mündlich oder schriftlich. Damit ist die
Anzeige nach § 15 Abs. 3 VOB/B dokumentiert.

**„Einreichen" bleibt gesperrt**, solange nicht alle sechs Punkte stehen:

1. Baustelle gewählt
2. „Angeordnet durch …" eingetragen
3. mindestens ein Vorher-Foto
4. Arbeiten beschrieben
5. je Zeile Name und Stunden
6. mindestens ein Nachher-Foto

Darüber steht immer, was noch fehlt. Wer nicht fertig wird, speichert als Entwurf —
das geht jederzeit.

**Unterschrift auf dem Handy:** Ein Vollbild-Fenster mit großer Fläche. Der Kunde
unterschreibt mit dem Finger; die Unterschrift landet als Bild im Bericht und auf
dem Ausdruck.

### Freigabe und Sperre

```
Entwurf  →  Eingereicht  →  Freigegeben  🔒
```

- **Entwurf:** änderbar, zählt nirgends mit
- **Eingereicht:** liegt beim Büro, noch änderbar
- **Freigegeben:** gesperrt — auch für das Büro

Die Sperre ist Absicht: Ein Beweismittel, das sich nachträglich ändern lässt, ist
im Streitfall wertlos. Erst nach der Freigabe zählt ein Bericht für Stundenzettel
und Rechnung.

### Stundenlisten

Monatsauswahl, dann je Mitarbeiter ein **BG-Bau-konformer Stundenzettel als PDF**.
Jeder Kalendertag steht auf dem Blatt, auch die ohne Einsatz — wie auf dem
Papierzettel. „Alle drucken" erzeugt **ein** Dokument mit einer Seite je Mitarbeiter.

Die Pause wird nicht erfasst, sondern gerechnet: frühester Beginn bis spätestes
Ende minus gemeldete Arbeitsstunden. War jemand an einem Tag auf zwei Baustellen,
zählt die Fahrt dazwischen als Pause.

Unplausible Tage werden **gelb markiert und mit „× prüfen" gekennzeichnet** — auf
dem Bildschirm und im Ausdruck. Ein Zettel mit stillschweigend falschen Zahlen
wäre schlimmer als gar keiner.

Das Feld „Summe & Bemerkungen" bleibt bewusst leer für handschriftliche Ergänzungen
und die Unterschriften.

### Abrechnung

In eine Rechnung fließen drei Quellen zusammen:

- geleistete LV-Mengen
- freigegebene Regieberichte
- eingereichte Spesen

Die Rechnung geht an **FastBill** — dort bleiben Nummernkreis, Versand und
Mahnwesen. Das System liefert die Positionen, die Buchhaltung bleibt, wo sie ist.

Berücksichtigt werden dabei: **§ 13b UStG** (Reverse-Charge beim
Generalunternehmer, Rechnung ohne Umsatzsteuer), Zahlungsziel und
Sicherheitseinbehalt je Kunde.

### Kunden und Stammdaten

Je Kunde wird hinterlegt, ob Generalunternehmer oder Privat, ob §13b oder 19 % USt,
Zahlungsziel und Sicherheitseinbehalt. Das entscheidet später über die Rechnung —
ein Privatkunde bekommt keine §13b-Rechnung.

Weiter einstellbar: Mitarbeiter mit Team und Qualifikation (Facharbeiter oder
Helfer — daraus kommt der Regie-Stundensatz), Artikelstamm, Textbausteine,
Stundensätze, Arbeitszeiten.

## 6. Sechs Situationen aus dem Alltag

Diese stehen wortgleich in der eingebauten Wissensdatenbank — jede mit Schritten,
Warnungen und Zeichnung, auf Deutsch und Arabisch.

| Situation | Auslöser |
|---|---|
| **Neuer Auftrag ist da** | GU erteilt den Auftrag und schickt das LV |
| **Woche planen** | Freitagnachmittag: welche Kolonne fährt wohin |
| **Zusatzarbeiten belegen** | Bauleitung ordnet Arbeiten außerhalb des LV an |
| **Monatsende: Stunden ans Lohnbüro** | Lohnbüro braucht unterschriebene Zettel |
| **Abschlagsrechnung stellen** | Monatsende, Leistungsstand abrechnen |
| **Mangel gerügt** | Auftraggeber beanstandet eine Leistung |

**Verkaufsargument:** Die Anleitung ist im System, nicht in einem Ordner. Wer nicht
weiterweiß, tippt auf „Wissen" und findet seine Situation — in seiner Sprache.

## 7. Zweisprachig

Die komplette Verwaltung und die Handy-Ansicht gibt es auf **Deutsch und Arabisch**,
umschaltbar mit einem Knopf. Arabisch läuft mit richtiger Leserichtung von rechts
nach links — Menüs, Tabellen und auch die Zeichnungen in der Wissensdatenbank
drehen mit.

Das betrifft rund 800 Begriffe und 190 Wissenstexte, alle in beiden Sprachen
gepflegt.

**Verkaufsargument:** Ein Monteur, der auf der Baustelle Arabisch spricht, kann
dieselbe Dokumentation in seiner Sprache ausfüllen — der Ausdruck für den
Auftraggeber bleibt deutsch.

## 8. Helle und dunkle Darstellung

Umschaltbar zwischen hell, dunkel und „wie das Gerät". Die Wahl bleibt gespeichert.
Gedacht für lange Bürotage und für den Blick aufs Handy im Dunkeln.

## 9. Daten und Sicherheit

- Daten liegen bei **Google Firebase in Europa** (Frankfurt, europe-west3), nicht
  auf einem Rechner im Büro.
- Anmeldung mit E-Mail und Passwort. Es gibt **keine Selbstregistrierung** — Zugänge
  legt ausschließlich das Büro an.
- Wer was sehen darf, entscheidet der Server, nicht die App: Ein Monteur kommt
  **technisch** nicht an fremde Baustellen oder an Preise, auch nicht über Umwege.
- Freigegebene Berichte sind serverseitig schreibgeschützt.
- Fotos werden beim Aufnehmen verkleinert, damit auch mit Baustellen-Empfang
  hochgeladen werden kann.
- Die Verwaltung ist für Suchmaschinen gesperrt.

## 10. Stand — was läuft, was noch nicht

**Ehrlich halten. Das hier ist der Unterschied zwischen einem zufriedenen und einem
enttäuschten Kunden.**

### Läuft und ist geprüft

| | |
|---|---|
| Webseite und Verwaltung | online erreichbar |
| Kalender, Baustellen, LV-Import, Berichte, Freigabe | fertig |
| Stundenzettel als PDF | fertig, BG-Bau-konform |
| Handy-Ansicht für Monteure inkl. Unterschrift | fertig |
| FastBill-Anbindung | **echt angebunden und getestet** |
| Zweisprachigkeit Deutsch/Arabisch | vollständig |
| Wissensdatenbank im System | 30 Artikel, 6 Situationen, beide Sprachen |
| Hell/Dunkel | fertig |

### Noch offen

- **Impressum unvollständig:** Registergericht und Registernummer fehlen. Für eine
  GmbH sind sie nach § 5 TMG Pflicht. → Angaben vom Kunden anfordern.
- **Der durchgehende Praxistest** über alle Stufen mit echten Daten steht noch aus.
  Vor dem ersten Echtbetrieb einplanen.
- **Fotos in der Wissensdatenbank:** derzeit Zeichnungen, keine Bildschirmfotos.
- Der Statustext im Kalender bleibt beim Sprachwechsel deutsch (Kleinigkeit).

### Nicht enthalten

Damit keine Erwartung entsteht, die das System nicht erfüllt:

- Keine Buchhaltung — die bleibt bei FastBill.
- Keine Lohnabrechnung — die Stundenzettel gehen ans Lohnbüro.
- Keine Materialbestellung beim Lieferanten.
- Kein Offline-Betrieb auf dem Handy ohne jeden Empfang. Kurze Aussetzer fängt das
  System ab, ein Funkloch über Stunden nicht.

---

## 11. Vorschlag für den Aufbau der Präsentation

Zwölf Folien, etwa 20 Minuten. Die Reihenfolge folgt bewusst dem Arbeitsalltag des
Kunden, nicht dem Aufbau der Software.

| # | Folie | Kernsatz |
|---|---|---|
| 1 | Titel | „Baustellen-System für Gabara Service GmbH" |
| 2 | Das Problem | Drei Punkte aus Abschnitt 2 — Zusatzarbeiten, Stunden, Mengen |
| 3 | Der Weg einer Baustelle | Das Ablaufbild aus Abschnitt 3 |
| 4 | Büro und Monteur | Zwei Bildschirmfotos nebeneinander |
| 5 | Kalender | „Klick in den Tag, Kolonne antippen, fertig" |
| 6 | LV-Import | „Einmal importieren statt abtippen" — Soll/Ist/Abgerechnet zeigen |
| 7 | Regiebericht | Die sechs Pflichtpunkte, § 15 Abs. 3 VOB/B |
| 8 | Freigabe und Sperre | „Ein Beweis, der sich ändern lässt, ist keiner" |
| 9 | Stundenzettel | Ausdruck zeigen, Prüf-Markierung erwähnen |
| 10 | Abrechnung | Drei Quellen → eine Rechnung → FastBill |
| 11 | Zweisprachig | Denselben Bildschirm auf Arabisch zeigen |
| 12 | Stand und nächste Schritte | Abschnitt 10, ehrlich |

**Zur Vorführung:** Der beste Moment ist Folie 7 — den Regiebericht am Handy
ausfüllen und live zeigen, dass „Einreichen" gesperrt bleibt, bis das Vorher-Foto
da ist. Das erklärt in zehn Sekunden, warum die Dokumentation vollständig wird.

---

## 12. Kurzanleitung Büro (eine Seite)

**Morgens**
1. Kalender öffnen — das ist die Startseite.
2. Oben rechts die Glocke/Meldungen prüfen: neue Anfragen von der Webseite, neu
   eingereichte Berichte.

**Neue Baustelle**
1. Kunden prüfen oder anlegen — Typ und USt-Modus richtig setzen, das entscheidet
   später über die Rechnung.
2. Projekte → Neues Projekt.
3. In der Baustelle → Leistungsverzeichnis → LV importieren.
4. **LV-Summe gegen das Papier-LV halten**, bevor übernommen wird.

**Woche planen**
1. Im Kalender auf die kommende Woche blättern.
2. In den Tag klicken, Baustelle wählen, LV-Positionen ankreuzen, Monteure antippen.
3. Folgetage mit „Kopieren (+1 Tag)".
4. **Ohne zugewiesenen Monteur erscheint der Einsatz auf keinem Handy.**

**Berichte freigeben**
1. Berichte → Ansicht „Eingereicht".
2. Prüfen, dann „Freigeben". Danach ist er gesperrt — auch für dich.
3. Erst freigegebene Berichte zählen für Stundenzettel und Rechnung.

**Monatsende**
1. Berichte: alles Eingereichte freigeben.
2. Stundenlisten → Monat wählen → „Ganzer Monat".
3. Orange „× prüfen" abarbeiten, dann „Alle drucken".
4. Abrechnung → Rechnung erstellen → an FastBill übertragen.

---

## 13. Kurzanleitung Monteur (eine Seite)

**Anmelden** — E-Mail und Passwort vom Büro. Sprache oben umschaltbar.

**Der Tag**
1. Du siehst nur deine eigenen Einsätze. Heutige stehen oben.
2. Einsatz antippen → „Zur Baustelle".
3. Dort stehen die Aufgaben, die das Büro für heute angekreuzt hat.

**Regiebericht (Zusatzarbeiten)**
1. **Zuerst:** wer hat die Arbeiten angeordnet, wann, mündlich oder schriftlich.
2. Vorher-Foto aufnehmen.
3. Beschreiben, was gemacht wurde.
4. Je Person eine Zeile: Name, Datum, Von, Bis. Die Stunden rechnen sich selbst.
5. Material über „+ Artikel hinzufügen".
6. Nachher-Foto.
7. Unterschreiben lassen — auf „Zum Unterschreiben tippen", dann mit dem Finger.
8. „Einreichen".

**Wenn „Einreichen" grau bleibt:** Über dem Knopf steht, was noch fehlt.

**Nicht fertig geworden?** „Als Entwurf speichern" — geht immer, auch mit halb
ausgefülltem Formular.

**Spesen** — Hotel oder Fahrt mit Beleg-Foto, unter „Spesen".

**Wichtig:** Fotos gehen erst, wenn oben die Baustelle gewählt ist.

---

*Quelle: laufendes System, Stand 01.08.2026. Technische Einzelheiten in
`docs/projekt-dokumentation.md`.*
