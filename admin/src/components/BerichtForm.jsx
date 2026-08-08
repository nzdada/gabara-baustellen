import { useRef, useState } from 'react'
import { komprimiere } from '@shared/bild.js'
import { istMonteurRolle } from '@shared/auth.js'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { UnterschriftFeld, unterschriftAlsDataUrl } from '@shared/unterschrift.jsx'
import { euro } from '@shared/format.js'
import { useLang, t } from '@shared/i18n.js'
import { useEntwurf } from '@shared/entwurf.js'
import EntwurfHinweis from './EntwurfHinweis.jsx'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'
import { heuteISO } from '@shared/slots.js'
import { parseZahl } from '../csv.js'
import { neueFahrt, kmVon, betragVon, summeFahrten, fahrtPruefung, fahrtBegonnen, bekannteKennzeichen, rueckfahrtVon, istRueckfahrt, hatRueckfahrt, mitAbleitung, KM_SATZ_STANDARD } from '@shared/fahrten.js'

// Berichts-Erfassung nach dem Aufbau der mam_solar-Feldprotokolle
// (assets/protocols/work_order.md): nummerierte Abschnitts-Karten, getrennte
// Vorher-/Nachher-Foto-Sektionen, Arbeitszeit JE PERSON mit Datum + Von/Bis
// (= gerichtsfester Stundenlohnzettel nach VOB/B § 15 Abs. 3), Unterschriften.
//
// Gerichtsfestigkeit:
// - fortlaufende Berichtsnummer (RB-/RK-/AB-JJJJ-NNN) aus settings/nummernkreis
// - Regie: Anordnung/Anzeige VOR Beginn dokumentiert (VOB/B § 15 Abs. 3)
// - Abnahme: Gegenstand (Teil-/Gesamtabnahme), Vorbehalte (Vertragsstrafe § 11),
//   Unterschriften beider Seiten mit Funktion/Firma
// - freigegebene/abgerechnete Berichte sind GESPERRT (Beweiswert!)

const TITEL_SCHLUESSEL = { regie: 'bf.titelRegie', reklamation: 'bf.titelReklamation', abnahme: 'bf.titelAbnahme' }
const NUMMER_PREFIX = { regie: 'RB', reklamation: 'RK', abnahme: 'AB' }

// Lokales Datum (NICHT toISOString – das liefert UTC und nachts das Vortagsdatum)
const heuteIso = heuteISO

// Stunden aus Von/Bis (z. B. 07:00–15:30 -> 8.5)
function dauerStunden(von, bis) {
  if (!von || !bis) return 0
  const [h1, m1] = von.split(':').map(Number)
  const [h2, m2] = bis.split(':').map(Number)
  return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10)
}

// Gegenrichtung: aus Von + Stundenzahl die Bis-Uhrzeit rechnen (07:00 + 8,5 -> 15:30)
function bisAus(von, stunden) {
  const std = Number(String(stunden).replace(',', '.'))
  if (!von || !Number.isFinite(std) || std <= 0) return ''
  const [h, m] = von.split(':').map(Number)
  const gesamt = Math.round(h * 60 + m + std * 60)
  const tagesMinuten = Math.min(gesamt, 23 * 60 + 59)
  return `${String(Math.floor(tagesMinuten / 60)).padStart(2, '0')}:${String(tagesMinuten % 60).padStart(2, '0')}`
}

// Qualifikation eines Mitarbeiters aus den Stammdaten (Fallback: Facharbeiter)
function qualiVon(user) {
  return user?.qualifikation === 'helfer' ? 'helfer' : 'facharbeiter'
}

const QUALI_SCHLUESSEL = { facharbeiter: 'einst.facharbeiter', helfer: 'einst.helfer' }


// Fortlaufende Berichtsnummer vergeben. Der Zähler wird im Store ATOMAR
// hochgezählt (Firebase: runTransaction) – zwei gleichzeitig einreichende
// Monteure bekommen so garantiert verschiedene Nummern. Das ist beim
// Stundennachweis nach § 15 Abs. 3 VOB/B beweisrelevant.
async function neueBerichtsnummer(typ) {
  return withStore(async (s) => {
    const { jahr, laufend } = await s.naechsteNummer('bericht')
    return `${NUMMER_PREFIX[typ] || 'B'}-${jahr}-${String(laufend).padStart(3, '0')}`
  })
}

// Abschnitts-Karte im mam_solar-Stil: Nummer + Titel, darunter der Inhalt
function Sektion({ nr, titel, pflicht = false, erfuellt = true, children }) {
  return (
    <section className="bg-karte border border-rahmen rounded-karte overflow-hidden">
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${pflicht && !erfuellt ? 'bg-amber-50 border-amber-200' : 'bg-gedeckt border-rahmen'}`}>
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
          pflicht && !erfuellt ? 'bg-amber-400 text-white' : 'bg-praxis-600 text-white'
        }`}>{nr}</span>
        <p className="text-sm font-bold text-schrift-stark">{titel}</p>
        {pflicht && (
          <span className={`ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 ${erfuellt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {t(erfuellt ? 'allg.ok' : 'allg.pflicht')}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default function BerichtForm({ typ, projektId = '', bericht = null, user, onClose }) {
  useLang()
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const katalog = useCollection('katalog')
  const einst = useEinstellungen()
  // Kennzeichen selbstlernend: Was schon einmal eingetragen wurde, wird beim
  // naechsten Mal vorgeschlagen. Ein gepflegter Fuhrpark waere sauberer,
  // muesste aber erst angelegt werden – und bis dahin tippt jeder anders.
  const alleBerichte = useCollection('berichte')
  // Fuhrpark aus den Einstellungen. Solange dort nichts gepflegt ist, dienen
  // die bereits verwendeten Kennzeichen als Rückfall – sonst wäre die Erfassung
  // blockiert, bis jemand die Liste anlegt.
  const fuhrpark = Array.isArray(einst.fahrzeuge) ? einst.fahrzeuge.filter((f) => f.kennzeichen) : []
  const kennzeichenListe = fuhrpark.length
    ? fuhrpark.map((f) => f.kennzeichen)
    : bekannteKennzeichen(alleBerichte)

  const gesperrt = Boolean(bericht && ['freigegeben', 'abgerechnet'].includes(bericht.status))
  // Monteure duerfen Berichte ausschliesslich unter eigenem Namen anlegen –
  // so verlangt es firestore.rules. Das Feld deshalb gar nicht erst oeffnen.
  const nurEigene = istMonteurRolle(user?.rolle)

  const draftId = useRef(bericht?.id || (crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`))
  const docAngelegt = useRef(Boolean(bericht))
  const nummerRef = useRef(bericht?.nummer || '')
  const fotos = useWhere('photos', 'berichtId', draftId.current)
  const lvPositionen = useWhere('lvpositionen', 'projektId', bericht?.projektId || projektId || '')

  const monteurUser = users.find((u) => u.id === (bericht?.mitarbeiterId || user?.userId))
  const monteurName = monteurUser?.name || user?.name || ''

  // Stundensatz kommt aus den Stammdaten (Einstellungen → Sätze), NICHT aus einem
  // Dropdown im Bericht – die Qualifikation des Mitarbeiters entscheidet.
  const satzFuer = (art) => Number(art === 'helfer' ? (einst.regieHelfer ?? 31) : (einst.regieFacharbeiter ?? 35)) || 0

  const [daten, setDaten] = useState(() => ({
    projektId: bericht?.projektId || projektId || '',
    datum: bericht?.datum || heuteIso(),
    mitarbeiterId: bericht?.mitarbeiterId || user?.userId || '',
    beschreibung: bericht?.beschreibung || '',
    // Regie: Anordnung der Stundenlohnarbeiten (VOB/B § 15 Abs. 3 – Anzeige VOR Beginn)
    angeordnetDurch: bericht?.angeordnetDurch || '',
    angeordnetAm: bericht?.angeordnetAm || (bericht?.datum || heuteIso()),
    anzeigeArt: bericht?.anzeigeArt || 'muendlich',
    // Reklamation
    ursache: bericht?.ursache || '',
    massnahme: bericht?.massnahme || '',
    geruegtDurch: bericht?.geruegtDurch || '',
    ruegeZugangAm: bericht?.ruegeZugangAm || '',
    fristBis: bericht?.fristBis || '',
    // Abnahme
    abnahmeArt: bericht?.abnahmeArt || 'gesamt',
    leistungsumfang: bericht?.leistungsumfang || '',
    ohneMaengel: bericht?.ohneMaengel ?? true,
    maengel: bericht?.maengel || [],
    ort: bericht?.ort || '',
    vorbehaltVertragsstrafe: bericht?.vorbehaltVertragsstrafe ?? null, // Pflicht-Entscheidung ja/nein
    vorbehalteSonstige: bericht?.vorbehalteSonstige || '',
    // AP 9 (Plan 7.7): auch „keine sonstigen Vorbehalte" muss AKTIV gewählt
    // werden – ein leeres Feld druckt sonst „keine Angabe" und lädt den
    // Auftraggeber ein, später mündliche Vorbehalte zu behaupten.
    vorbehalteSonstigeKeine: bericht?.vorbehalteSonstigeKeine ?? (bericht?.vorbehalteSonstige ? false : null),
    // Unterschriften
    unterschriftName: bericht?.unterschriftName || '',
    unterschriftFunktion: bericht?.unterschriftFunktion || '',
    unterschriftFirma: bericht?.unterschriftFirma || '',
    // Die BILDER der Unterschriften wandern MIT in die Entwurfssicherung
    // (AP 6, Plan 5.4): vorher lebten sie nur im Canvas-Zustand und waren
    // nach jedem Neuladen weg – ausgerechnet das Mühsamste am Formular.
    unterschriftKundeBild: bericht?.unterschriftKunde || '',
    unterschriftMonteurBild: bericht?.unterschriftMonteur || '',
    // Arbeitszeit wie mam_solar: je Person mit Datum + Von/Bis
    stunden: bericht?.stunden?.length
      ? bericht.stunden.map((z) => ({
          userId: z.userId || '',
          name: z.name || '', datum: z.datum || bericht?.datum || heuteIso(),
          art: z.art || 'facharbeiter', von: z.von || '', bis: z.bis || '',
          anzahl: z.anzahl ?? 0, satz: z.satz ?? 35,
        }))
      : (typ === 'regie'
          ? [{
              userId: monteurUser?.id || '', name: monteurName, datum: heuteIso(),
              art: qualiVon(monteurUser), von: '07:00', bis: '16:00',
              anzahl: dauerStunden('07:00', '16:00'),
              satz: Number(qualiVon(monteurUser) === 'helfer' ? (einst.regieHelfer ?? 31) : (einst.regieFacharbeiter ?? 35)) || 0,
            }]
          : []),
    material: bericht?.material || [],
    fahrten: bericht?.fahrten || [],
  }))
  const [kundeCanvas, setKundeCanvas] = useState(null)
  const [monteurCanvas, setMonteurCanvas] = useState(null)
  const [alteKunde, setAlteKunde] = useState(bericht?.unterschriftKunde || '')
  const [alteMonteur, setAlteMonteur] = useState(bericht?.unterschriftMonteur || '')

  // Unterschrift gezeichnet -> Canvas merken UND als Bild in den
  // Formularzustand legen, damit die Entwurfssicherung sie mitnimmt
  // (AP 6: kundeCanvas/monteurCanvas gehören in den Entwurf).
  function kundeGezeichnet(canvas) {
    setKundeCanvas(canvas)
    setDaten((d) => ({ ...d, unterschriftKundeBild: canvas ? unterschriftAlsDataUrl(canvas) : '' }))
  }
  function monteurGezeichnet(canvas) {
    setMonteurCanvas(canvas)
    setDaten((d) => ({ ...d, unterschriftMonteurBild: canvas ? unterschriftAlsDataUrl(canvas) : '' }))
  }
  const [fehler, setFehler] = useState('')
  const [ladeFoto, setLadeFoto] = useState('')
  const kameraRefs = { vorher: useRef(null), nachher: useRef(null) }
  const dateiRefs = { vorher: useRef(null), nachher: useRef(null) }

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  const stundenSumme = daten.stunden.reduce((s, z) => s + parseZahl(z.anzahl) * (parseZahl(z.satz) || satzFuer(z.art)), 0)
  // parseZahl statt Number: Das Mengenfeld ist ein TEXTfeld (damit "8,5" auch
  // auf dem Handy tippbar ist). Number("8,5") ist NaN und wurde still zu 0 –
  // die angezeigte Summe stimmte dann nicht mit der gespeicherten überein.
  const materialSumme = daten.material.reduce((s, z) => s + parseZahl(z.menge) * parseZahl(z.preis), 0)
  // Rückfahrten holen Fahrzeug, Fahrer und Adressen aus ihrer Hinfahrt – hier
  // einmal zentral, damit Anzeige, Summe und Speicherung dieselbe Wahrheit sehen.
  const fahrten = mitAbleitung(daten.fahrten)
  const fahrtSumme = summeFahrten(fahrten)
  // Fahrten mit Luecken blockieren das Einreichen nicht, werden aber benannt.
  // Ein fehlendes Kennzeichen macht den Nachweis wertlos, ein Zahlendreher im
  // Tacho eine Fahrt unsichtbar – beides muss auffallen, bevor der Bericht raus
  // ist, nicht erst beim Auftraggeber.
  const fahrtMaengel = fahrten
    .map((f, i) => ({ i, ...fahrtPruefung(f) }))
    .filter((x) => !x.ok)

  const fotosVorher = fotos.filter((f) => f.phase === 'vorher')
  const fotosNachher = fotos.filter((f) => f.phase === 'nachher')
  const kundeDa = Boolean(kundeCanvas || alteKunde || daten.unterschriftKundeBild)
  const monteurDa = Boolean(monteurCanvas || alteMonteur || daten.unterschriftMonteurBild)
  const stundenOk = typ !== 'regie' || (daten.stunden.length > 0 && daten.stunden.every((z) => z.name.trim() && (Number(z.anzahl) || 0) > 0))
  const anordnungOk = typ !== 'regie' || Boolean(daten.angeordnetDurch.trim())
  const abnahmeUnterschriftenOk = typ !== 'abnahme'
    || (kundeDa && monteurDa && daten.unterschriftName.trim() && daten.unterschriftFunktion.trim())
  const vorbehaltOk = typ !== 'abnahme'
    || (daten.vorbehaltVertragsstrafe !== null
      && (daten.vorbehalteSonstigeKeine === true || Boolean(daten.vorbehalteSonstige.trim())))
  const einreichenOk = daten.projektId && daten.beschreibung.trim()
    && fotosVorher.length >= 1 && fotosNachher.length >= 1
    && stundenOk && anordnungOk && abnahmeUnterschriftenOk && vorbehaltOk

  function gateHinweis() {
    const teile = []
    if (!daten.projektId) teile.push(t('bf.gateProjekt'))
    if (typ === 'regie' && !anordnungOk) teile.push(t('bf.gateAnordnung'))
    if (fotosVorher.length < 1) teile.push(t('bf.gateVorher'))
    if (!daten.beschreibung.trim()) teile.push(t('allg.beschreibung'))
    if (typ === 'regie' && !stundenOk) teile.push(t('bf.gateStunden'))
    if (fotosNachher.length < 1) teile.push(t('bf.gateNachher'))
    if (typ === 'abnahme' && daten.vorbehaltVertragsstrafe === null) teile.push(t('bf.gateVorbehalt'))
    if (typ === 'abnahme' && daten.vorbehaltVertragsstrafe !== null && !vorbehaltOk) teile.push(t('abn.gateSonstige'))
    if (typ === 'abnahme' && (!kundeDa || !daten.unterschriftName.trim() || !daten.unterschriftFunktion.trim())) teile.push(t('bf.gateKundeUnterschrift'))
    if (typ === 'abnahme' && !monteurDa) teile.push(t('bf.gateMonteurUnterschrift'))
    return teile.join(' · ')
  }

  async function stelleDocSicher() {
    if (docAngelegt.current) return
    docAngelegt.current = true
    if (!nummerRef.current) nummerRef.current = await neueBerichtsnummer(typ)
    await withStore((s) => s.add('berichte', {
      id: draftId.current, typ, nummer: nummerRef.current,
      projektId: daten.projektId, terminId: bericht?.terminId || '',
      mitarbeiterId: daten.mitarbeiterId, mitarbeiterName: mitarbeiter?.name || user?.name || '',
      datum: daten.datum, status: 'entwurf', beschreibung: daten.beschreibung,
      createdAt: Date.now(), eingereichtAm: 0,
    }))
  }

  async function fotoHinzu(phase, e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    if (!daten.projektId) { setFehler(t('bf.fehlerProjektZuerst')); return }
    setFehler('')
    setLadeFoto(phase)
    try {
      for (const datei of dateien) {
        if (!datei.type.startsWith('image/')) { setFehler(t('bf.fehlerKeinBild', { name: datei.name })); continue }
        const dataUrl = await komprimiere(datei)
        if (dataUrl.length > 950000) { setFehler(t('bf.fehlerZuGross')); continue }
        await stelleDocSicher()
        await withStore((s) => s.add('photos', {
          projektId: daten.projektId, berichtId: draftId.current, terminId: bericht?.terminId || '',
          phase, dataUrl, name: datei.name,
          // von = Anzeigename, vonId = Konto-ID (die Firestore-Regel prüft die ID)
          von: user?.name || '', vonId: user?.userId || '', createdAt: Date.now(),
        }))
      }
    } catch (err) {
      setFehler(err.message || t('bf.fehlerBild'))
    } finally {
      setLadeFoto('')
    }
  }

  async function fotoLoeschen(foto) {
    if (gesperrt) return
    if (!confirm(t('bf.fotoLoeschenFrage'))) return
    await withStore((s) => s.remove('photos', foto.id))
  }

  async function speichern(status) {
    if (gesperrt) { setFehler(t('bf.fehlerGesperrt')); return }
    if (!daten.projektId) { setFehler(t('bf.fehlerProjekt')); return }
    if (status === 'eingereicht' && !einreichenOk) { setFehler(t('bf.fehltNoch', { text: gateHinweis() })); return }
    if (!nummerRef.current) nummerRef.current = await neueBerichtsnummer(typ)
    // Reihenfolge: frisch gezeichnet > bestehende Unterschrift am Bericht >
    // aus dem Entwurf wiederhergestelltes Bild (überlebt das Neuladen).
    const unterschriftKunde = kundeCanvas ? unterschriftAlsDataUrl(kundeCanvas) : (alteKunde || daten.unterschriftKundeBild)
    const unterschriftMonteur = monteurCanvas ? unterschriftAlsDataUrl(monteurCanvas) : (alteMonteur || daten.unterschriftMonteurBild)
    const doc = {
      id: draftId.current, typ, nummer: nummerRef.current,
      projektId: daten.projektId, terminId: bericht?.terminId || '',
      mitarbeiterId: daten.mitarbeiterId, mitarbeiterName: mitarbeiter?.name || user?.name || '',
      datum: daten.datum, status,
      beschreibung: daten.beschreibung,
      unterschriftKunde, unterschriftName: daten.unterschriftName,
      unterschriftFunktion: daten.unterschriftFunktion, unterschriftFirma: daten.unterschriftFirma,
      unterschriftMonteur,
      createdAt: bericht?.createdAt || Date.now(),
      eingereichtAm: status === 'eingereicht' ? Date.now() : (bericht?.eingereichtAm || 0),
      eingereichtVon: status === 'eingereicht' ? (user?.name || '') : (bericht?.eingereichtVon || ''),
      ...(typ === 'regie' ? {
        angeordnetDurch: daten.angeordnetDurch, angeordnetAm: daten.angeordnetAm, anzeigeArt: daten.anzeigeArt,
        stunden: daten.stunden.map((z) => ({
          userId: z.userId || '', name: z.name, datum: z.datum, art: z.art,
          // parseZahl statt Number: bei "8,5" liefert ein Zahlenfeld einen LEEREN
          // Wert, Number('') ergibt 0 – die Stunden waeren still verschwunden.
          // Genau dieselbe Falle wie im Meldefeld des Monteurs.
          von: z.von, bis: z.bis, anzahl: parseZahl(z.anzahl) || 0,
          satz: parseZahl(z.satz) || satzFuer(z.art),
        })),
        material: daten.material.map((z) => ({ artikelId: z.artikelId || '', name: z.name, menge: parseZahl(z.menge) || 0, einheit: z.einheit || '', preis: parseZahl(z.preis) || 0 })),
        // parseZahl auch hier: Ein Tachostand "123.456" wuerde als 123,456
        // gelesen und die Fahrt auf 0 km schrumpfen.
        // mitAbleitung() sorgt dafür, dass in der Datenbank nie etwas anderes
        // steht als auf dem Bildschirm: Eine Rückfahrt bekommt Fahrzeug, Fahrer
        // und die getauschten Adressen frisch aus ihrer Hinfahrt.
        fahrten: mitAbleitung(daten.fahrten).map((f) => ({
          id: f.id,
          datum: f.datum || daten.datum,
          kennzeichen: String(f.kennzeichen || '').trim().toUpperCase(),
          fahrzeug: f.fahrzeug || '',
          fahrer: f.fahrer || '',
          von: f.von || '',
          nach: f.nach || '',
          // parseZahl statt Number: "12,5" liefert in einem Zahlenfeld einen
          // LEEREN Wert, Number('') ergibt 0 – die Strecke wäre still weg.
          km: parseZahl(f.km) || 0,
          satz: parseZahl(f.satz) || 0,
          berechnen: f.berechnen !== false,
          ausFahrt: f.ausFahrt || '',
          zweck: f.zweck || '',
        })),
      } : {}),
      ...(typ === 'reklamation' ? {
        ursache: daten.ursache, massnahme: daten.massnahme,
        geruegtDurch: daten.geruegtDurch, ruegeZugangAm: daten.ruegeZugangAm, fristBis: daten.fristBis,
      } : {}),
      ...(typ === 'abnahme' ? {
        abnahmeArt: daten.abnahmeArt, leistungsumfang: daten.leistungsumfang,
        ohneMaengel: daten.ohneMaengel,
        maengel: daten.ohneMaengel ? [] : daten.maengel.filter((m) => m.text?.trim()),
        ort: daten.ort || projekt?.anschrift?.plzOrt || '',
        vorbehaltVertragsstrafe: daten.vorbehaltVertragsstrafe,
        vorbehalteSonstige: daten.vorbehalteSonstige,
        vorbehalteSonstigeKeine: daten.vorbehalteSonstigeKeine === true && !daten.vorbehalteSonstige.trim(),
        // Mängelrüge: maßgeblich ist der ZUGANG, nicht die Erstellung
        ruegeZugangAm: daten.ohneMaengel ? '' : (daten.ruegeZugangAm || ''),
      } : {}),
    }
    try {
      docAngelegt.current = true
      await withStore((s) => s.add('berichte', doc))
      // AP 9 (Plan 6.2): Der Regiebericht schreibt seine Stundenzeilen beim
      // EINREICHEN zusätzlich in die Sammlung `stunden` – dieselbe Quelle,
      // aus der Stundenzettel und CSV gebaut werden. Deterministische
      // Kennung std-<person>-<datum>-<projekt>-regie: Wiederholen ERSETZT,
      // mehrere Zeilen derselben Person am selben Tag werden vorher
      // ZUSAMMENGEFASST (sonst gewänne still die letzte).
      if (typ === 'regie' && status === 'eingereicht') {
        const jeTag = new Map()
        for (const z of doc.stunden) {
          const person = (z.userId || z.name || '').trim()
          if (!person || !(Number(z.anzahl) > 0)) continue
          const kennung = person.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          const key = `${kennung}|${z.datum || doc.datum}`
          const alt = jeTag.get(key)
          if (alt) {
            alt.stundenGesamt = Math.round((alt.stundenGesamt + z.anzahl) * 100) / 100
            alt.von = [alt.von, z.von].filter(Boolean).sort()[0] || ''
            alt.bis = [alt.bis, z.bis].filter(Boolean).sort().slice(-1)[0] || ''
          } else {
            jeTag.set(key, {
              id: `std-${kennung}-${z.datum || doc.datum}-${doc.projektId}-regie`,
              projektId: doc.projektId,
              einsatzId: '',
              userId: z.userId || '',
              name: z.name,
              qualifikation: z.art || '',
              teamId: '',
              datum: z.datum || doc.datum,
              von: z.von || '',
              bis: z.bis || '',
              pauseMin: 0,
              stundenGesamt: z.anzahl,
              satzCent: Math.round((z.satz || 0) * 100),
              art: 'regie',
              taetigkeit: doc.beschreibung || '',
              anordnungId: '',
              berichtId: doc.id,
              status: 'erfasst',
              erfasstAm: Date.now(),
              zuletztGeaendertVon: user?.name || '',
              zuletztGeaendertAm: Date.now(),
            })
          }
        }
        for (const zeile of jeTag.values()) {
          await withStore((s) => s.add('stunden', zeile))
        }
      }
      entwurf.loeschen()   // erst NACH der Bestätigung des Stores
      onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  // Entwurfs-Sicherung: rettet die Eingabe über Akku-Aus, Tab-Wechsel und
  // versehentliches Neuladen. Fotos hängen bereits am Store, nur der
  // Formularzustand muss gesichert werden.
  const entwurf = useEntwurf(
    `bericht:${typ}:${bericht?.id || projektId || 'neu'}`,
    daten,
    !gesperrt,
  )

  const feld = 'w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500 disabled:bg-gedeckt disabled:text-schrift-zart'
  const label = 'block text-xs font-semibold text-schrift-leise mb-1'
  // Datums-/Zeit-/Zahlenfelder: weniger Innenabstand und mittig, damit "07:00"
  // auch in einer Drittelspalte auf einem 360-px-Handy vollstaendig sichtbar ist.
  // min-w-0 ist der entscheidende Teil: native date/time-Felder haben auf dem
  // iPhone eine Eigenmindestbreite (min-width: auto), unter die w-full sie NICHT
  // drueckt – sie ragen dann aus ihrer Spalte und schieben sich uebereinander.
  const zeitFeld = `${feld} !px-1.5 text-center tabular-nums min-w-0`

  // Getrennte Foto-Sektion (als Render-Funktion, damit React nicht remountet)
  function fotoSektion({ phase }) {
    const liste = phase === 'vorher' ? fotosVorher : fotosNachher
    const farbe = phase === 'vorher' ? 'bg-schrift' : 'bg-emerald-600'
    return (
      <div>
        {!gesperrt && (
          <div className="flex gap-2">
            <button onClick={() => kameraRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
              className={`flex-1 px-3 py-3 rounded-feld text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 ${farbe}`}>
              <Icon name="foto" className="w-4 h-4" />
              {ladeFoto === phase ? t('bf.verarbeite') : t(phase === 'vorher' ? 'bf.fotoVorherAufnehmen' : 'bf.fotoNachherAufnehmen')}
            </button>
            <button onClick={() => dateiRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
              className="px-3 py-3 rounded-feld bg-karte border border-rahmen text-sm font-medium">{t('allg.hochladen')}</button>
          </div>
        )}
        <input ref={kameraRefs[phase]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        <input ref={dateiRefs[phase]} type="file" accept="image/*" multiple className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        {liste.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {liste.map((f) => (
              <div key={f.id} className="relative group">
                <img src={f.dataUrl} alt={f.name} className="w-full h-20 object-cover rounded-feld border border-rahmen" />
                {!gesperrt && (
                  <button onClick={() => fotoLoeschen(f)}
                    className="absolute top-1 right-1 bg-karte/90 rounded-full p-0.5 text-schrift-leise hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-schrift-zart">{t(phase === 'vorher' ? 'bf.keinVorherFoto' : 'bf.keinNachherFoto')}</p>
        )}
      </div>
    )
  }

  let nr = 0
  const naechste = () => ++nr

  return (
    <Modal titel={`${t(TITEL_SCHLUESSEL[typ])}${nummerRef.current ? ` ${nummerRef.current}` : ''} · ${bericht ? t(gesperrt ? 'bf.gesperrtKurz' : 'allg.bearbeiten') : t('bf.erfassen')}`} onClose={onClose} breite="max-w-3xl">
      <div className="space-y-3">
        <EntwurfHinweis
          eintrag={entwurf.gefunden}
          onWiederherstellen={() => {
            const alt = entwurf.wiederherstellen()
            if (!alt) return
            setDaten((d) => ({ ...d, ...alt }))
            // Gesicherte Unterschrift-Bilder sofort wieder ANZEIGEN – sonst
            // wäre die Sicherung zwar da, aber unsichtbar (AP 6).
            if (alt.unterschriftKundeBild) setAlteKunde(alt.unterschriftKundeBild)
            if (alt.unterschriftMonteurBild) setAlteMonteur(alt.unterschriftMonteurBild)
          }}
          onVerwerfen={entwurf.verwerfen}
        />
        {gesperrt && (
          <p className="text-sm text-schrift bg-gedeckt-tief border border-rahmen rounded-feld px-3.5 py-2.5">
            {t('bf.gesperrtHinweis')}
          </p>
        )}

        <Sektion nr={naechste()} titel={t('bf.basisdaten')} pflicht erfuellt={Boolean(daten.projektId) && anordnungOk}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>{t('bf.projektBaustelle')} *</label>
              <select className={feld} value={daten.projektId} onChange={set('projektId')} disabled={Boolean(bericht) || gesperrt}>
                <option value="">{t('allg.waehlen')}</option>
                {projekte.map((p) => <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{t('bf.berichtsdatum')}</label>
              <input type="date" className={feld} value={daten.datum} onChange={set('datum')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('bf.erstelltVon')}</label>
              {/* Ein Monteur darf hier NUR sich selbst stehen haben. Die
                  Firestore-Regel erlaubt ihm das Anlegen eines Berichts nur mit
                  mitarbeiterId == eigener Auth-UID. Waehlte er einen Kollegen,
                  verweigerte der Server jeden Schreibvorgang – auch den ersten
                  Foto-Upload – und der komplette erfasste Bericht waere verloren,
                  mit nichts als einer englischen Berechtigungsmeldung. */}
              <select
                className={feld} value={daten.mitarbeiterId} onChange={set('mitarbeiterId')}
                disabled={gesperrt || nurEigene}
              >
                <option value="">{t('allg.waehlen')}</option>
                {users
                  .filter((u) => u.aktiv !== false)
                  .filter((u) => !nurEigene || u.id === user?.userId)
                  .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {nurEigene && <p className="mt-1 text-[12px] text-schrift-zart">{t('bf.nurEigene')}</p>}
            </div>
          </div>
          {projekt && (
            <p className="mt-2 text-xs text-schrift-zart">{projekt.anschrift?.strasse}, {projekt.anschrift?.plzOrt}</p>
          )}
          {typ === 'regie' && (
            <p className="mt-1 text-[12px] text-schrift-zart">
              {t('bf.werGearbeitet')}
            </p>
          )}
          {typ === 'regie' && (
            <div className="mt-3 grid sm:grid-cols-3 gap-3 bg-amber-50/60 border border-amber-100 rounded-feld p-3">
              <div>
                <label className={label}>{t('bf.angeordnetDurch')} *</label>
                <input type="text" className={feld} value={daten.angeordnetDurch} onChange={set('angeordnetDurch')}
                  placeholder={t('bf.angeordnetPlatz')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>{t('bf.angeordnetAm')}</label>
                <input type="date" className={feld} value={daten.angeordnetAm} onChange={set('angeordnetAm')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>{t('bf.anzeigeArt')}</label>
                <select className={feld} value={daten.anzeigeArt} onChange={set('anzeigeArt')} disabled={gesperrt}>
                  <option value="muendlich">{t('bf.muendlich')}</option>
                  <option value="schriftlich">{t('bf.schriftlich')}</option>
                  <option value="mail">{t('bf.perMail')}</option>
                </select>
              </div>
              <p className="sm:col-span-3 text-[12px] text-amber-700">
                Stundenlohnarbeiten müssen dem Auftraggeber VOR Beginn angezeigt werden (§ 15 Abs. 3 VOB/B).
              </p>
            </div>
          )}
          {typ === 'reklamation' && (
            <div className="mt-3 grid sm:grid-cols-3 gap-3 bg-red-50/60 border border-red-100 rounded-feld p-3">
              <div>
                <label className={label}>{t('bf.geruegtDurch')}</label>
                <input type="text" className={feld} value={daten.geruegtDurch} onChange={set('geruegtDurch')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>{t('bf.ruegeAm')}</label>
                <input type="date" className={feld} value={daten.ruegeZugangAm} onChange={set('ruegeZugangAm')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>{t('bf.fristBis')}</label>
                <input type="date" className={feld} value={daten.fristBis} onChange={set('fristBis')} disabled={gesperrt} />
              </div>
            </div>
          )}
        </Sektion>

        <Sektion nr={naechste()} titel={t('bf.sektionVorher')} pflicht erfuellt={fotosVorher.length >= 1}>
          {fotoSektion({ phase: 'vorher' })}
        </Sektion>

        <Sektion nr={naechste()} titel={t(typ === 'reklamation' ? 'bf.sektionMangel' : typ === 'abnahme' ? 'bf.sektionAbnahme' : 'bf.sektionArbeiten')} pflicht erfuellt={Boolean(daten.beschreibung.trim()) && vorbehaltOk}>
          {typ === 'abnahme' && (
            <div className="mb-3 grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>{t('bf.abnahmeArt')} *</label>
                <select className={feld} value={daten.abnahmeArt} onChange={set('abnahmeArt')} disabled={gesperrt}>
                  <option value="gesamt">{t('bf.gesamtabnahme')}</option>
                  <option value="teil">{t('bf.teilabnahme')}</option>
                </select>
              </div>
              <div>
                <label className={label}>{t('bf.ortAbnahme')}</label>
                <input type="text" className={feld} value={daten.ort} onChange={set('ort')} disabled={gesperrt} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>{t('bf.leistungsumfang')}</label>
                <textarea rows={2} className={feld} value={daten.leistungsumfang} onChange={set('leistungsumfang')} disabled={gesperrt}
                  placeholder={lvPositionen.filter((p) => p.typ === 'titel').map((p) => p.kurztext).join(', ') || t('bf.leistungsumfangPlatz')} />
              </div>
            </div>
          )}
          <textarea rows={3} className={feld} value={daten.beschreibung} onChange={set('beschreibung')} disabled={gesperrt}
            placeholder={typ === 'regie' ? t('bf.beschreibungPlatz') : ''} />
          {typ === 'reklamation' && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className={label}>{t('pd.ursache')}</label>
                <textarea rows={2} className={feld} value={daten.ursache} onChange={set('ursache')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>{t('bf.massnahme')}</label>
                <textarea rows={2} className={feld} value={daten.massnahme} onChange={set('massnahme')} disabled={gesperrt} />
              </div>
            </div>
          )}
          {typ === 'abnahme' && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => !gesperrt && setDaten((d) => ({ ...d, ohneMaengel: !d.ohneMaengel }))}
                  className={`px-3.5 py-2 rounded-feld text-sm font-medium border ${daten.ohneMaengel ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-karte border-rahmen text-schrift-leise'}`}>
                  <Icon name="check" className="w-4 h-4 inline mr-1.5" />{t('pd.ohneMaengel')}
                </button>
              </div>
              {!daten.ohneMaengel && (
                <div>
                  <p className="text-xs font-semibold text-schrift-leise mb-1">{t('bf.maengelListe')}</p>
                  {daten.maengel.map((m, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" className={feld} placeholder={t('bf.mangelPlatz')} value={m.text} disabled={gesperrt}
                        onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, text: e.target.value } : x) }))} />
                      <input type="date" className={`${feld} !w-40`} value={m.frist || ''} disabled={gesperrt}
                        onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, frist: e.target.value } : x) }))} />
                      <button onClick={() => setDaten((d) => ({ ...d, maengel: d.maengel.filter((_, j) => j !== i) }))} className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setDaten((d) => ({ ...d, maengel: [...d.maengel, { text: '', frist: '' }] }))} className="text-sm text-praxis-600 font-medium">{t('bf.mangelNeu')}</button>
                  {/* Mängelrüge: gedruckt wird das ZUGANGSdatum, nicht das
                      Erstellungsdatum (AP 9, Plan 7.6). */}
                  <div className="mt-2">
                    <label className={label}>{t('abn.ruegeZugang')}</label>
                    <input type="date" className={`${feld} !w-44`} dir="ltr" value={daten.ruegeZugangAm}
                      onChange={set('ruegeZugangAm')} disabled={gesperrt} />
                  </div>
                </div>
              )}
              <div className="bg-gedeckt rounded-feld p-3">
                <p className="text-xs font-semibold text-schrift mb-2">{t('bf.vorbehalte')} *</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-schrift">Vertragsstrafe (§ 11 VOB/B) vorbehalten:</span>
                  {[[t('bf.nein'), false], [t('bf.ja'), true]].map(([lbl, wert]) => (
                    <button key={lbl} onClick={() => !gesperrt && setDaten((d) => ({ ...d, vorbehaltVertragsstrafe: wert }))}
                      className={`px-3.5 py-1.5 rounded-feld text-sm font-bold border ${daten.vorbehaltVertragsstrafe === wert ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-karte border-rahmen text-schrift-leise'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {/* AP 9 (Plan 7.7): „keine" muss AKTIV gewählt werden – bei
                    „nein" druckt das Protokoll den ausdrücklichen Satz. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => !gesperrt && setDaten((d) => ({ ...d, vorbehalteSonstigeKeine: d.vorbehalteSonstigeKeine === true ? null : true, vorbehalteSonstige: '' }))}
                    className={`px-3.5 py-1.5 rounded-feld text-sm font-bold border ${daten.vorbehalteSonstigeKeine === true && !daten.vorbehalteSonstige ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-karte border-rahmen text-schrift-leise'}`}
                  >
                    {t('abn.sonstigeKeine')}
                  </button>
                  <input type="text" className={`${feld} !flex-1 !w-auto min-w-[200px]`} placeholder={t('bf.vorbehaltePlatz')}
                    value={daten.vorbehalteSonstige}
                    onChange={(e) => setDaten((d) => ({ ...d, vorbehalteSonstige: e.target.value, vorbehalteSonstigeKeine: e.target.value.trim() ? false : d.vorbehalteSonstigeKeine }))}
                    disabled={gesperrt} />
                </div>
              </div>
            </div>
          )}
        </Sektion>

        {typ === 'regie' && (
          <Sektion nr={naechste()} titel={t('bf.sektionArbeitszeit')} pflicht erfuellt={stundenOk}>
            <p className="text-[12px] text-schrift-zart mb-2">
              Je Person eine Zeile mit Datum und Von/Bis – Namen sind Pflicht (§ 15 Abs. 3 VOB/B).
              Der Stundensatz ergibt sich automatisch aus der Qualifikation des Mitarbeiters (Einstellungen → Sätze).
            </p>
            {daten.stunden.map((z, i) => {
              const gewaehlterUser = users.find((u) => u.id === z.userId) || users.find((u) => u.name && u.name === z.name)
              const freiText = !gewaehlterUser
              return (
                /* Raster immer 6-spaltig, auf dem Handy anders aufgeteilt:
                   Name und Datum je eine volle Zeile, darunter Von/Bis/Std. zu
                   dritt. min-w-0 ist dabei entscheidend – ohne das können die
                   nativen Datums-/Zeitfelder nicht unter ihre Eigenbreite
                   schrumpfen und schieben sich übereinander. */
                <div key={i} className="border border-rahmen rounded-feld p-2.5 mb-2 grid grid-cols-6 gap-2 items-end">
                  <div className="col-span-6 sm:col-span-2 min-w-0">
                    <label className={label}>{t('allg.name')} *</label>
                    {/* Natives Select: auf dem Handy öffnet der System-Auswahldialog –
                        keine überlagernde Vorschlagsliste mehr, die das Feld verdeckt. */}
                    <select
                      className={feld}
                      disabled={gesperrt}
                      value={gewaehlterUser ? gewaehlterUser.id : '__frei'}
                      onChange={(e) => {
                        const wahl = e.target.value
                        setDaten((d) => ({
                          ...d,
                          stunden: d.stunden.map((s, j) => {
                            if (j !== i) return s
                            if (wahl === '__frei') return { ...s, userId: '', name: '' }
                            const u = users.find((x) => x.id === wahl)
                            const art = qualiVon(u)
                            return { ...s, userId: wahl, name: u?.name || '', art, satz: satzFuer(art) }
                          }),
                        }))
                      }}
                    >
                      <option value="__frei">{t('bf.nameEintippen')}</option>
                      {users.filter((u) => u.aktiv !== false).map((u) => (
                        <option key={u.id} value={u.id}>{u.name}{u.team ? ` (${u.team})` : ''}</option>
                      ))}
                    </select>
                    {freiText && (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          type="text" className={feld} placeholder={t('bf.vorNachname')} value={z.name} disabled={gesperrt}
                          onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, name: e.target.value } : s) }))}
                        />
                        <select
                          className={`${feld} !w-36`} value={z.art} disabled={gesperrt}
                          title={t('bf.qualiHinweis')}
                          onChange={(e) => {
                            const art = e.target.value
                            setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, art, satz: satzFuer(art) } : s) }))
                          }}
                        >
                          <option value="facharbeiter">{t('einst.facharbeiter')}</option>
                          <option value="helfer">{t('einst.helfer')}</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="col-span-6 sm:col-span-1 min-w-0">
                    <label className={label}>{t('allg.datum')}</label>
                    <input type="date" className={zeitFeld} value={z.datum} disabled={gesperrt}
                      onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, datum: e.target.value } : s) }))} />
                  </div>
                  {/* Von / Bis / Std. sind gekoppelt: Von-Bis rechnet die Stunden,
                      eine manuelle Stundenzahl verschiebt die Bis-Uhrzeit. */}
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <label className={label}>{t('allg.von')}</label>
                    <input type="time" step="300" className={zeitFeld} value={z.von} disabled={gesperrt}
                      onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, von: e.target.value, anzahl: dauerStunden(e.target.value, s.bis) } : s) }))} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <label className={label}>{t('allg.bis')}</label>
                    <input type="time" step="300" className={zeitFeld} value={z.bis} disabled={gesperrt}
                      onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, bis: e.target.value, anzahl: dauerStunden(s.von, e.target.value) } : s) }))} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <label className={label}>{t('allg.stunden')}</label>
                    <input type="text" inputMode="decimal" className={zeitFeld} value={z.anzahl} disabled={gesperrt}
                      onChange={(e) => setDaten((d) => ({
                        ...d,
                        stunden: d.stunden.map((s, j) => j === i
                          ? { ...s, anzahl: e.target.value, bis: bisAus(s.von, e.target.value) || s.bis }
                          : s),
                      }))} />
                  </div>
                  <div className="col-span-6 flex items-center gap-2 pt-0.5">
                    <span className="text-[12px] text-schrift-leise">
                      {QUALI_SCHLUESSEL[z.art] ? t(QUALI_SCHLUESSEL[z.art]) : z.art} · <strong>{euro(Number(z.satz) || satzFuer(z.art))}/{t('allg.stunden')}</strong>
                      {' '}= <strong>{euro((Number(z.anzahl) || 0) * (Number(z.satz) || satzFuer(z.art)))}</strong>
                    </span>
                    {!gesperrt && (
                      <button
                        onClick={() => setDaten((d) => ({ ...d, stunden: d.stunden.filter((_, j) => j !== i) }))}
                        className="ml-auto text-schrift-zart hover:text-red-500"
                        title={t('lv.zeileEntfernen')}
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center justify-between mb-4">
              {!gesperrt ? (
                <button onClick={() => setDaten((d) => ({ ...d, stunden: [...d.stunden, { userId: '', name: '', datum: daten.datum, art: 'facharbeiter', von: '07:00', bis: '16:00', anzahl: dauerStunden('07:00', '16:00'), satz: satzFuer('facharbeiter') }] }))}
                  className="text-sm text-praxis-600 font-medium">{t('bf.personTag')}</button>
              ) : <span />}
              <span className="text-sm font-bold">{euro(stundenSumme)}</span>
            </div>

            <p className="text-xs font-semibold text-schrift-leise mb-2">{t('bf.material')}</p>
            {daten.material.map((z, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm flex-1 min-w-[180px]">{z.name} <span className="text-xs text-schrift-zart">({euro(z.preis)}/{z.einheit || 'Stk'})</span></span>
                <input type="text" inputMode="decimal" className={`${feld} !w-24`} value={z.menge} disabled={gesperrt}
                  onChange={(e) => setDaten((d) => ({ ...d, material: d.material.map((m, j) => j === i ? { ...m, menge: e.target.value } : m) }))} />
                <span className="text-xs text-schrift-zart w-20">= {euro(parseZahl(z.menge) * parseZahl(z.preis))}</span>
                {!gesperrt && (
                  <button onClick={() => setDaten((d) => ({ ...d, material: d.material.filter((_, j) => j !== i) }))} className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {!gesperrt && (
              <select className={feld} value="" onChange={(e) => {
                const a = katalog.find((k) => k.id === e.target.value)
                if (a) setDaten((d) => ({ ...d, material: [...d.material, { artikelId: a.id, name: a.name, einheit: a.einheit, preis: a.preis, menge: 1 }] }))
              }}>
                <option value="">{t('bf.artikelHinzu')}</option>
                {katalog.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name} ({euro(a.preis)})</option>)}
              </select>
            )}
            {daten.material.length > 0 && <p className="text-right text-sm font-bold mt-1">{euro(materialSumme)}</p>}
          </Sektion>
        )}

        {/* Fahrzeugeinsatz als EIGENER Abschnitt.
            Zuerst stand er als Zwischenueberschrift mitten in der Arbeitszeit,
            zwischen Stundenliste und Material – dort hat ihn niemand gefunden.
            Ein eigener nummerierter Abschnitt ist im Formular auffindbar. */}
        {typ === 'regie' && (
          <Sektion nr={naechste()} titel={t('bf.sektionFahrzeuge')}>
          {/* Fahrzeugeinsatz: Kennzeichen, Strecke, Kilometer.
              Ohne diese Angaben ist eine Fahrtkostenposition im Streitfall
              wertlos – und steuerlich ist ein Fahrtenbuch ohne Kennzeichen
              und Strecke kein Fahrtenbuch. */}
          <p className="text-xs font-semibold text-schrift-leise mb-2">{t('bf.fahrzeuge')}</p>
          {fahrten.map((f, i) => {
            const abgeleitet = istRueckfahrt(f)
            const pruef = fahrtPruefung(f)
            const zeigeMangel = !pruef.ok && fahrtBegonnen(f)
            const setzeF = (felder) => setDaten((d) => ({
              ...d, fahrten: d.fahrten.map((x, j) => (j === i ? { ...x, ...felder } : x)),
            }))
            // Eine Hinfahrt löschen nimmt ihre Rückfahrt mit – eine Rückfahrt
            // ohne Hinfahrt ist keine Rückfahrt mehr.
            const loesche = () => setDaten((d) => ({
              ...d, fahrten: d.fahrten.filter((x, j) => j !== i && x.ausFahrt !== f.id),
            }))
            return (
              <div
                key={f.id || i}
                className={`rounded-feld border p-3 mb-2 ${
                  !f.berechnen ? 'border-amber-300 bg-amber-50/40'
                    : abgeleitet ? 'border-praxis-200 bg-gedeckt/40' : 'border-rahmen'
                }`}
              >
                {abgeleitet && (
                  <p className="text-[12px] font-bold text-praxis-700 mb-2">
                    ↩ {t('bf.rueckfahrt')} · <span className="font-normal text-schrift-zart">{t('bf.rueckfahrtFest')}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-2 mb-2">
                  <div>
                    <label className={label}>{t('bf.kennzeichen')}</label>
                    {abgeleitet ? (
                      <p className={`${feld} !w-40 !bg-gedeckt !text-schrift-leise`}>{f.kennzeichen || '–'}</p>
                    ) : fuhrpark.length ? (
                      <select
                        className={`${feld} !w-44`} value={f.kennzeichen} disabled={gesperrt}
                        onChange={(e) => {
                          const fz = fuhrpark.find((x) => x.kennzeichen === e.target.value)
                          setzeF({ kennzeichen: e.target.value, fahrzeug: fz?.bezeichnung || '' })
                        }}
                      >
                        <option value="">{t('bf.fahrzeugWaehlen')}</option>
                        {fuhrpark.map((fz) => (
                          <option key={fz.id || fz.kennzeichen} value={fz.kennzeichen}>
                            {fz.kennzeichen}{fz.bezeichnung ? ` · ${fz.bezeichnung}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text" list="kennzeichen-bekannt" className={`${feld} !w-40 uppercase`}
                        value={f.kennzeichen} disabled={gesperrt} placeholder="AIC-XX 123"
                        onChange={(e) => setzeF({ kennzeichen: e.target.value.toUpperCase() })}
                      />
                    )}
                  </div>
                  <div>
                    <label className={label}>{t('allg.datum')}</label>
                    {abgeleitet ? (
                      <p className={`${feld} !w-36 !bg-gedeckt !text-schrift-leise`}>{f.datum || daten.datum}</p>
                    ) : (
                      <input type="date" className={`${feld} !w-40`} value={f.datum || daten.datum} disabled={gesperrt}
                        onChange={(e) => setzeF({ datum: e.target.value })} />
                    )}
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className={label}>{t('bf.fahrer')}</label>
                    {abgeleitet ? (
                      <p className={`${feld} !bg-gedeckt !text-schrift-leise`}>{f.fahrer || '–'}</p>
                    ) : (
                      <input type="text" className={feld} value={f.fahrer} disabled={gesperrt}
                        onChange={(e) => setzeF({ fahrer: e.target.value })} />
                    )}
                  </div>
                  {!gesperrt && (
                    <button onClick={loesche} className="text-schrift-zart hover:text-red-500 pb-2.5" aria-label={t('allg.entfernen')}>
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={label}>{t('bf.fahrtVon')}</label>
                    {abgeleitet ? (
                      <p className={`${feld} !bg-gedeckt !text-schrift-leise`}>{f.von || '–'}</p>
                    ) : (
                      <input type="text" className={feld} value={f.von} disabled={gesperrt}
                        placeholder={t('bf.fahrtVonPlatz')} onChange={(e) => setzeF({ von: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label className={label}>{t('bf.fahrtNach')}</label>
                    {abgeleitet ? (
                      <p className={`${feld} !bg-gedeckt !text-schrift-leise`}>{f.nach || '–'}</p>
                    ) : (
                      <input type="text" className={feld} value={f.nach} disabled={gesperrt}
                        placeholder={t('bf.fahrtNachPlatz')} onChange={(e) => setzeF({ nach: e.target.value })} />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className={label}>{t('bf.kilometer')}</label>
                    <input type="text" inputMode="decimal" className={`${feld} !w-28`} value={f.km || ''} disabled={gesperrt}
                      onChange={(e) => setzeF({ km: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>{t('einst.satzKm')}</label>
                    <input type="text" inputMode="decimal" className={`${feld} !w-20`} value={f.satz} disabled={gesperrt || !f.berechnen}
                      onChange={(e) => setzeF({ satz: e.target.value })} />
                  </div>
                  <p className="text-sm font-bold pb-2.5 ms-auto">
                    {kmVon(f).toLocaleString('de-DE')} km
                    {f.berechnen
                      ? <> · {euro(betragVon(f))}</>
                      : <span className="text-amber-700"> · {t('bf.fahrtFrei')}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 text-[12px] text-schrift">
                    <input type="checkbox" checked={f.berechnen !== false} disabled={gesperrt}
                      onChange={(e) => setzeF({ berechnen: e.target.checked })} />
                    {t('bf.fahrtBerechnen')}
                  </label>
                  {/* Hin und zurück: Adressen und Kennzeichen nur EINMAL eingeben.
                      Der Knopf erscheint nur an Hinfahrten, die noch keine
                      Rückfahrt haben – sonst entstünde derselbe Weg zweimal und
                      würde doppelt berechnet. */}
                  {!gesperrt && !abgeleitet && !hatRueckfahrt(daten.fahrten, f.id) && (
                    <button
                      onClick={() => setDaten((d) => {
                        const neu = [...d.fahrten]
                        neu.splice(i + 1, 0, rueckfahrtVon(mitAbleitung(d.fahrten)[i]))
                        return { ...d, fahrten: neu }
                      })}
                      className="px-3 min-h-9 rounded-feld border border-praxis-300 bg-karte text-[12px] font-bold text-praxis-700 hover:bg-gedeckt"
                    >
                      ↩ {t('bf.rueckfahrtHinzu')}
                    </button>
                  )}
                </div>
                {zeigeMangel && (
                  <p className="text-[12px] text-amber-700 mt-1.5">
                    {pruef.maengel.map((m) => t(`bf.fahrtMangel.${m}`)).join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
          {!fuhrpark.length && (
            <p className="text-[12px] text-schrift-zart mb-2">{t('bf.fuhrparkLeer')}</p>
          )}
          <datalist id="kennzeichen-bekannt">
            {kennzeichenListe.map((k) => <option key={k} value={k} />)}
          </datalist>
          {!gesperrt && (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setDaten((d) => ({
                  ...d,
                  fahrten: [...d.fahrten, neueFahrt({
                    datum: d.datum,
                    satz: Number(einst.kmSatz) || KM_SATZ_STANDARD,
                    fahrer: monteurName,
                    kennzeichen: fuhrpark.length === 1 ? fuhrpark[0].kennzeichen : '',
                    fahrzeug: fuhrpark.length === 1 ? (fuhrpark[0].bezeichnung || '') : '',
                  })],
                }))}
                className="px-4 min-h-11 rounded-feld border border-rahmen bg-karte text-sm font-semibold text-schrift hover:bg-gedeckt"
              >
                + {t('bf.fahrtHinzu')}
              </button>
              {/* Freie Fahrt: wird dokumentiert, aber nicht berechnet.
                  Nachbesserungen und Materialabholungen fahren auf eigene
                  Kosten – im Fahrtenbuch stehen müssen sie trotzdem. */}
              <button
                onClick={() => setDaten((d) => ({
                  ...d,
                  fahrten: [...d.fahrten, neueFahrt({
                    datum: d.datum, satz: 0, fahrer: monteurName, berechnen: false,
                    kennzeichen: fuhrpark.length === 1 ? fuhrpark[0].kennzeichen : '',
                    fahrzeug: fuhrpark.length === 1 ? (fuhrpark[0].bezeichnung || '') : '',
                  })],
                }))}
                className="px-4 min-h-11 rounded-feld border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                + {t('bf.fahrtFreiHinzu')}
              </button>
            </div>
          )}
          {fahrten.length > 0 && (
            <p className="text-right text-sm mb-3">
              <span className="text-schrift-zart">
                {fahrtSumme.km.toLocaleString('de-DE')} km{fahrtSumme.frei > 0 ? ` · ${t('bf.fahrtFreieAnzahl', { anzahl: fahrtSumme.frei })}` : ''}
              </span>
              {' · '}<strong>{euro(fahrtSumme.betrag)}</strong>
            </p>
          )}
          </Sektion>
        )}

        <Sektion nr={naechste()} titel={t('bf.sektionNachher')} pflicht erfuellt={fotosNachher.length >= 1}>
          {fotoSektion({ phase: 'nachher' })}
        </Sektion>

        <Sektion nr={naechste()} titel={t('bf.sektionUnterschriften')} pflicht={typ === 'abnahme'} erfuellt={abnahmeUnterschriftenOk}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-schrift-leise mb-1.5">
                {t('bf.auftraggeber')} {t(typ === 'abnahme' ? 'bf.pflicht' : 'bf.optionalAnerkenntnis')}
              </p>
              {alteKunde && !kundeCanvas ? (
                <div>
                  <img src={alteKunde} alt="Unterschrift Kunde" className="h-20 border border-rahmen rounded-feld bg-karte" />
                  {!gesperrt && <button onClick={() => { setAlteKunde(''); setDaten((d) => ({ ...d, unterschriftKundeBild: '' })) }} className="mt-1 text-xs text-schrift-leise hover:text-praxis-600">{t('bf.neuUnterschreiben')}</button>}
                </div>
              ) : gesperrt ? <p className="text-xs text-schrift-zart">{t('bf.keineUnterschrift')}</p> : (
                <UnterschriftFeld onAenderung={kundeGezeichnet} />
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="text" className={feld} placeholder={`${t('bf.vorNachname')} *`} value={daten.unterschriftName} onChange={set('unterschriftName')} disabled={gesperrt} />
                <input type="text" className={feld} placeholder={`${t('bf.funktion')} *`} value={daten.unterschriftFunktion} onChange={set('unterschriftFunktion')} disabled={gesperrt} />
                <input type="text" className={`${feld} col-span-2`} placeholder={t('bf.firmaPlatz')} value={daten.unterschriftFirma} onChange={set('unterschriftFirma')} disabled={gesperrt} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-schrift-leise mb-1.5">
                {t('einst.monteur')} – Gabara Service GmbH {t(typ === 'abnahme' ? 'bf.pflicht' : 'nt.optional')}
              </p>
              {alteMonteur && !monteurCanvas ? (
                <div>
                  <img src={alteMonteur} alt="Unterschrift Monteur" className="h-20 border border-rahmen rounded-feld bg-karte" />
                  {!gesperrt && <button onClick={() => { setAlteMonteur(''); setDaten((d) => ({ ...d, unterschriftMonteurBild: '' })) }} className="mt-1 text-xs text-schrift-leise hover:text-praxis-600">{t('bf.neuUnterschreiben')}</button>}
                </div>
              ) : gesperrt ? <p className="text-xs text-schrift-zart">{t('bf.keineUnterschrift')}</p> : (
                <UnterschriftFeld onAenderung={monteurGezeichnet} hinweis={t('bf.unterschriftMonteur')} />
              )}
              <p className="mt-2 text-xs text-schrift-zart">{mitarbeiter?.name || user?.name || ''}</p>
            </div>
          </div>
        </Sektion>

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-feld px-3 py-2">{fehler}</p>}
        {!gesperrt && !einreichenOk && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-feld px-3 py-2">
            {t('bf.fehltNoch', { text: gateHinweis() || '–' })}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-rahmen">
          <button onClick={onClose} className="px-4 py-2.5 rounded-feld text-sm font-medium text-schrift-leise hover:bg-gedeckt-tief">
            {t(gesperrt ? 'allg.schliessen' : 'allg.abbrechen')}
          </button>
          {!gesperrt && (
            <>
              <button onClick={() => speichern('entwurf')} className="px-4 py-2.5 rounded-feld text-sm font-medium bg-gedeckt-tief text-schrift hover:bg-gedeckt-tief">
                {t('rw.alsEntwurf')}
              </button>
              <button onClick={() => speichern('eingereicht')} disabled={!einreichenOk}
                className="px-4 py-2.5 rounded-feld text-sm font-bold bg-praxis-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-praxis-700">
                {t('spesenF.einreichen')}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
