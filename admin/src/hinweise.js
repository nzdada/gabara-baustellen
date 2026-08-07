// Erklärtexte für die Info-Zeichen in der Büro-Verwaltung.
// Regel: ein bis zwei Sätze, die sagen WOHIN der Wert fließt und was davon
// für die ABRECHNUNG zählt. Zentral hier, damit die Formulierungen einheitlich
// bleiben und an einer Stelle gepflegt werden.

export const HINWEIS = {
  // ---------- Leistungsverzeichnis ----------
  lvMenge: 'Vertraglich vereinbarte Menge. Im Rechnungs-Assistenten ist sie die Obergrenze der Spalte „Rest lt. LV" – mehr sollte nur nach Nachtrag abgerechnet werden.',
  lvEp: 'Netto-Einheitspreis laut Leistungsverzeichnis. Er wird beim Abrechnen unverändert in die Rechnungsposition und von dort nach FastBill übernommen.',
  lvIst: 'Bereits geleistete Menge, normalerweise vom Monteur über die Handy-Ansicht gemeldet. Sie ist im Rechnungs-Assistenten die Vorbelegung der nächsten Abschlagsrechnung.',
  lvProzent: 'Baufortschritt der Position: Ist-Menge geteilt durch Soll-Menge. Reine Anzeige – für die Rechnung zählt die Ist-Menge, nicht der Prozentwert.',

  // ---------- LV-Import ----------
  importEp: 'Preis je Mengeneinheit, nicht der Gesamtbetrag der Zeile. Wird versehentlich die Gesamtpreis-Spalte zugeordnet, ist jede spätere Rechnung um den Faktor der Menge zu hoch.',
  importTyp: 'Optionale Spalte zur Unterscheidung von Überschriften und abrechenbaren Zeilen. Erkannt werden Titel, Überschrift, Gruppe und Los als Titel sowie Pos und Position als Position – ohne Zuordnung entscheidet die Automatik.',
  importErsetzen: 'Ersetzt das komplette Leistungsverzeichnis. Dabei gehen auch die gemeldeten Ist-Mengen und der bereits abgerechnete Stand der alten Positionen verloren.',

  // ---------- Rechnungs-Assistent ----------
  rechnungMonteur: 'Vom Monteur auf der Baustelle gemeldete Menge, die noch nicht fakturiert ist. Ein Strich bedeutet: für diese Position liegt noch keine Meldung vor.',
  rechnungRest: 'Vertraglich noch offene Menge: Soll-Menge minus bereits abgerechneter Menge. Bis hierhin lässt sich ohne Nachtrag fakturieren.',
  rechnungAbrechnen: 'Diese Menge geht als Rechnungsposition nach FastBill und wird anschließend im LV als abgerechnet fortgeschrieben. Gelb markiert heißt: mehr als der Monteur gemeldet hat.',
  rechnungTitel: 'Überschrift der Rechnung in FastBill – üblich sind „Abschlagsrechnung Nr. x", „Schlussrechnung" oder der Baustellenname.',
  rechnungZeitraum: 'Zeitraum der erbrachten Leistung. Er steht als Leistungsdatum auf der FastBill-Rechnung und ist bei §13b-Rechnungen Pflichtangabe.',
  rechnungEinbehalt: 'Anteil des Bruttobetrags, den der Auftraggeber bis zur Abnahme einbehält. Der Wert wird nur hier vermerkt – die FastBill-Rechnung lautet über den vollen Betrag.',
  rechnungFrei: 'Position ohne Bezug zu LV, Bericht oder Spesen, zum Beispiel eine Nachtragsleistung. Sie wird nirgends fortgeschrieben und lässt sich beim nächsten Mal erneut abrechnen.',

  // ---------- Kunden ----------
  kundeTyp: 'Generalunternehmer oder Privatkunde. Beim Neuanlegen setzt der Typ die Abrechnungs-Vorgaben; bei bestehenden Kunden bleiben USt-Modus, Zahlungsziel und Einbehalt unverändert.',
  kundeUst: 'Steuert, ob die Rechnung mit 19 % USt oder netto nach §13b UStG erstellt wird. Bei §13b geht zusätzlich der Reverse-Charge-Hinweis auf die FastBill-Rechnung.',
  kundeZahlungsziel: 'Notiz zur Vertragskondition. Das tatsächliche Zahlungsziel und das Mahnwesen steuert FastBill.',
  kundeEinbehalt: 'Standard-Einbehalt dieses Auftraggebers. Er wird im Rechnungs-Assistenten vorbelegt und lässt sich dort je Rechnung ändern.',
  kundePlzOrt: 'Format „86150 Augsburg" – beim Übertragen nach FastBill wird die führende Postleitzahl abgetrennt.',

  // ---------- Projekte ----------
  projektVolumen: 'Geschätzte Auftragssumme ohne USt. Sie dient der Fortschrittsanzeige, solange kein Leistungsverzeichnis erfasst ist – sobald ein LV vorliegt, rechnet die App mit der LV-Summe.',
  projektEnde: 'Geplantes Bauende. Liegt es in der Vergangenheit und ist die Baustelle noch nicht abgeschlossen, erscheint sie in der Liste als überfällig.',
  projektGewerk: 'Leistungsart der Baustelle, zum Beispiel Malerarbeiten. Der Text erscheint im Kopf des gedruckten Arbeitsauftrags.',
  projektNummer: 'Eindeutige Kennung der Baustelle. Sie erscheint auf Berichten, Arbeitsaufträgen und Rechnungen – bitte nicht doppelt vergeben.',

  // ---------- Termin ----------
  terminKategorie: 'Steuert Farbe und Filterung im Kalender. Umsetzung und Fertigstellung sind Baustellentermine, Reklamationsarbeit kennzeichnet Nacharbeit ohne eigenen Auftrag.',
  terminAufgaben: 'Auswahl aus dem Leistungsverzeichnis der Baustelle. Die angehakten Positionen erscheinen als Aufgabenliste auf dem gedruckten Arbeitsauftrag; ohne Auswahl werden alle Positionen gedruckt.',
  terminMitarbeiter: 'Nur zugewiesene Mitarbeiter sehen den Einsatz in ihrer Handy-Ansicht. Der erste Name bestimmt zugleich Team und Farbe der Karte im Kalender.',

  // ---------- Einstellungen ----------
  einstAnschrift: 'Firmenanschrift für Berichte, Protokolle und Arbeitsaufträge. Sie ist zugleich die Start-Adresse der automatischen Km-Berechnung bei Fahrtspesen.',
  einstUstStandard: 'Vorbelegung des USt-Modus beim Anlegen eines neuen Kunden. Bereits angelegte Kunden bleiben unverändert.',
  einstZahlungsziel: 'Vorgabewerte für neu angelegte Geschäftskunden. Für die Abrechnung zählt immer der Wert am jeweiligen Kunden.',
  einstTeam: 'Frei wählbarer Name der Kolonne. Er steuert Farbe und Legende im Kalender sowie die Gruppierung in der Tagesplanung.',
  einstQualifikation: 'Entscheidet, welcher Regie-Stundensatz im Bericht gezogen wird – und damit, was bei Stundenlohnarbeiten abgerechnet wird.',
  einstStundensatzIntern: 'Eigene Lohnkosten je Stunde. Der Wert dient nur der Margen-Auswertung im Dashboard und steht auf keiner Rechnung.',
  einstRegieSaetze: 'Regie-Stundensätze für neue Berichtszeilen. Bereits erfasste Regieberichte behalten den Satz, der bei der Erfassung galt.',
  einstKmSatz: 'Vorbelegung für neue Spesenbelege vom Typ Fahrt. Im einzelnen Beleg lässt sich der Satz überschreiben.',
  einstEkPreis: 'Einkaufspreis. Er steht auf keiner Rechnung und dient nur der Margen-Auswertung im Dashboard.',

  einstUid: 'Die UID aus Firebase → Authentication → Users. Sie wird zur Dokument-ID dieses Mitarbeiters – nur daran erkennt die Datenbank beim Schreiben, ob jemand Büro oder Monteur ist. Ohne UID darf das Konto beim Anmelden ALLES ändern, auch Preise und Rechnungen.',

  stundenFreigabe: 'Ohne Haken fällt die Statusprüfung ganz weg – dann zählen auch ENTWÜRFE mit, nicht nur eingereichte Berichte. Für einen Stundenzettel, der ans Lohnbüro oder an die BG geht, sollten nur freigegebene Stunden drinstehen – die sind vom Büro geprüft.',
}
