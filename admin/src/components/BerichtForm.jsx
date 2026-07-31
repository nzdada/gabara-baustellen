import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { UnterschriftFeld, unterschriftAlsDataUrl } from '@shared/unterschrift.jsx'
import { euro } from '@shared/format.js'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'

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

const TITEL = { regie: 'Regie-/Arbeitsbericht', reklamation: 'Reklamation / Schadensprotokoll', abnahme: 'Abnahmeprotokoll' }
const NUMMER_PREFIX = { regie: 'RB', reklamation: 'RK', abnahme: 'AB' }

function heuteIso() {
  return new Date().toISOString().slice(0, 10)
}

// Stunden aus Von/Bis (z. B. 07:00–15:30 -> 8.5)
function dauerStunden(von, bis) {
  if (!von || !bis) return 0
  const [h1, m1] = von.split(':').map(Number)
  const [h2, m2] = bis.split(':').map(Number)
  return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10)
}

async function komprimiere(file, maxKante = 1200, qualitaet = 0.72) {
  const bitmap = await createImageBitmap(file)
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * faktor)
  canvas.height = Math.round(bitmap.height * faktor)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', qualitaet)
}

// Fortlaufende Berichtsnummer vergeben (lokal; Firebase-Go-Live: runTransaction-TODO)
async function neueBerichtsnummer(typ) {
  return withStore(async (s) => {
    const settings = await s.list('settings')
    const doc = settings.find((x) => x.id === 'nummernkreis') || { id: 'nummernkreis' }
    const jahr = new Date().getFullYear()
    const kreis = doc.bericht?.jahr === jahr ? doc.bericht : { jahr, laufend: 0 }
    const laufend = (kreis.laufend || 0) + 1
    await s.add('settings', { ...doc, id: 'nummernkreis', bericht: { jahr, laufend } })
    return `${NUMMER_PREFIX[typ] || 'B'}-${jahr}-${String(laufend).padStart(3, '0')}`
  })
}

// Abschnitts-Karte im mam_solar-Stil: Nummer + Titel, darunter der Inhalt
function Sektion({ nr, titel, pflicht = false, erfuellt = true, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${pflicht && !erfuellt ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
          pflicht && !erfuellt ? 'bg-amber-400 text-white' : 'bg-praxis-600 text-white'
        }`}>{nr}</span>
        <p className="text-sm font-bold text-slate-800">{titel}</p>
        {pflicht && (
          <span className={`ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 ${erfuellt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {erfuellt ? 'OK' : 'Pflicht'}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default function BerichtForm({ typ, projektId = '', bericht = null, user, onClose }) {
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const katalog = useCollection('katalog')
  const einst = useEinstellungen()

  const gesperrt = Boolean(bericht && ['freigegeben', 'abgerechnet'].includes(bericht.status))

  const draftId = useRef(bericht?.id || (crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`))
  const docAngelegt = useRef(Boolean(bericht))
  const nummerRef = useRef(bericht?.nummer || '')
  const fotos = useWhere('photos', 'berichtId', draftId.current)
  const lvPositionen = useWhere('lvpositionen', 'projektId', bericht?.projektId || projektId || '')

  const monteurName = users.find((u) => u.id === (bericht?.mitarbeiterId || user?.userId))?.name || user?.name || ''

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
    // Unterschriften
    unterschriftName: bericht?.unterschriftName || '',
    unterschriftFunktion: bericht?.unterschriftFunktion || '',
    unterschriftFirma: bericht?.unterschriftFirma || '',
    // Arbeitszeit wie mam_solar: je Person mit Datum + Von/Bis
    stunden: bericht?.stunden?.length
      ? bericht.stunden.map((z) => ({ name: z.name || '', datum: z.datum || bericht?.datum || heuteIso(), art: z.art || 'facharbeiter', von: z.von || '', bis: z.bis || '', anzahl: z.anzahl ?? 0, satz: z.satz ?? 35 }))
      : (typ === 'regie' ? [{ name: monteurName, datum: heuteIso(), art: 'facharbeiter', von: '07:00', bis: '16:00', anzahl: dauerStunden('07:00', '16:00'), satz: einst.regieFacharbeiter || 35 }] : []),
    material: bericht?.material || [],
  }))
  const [kundeCanvas, setKundeCanvas] = useState(null)
  const [monteurCanvas, setMonteurCanvas] = useState(null)
  const [alteKunde, setAlteKunde] = useState(bericht?.unterschriftKunde || '')
  const [alteMonteur, setAlteMonteur] = useState(bericht?.unterschriftMonteur || '')
  const [fehler, setFehler] = useState('')
  const [ladeFoto, setLadeFoto] = useState('')
  const kameraRefs = { vorher: useRef(null), nachher: useRef(null) }
  const dateiRefs = { vorher: useRef(null), nachher: useRef(null) }

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  const stundenSumme = daten.stunden.reduce((s, z) => s + (Number(z.anzahl) || 0) * (Number(z.satz) || 0), 0)
  const materialSumme = daten.material.reduce((s, z) => s + (Number(z.menge) || 0) * (Number(z.preis) || 0), 0)

  const fotosVorher = fotos.filter((f) => f.phase === 'vorher')
  const fotosNachher = fotos.filter((f) => f.phase === 'nachher')
  const kundeDa = Boolean(kundeCanvas || alteKunde)
  const monteurDa = Boolean(monteurCanvas || alteMonteur)
  const stundenOk = typ !== 'regie' || (daten.stunden.length > 0 && daten.stunden.every((z) => z.name.trim() && (Number(z.anzahl) || 0) > 0))
  const anordnungOk = typ !== 'regie' || Boolean(daten.angeordnetDurch.trim())
  const abnahmeUnterschriftenOk = typ !== 'abnahme'
    || (kundeDa && monteurDa && daten.unterschriftName.trim() && daten.unterschriftFunktion.trim())
  const vorbehaltOk = typ !== 'abnahme' || daten.vorbehaltVertragsstrafe !== null
  const einreichenOk = daten.projektId && daten.beschreibung.trim()
    && fotosVorher.length >= 1 && fotosNachher.length >= 1
    && stundenOk && anordnungOk && abnahmeUnterschriftenOk && vorbehaltOk

  function gateHinweis() {
    const teile = []
    if (!daten.projektId) teile.push('Projekt wählen')
    if (typ === 'regie' && !anordnungOk) teile.push('Wer hat die Arbeiten angeordnet?')
    if (fotosVorher.length < 1) teile.push('mind. 1 Vorher-Foto')
    if (!daten.beschreibung.trim()) teile.push('Beschreibung')
    if (typ === 'regie' && !stundenOk) teile.push('je Stunden-Zeile: Name + Stunden')
    if (fotosNachher.length < 1) teile.push('mind. 1 Nachher-Foto')
    if (typ === 'abnahme' && daten.vorbehaltVertragsstrafe === null) teile.push('Vorbehalt Vertragsstrafe (ja/nein)')
    if (typ === 'abnahme' && (!kundeDa || !daten.unterschriftName.trim() || !daten.unterschriftFunktion.trim())) teile.push('Kundenunterschrift + Name + Funktion')
    if (typ === 'abnahme' && !monteurDa) teile.push('Monteur-Unterschrift')
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
    if (!daten.projektId) { setFehler('Bitte zuerst ein Projekt wählen (Abschnitt 1) – dann Fotos aufnehmen.'); return }
    setFehler('')
    setLadeFoto(phase)
    try {
      for (const datei of dateien) {
        if (!datei.type.startsWith('image/')) { setFehler(`${datei.name} ist kein Bild.`); continue }
        const dataUrl = await komprimiere(datei)
        if (dataUrl.length > 950000) { setFehler('Bild ist auch komprimiert zu groß – bitte kleineres Bild wählen.'); continue }
        await stelleDocSicher()
        await withStore((s) => s.add('photos', {
          projektId: daten.projektId, berichtId: draftId.current, terminId: bericht?.terminId || '',
          phase, dataUrl, name: datei.name, von: user?.name || '', createdAt: Date.now(),
        }))
      }
    } catch (err) {
      setFehler(err.message || 'Bild konnte nicht verarbeitet werden.')
    } finally {
      setLadeFoto('')
    }
  }

  async function fotoLoeschen(foto) {
    if (gesperrt) return
    if (!confirm('Dieses Foto löschen?')) return
    await withStore((s) => s.remove('photos', foto.id))
  }

  async function speichern(status) {
    if (gesperrt) { setFehler('Dieser Bericht ist freigegeben und kann nicht mehr geändert werden (Beweissicherung).'); return }
    if (!daten.projektId) { setFehler('Bitte ein Projekt wählen (Abschnitt 1).'); return }
    if (status === 'eingereicht' && !einreichenOk) { setFehler(`Zum Einreichen fehlt: ${gateHinweis()}`); return }
    if (!nummerRef.current) nummerRef.current = await neueBerichtsnummer(typ)
    const unterschriftKunde = kundeCanvas ? unterschriftAlsDataUrl(kundeCanvas) : alteKunde
    const unterschriftMonteur = monteurCanvas ? unterschriftAlsDataUrl(monteurCanvas) : alteMonteur
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
        stunden: daten.stunden.map((z) => ({ name: z.name, datum: z.datum, art: z.art, von: z.von, bis: z.bis, anzahl: Number(z.anzahl) || 0, satz: Number(z.satz) || 0 })),
        material: daten.material.map((z) => ({ artikelId: z.artikelId || '', name: z.name, menge: Number(z.menge) || 0, einheit: z.einheit || '', preis: Number(z.preis) || 0 })),
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
      } : {}),
    }
    try {
      docAngelegt.current = true
      await withStore((s) => s.add('berichte', doc))
      onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  const feld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500 disabled:bg-slate-50 disabled:text-slate-400'
  const label = 'block text-xs font-semibold text-slate-500 mb-1'

  // Getrennte Foto-Sektion (als Render-Funktion, damit React nicht remountet)
  function fotoSektion({ phase }) {
    const liste = phase === 'vorher' ? fotosVorher : fotosNachher
    const farbe = phase === 'vorher' ? 'bg-slate-600' : 'bg-emerald-600'
    return (
      <div>
        {!gesperrt && (
          <div className="flex gap-2">
            <button onClick={() => kameraRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
              className={`flex-1 px-3 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 ${farbe}`}>
              <Icon name="foto" className="w-4 h-4" />
              {ladeFoto === phase ? 'Verarbeite …' : `${phase === 'vorher' ? 'Vorher' : 'Nachher'}-Foto aufnehmen`}
            </button>
            <button onClick={() => dateiRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
              className="px-3 py-3 rounded-xl bg-white border border-slate-200 text-sm font-medium">Hochladen</button>
          </div>
        )}
        <input ref={kameraRefs[phase]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        <input ref={dateiRefs[phase]} type="file" accept="image/*" multiple className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        {liste.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {liste.map((f) => (
              <div key={f.id} className="relative group">
                <img src={f.dataUrl} alt={f.name} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                {!gesperrt && (
                  <button onClick={() => fotoLoeschen(f)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Noch kein {phase === 'vorher' ? 'Vorher' : 'Nachher'}-Foto – mindestens 1 ist Pflicht.</p>
        )}
      </div>
    )
  }

  let nr = 0
  const naechste = () => ++nr

  return (
    <Modal titel={`${TITEL[typ]}${nummerRef.current ? ` ${nummerRef.current}` : ''} ${bericht ? (gesperrt ? '(freigegeben – gesperrt)' : 'bearbeiten') : 'erfassen'}`} onClose={onClose} breite="max-w-3xl">
      <div className="space-y-3">
        {gesperrt && (
          <p className="text-sm text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5">
            Dieser Bericht ist freigegeben/abgerechnet und aus Beweisgründen gegen Änderungen gesperrt.
            Korrekturen: das Büro zieht die Freigabe zurück (Projekt → Berichte).
          </p>
        )}

        <Sektion nr={naechste()} titel="Basisdaten" pflicht erfuellt={Boolean(daten.projektId) && anordnungOk}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Projekt / Baustelle *</label>
              <select className={feld} value={daten.projektId} onChange={set('projektId')} disabled={Boolean(bericht) || gesperrt}>
                <option value="">– wählen –</option>
                {projekte.map((p) => <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Berichtsdatum</label>
              <input type="date" className={feld} value={daten.datum} onChange={set('datum')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>Monteur</label>
              <select className={feld} value={daten.mitarbeiterId} onChange={set('mitarbeiterId')} disabled={gesperrt}>
                <option value="">– wählen –</option>
                {users.filter((u) => u.aktiv !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {projekt && (
            <p className="mt-2 text-xs text-slate-400">{projekt.anschrift?.strasse}, {projekt.anschrift?.plzOrt}</p>
          )}
          {typ === 'regie' && (
            <div className="mt-3 grid sm:grid-cols-3 gap-3 bg-amber-50/60 border border-amber-100 rounded-xl p-3">
              <div>
                <label className={label}>Angeordnet durch (Name, Funktion) *</label>
                <input type="text" className={feld} value={daten.angeordnetDurch} onChange={set('angeordnetDurch')}
                  placeholder="z. B. M. Rußbach, Bauleitung" disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>Angeordnet/angezeigt am</label>
                <input type="date" className={feld} value={daten.angeordnetAm} onChange={set('angeordnetAm')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>Art der Anzeige</label>
                <select className={feld} value={daten.anzeigeArt} onChange={set('anzeigeArt')} disabled={gesperrt}>
                  <option value="muendlich">mündlich vor Ort</option>
                  <option value="schriftlich">schriftlich</option>
                  <option value="mail">per E-Mail</option>
                </select>
              </div>
              <p className="sm:col-span-3 text-[11px] text-amber-700">
                Stundenlohnarbeiten müssen dem Auftraggeber VOR Beginn angezeigt werden (§ 15 Abs. 3 VOB/B).
              </p>
            </div>
          )}
          {typ === 'reklamation' && (
            <div className="mt-3 grid sm:grid-cols-3 gap-3 bg-red-50/60 border border-red-100 rounded-xl p-3">
              <div>
                <label className={label}>Gerügt durch (Name/Firma)</label>
                <input type="text" className={feld} value={daten.geruegtDurch} onChange={set('geruegtDurch')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>Rüge zugegangen am</label>
                <input type="date" className={feld} value={daten.ruegeZugangAm} onChange={set('ruegeZugangAm')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>Frist zur Beseitigung bis</label>
                <input type="date" className={feld} value={daten.fristBis} onChange={set('fristBis')} disabled={gesperrt} />
              </div>
            </div>
          )}
        </Sektion>

        <Sektion nr={naechste()} titel="VORHER – Zustand vor der Arbeit" pflicht erfuellt={fotosVorher.length >= 1}>
          {fotoSektion({ phase: 'vorher' })}
        </Sektion>

        <Sektion nr={naechste()} titel={typ === 'reklamation' ? 'Beschreibung des Mangels/Schadens' : typ === 'abnahme' ? 'Gegenstand der Abnahme & Bemerkungen' : 'Ausgeführte Arbeiten (Beschreibung)'} pflicht erfuellt={Boolean(daten.beschreibung.trim()) && vorbehaltOk}>
          {typ === 'abnahme' && (
            <div className="mb-3 grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Art der Abnahme *</label>
                <select className={feld} value={daten.abnahmeArt} onChange={set('abnahmeArt')} disabled={gesperrt}>
                  <option value="gesamt">Gesamtabnahme</option>
                  <option value="teil">Teilabnahme</option>
                </select>
              </div>
              <div>
                <label className={label}>Ort der Abnahme</label>
                <input type="text" className={feld} value={daten.ort} onChange={set('ort')} disabled={gesperrt} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Abgenommene Leistungen (Leistungsumfang)</label>
                <textarea rows={2} className={feld} value={daten.leistungsumfang} onChange={set('leistungsumfang')} disabled={gesperrt}
                  placeholder={lvPositionen.filter((p) => p.typ === 'titel').map((p) => p.kurztext).join(', ') || 'z. B. Malerarbeiten EG + 1. OG gemäß LV'} />
              </div>
            </div>
          )}
          <textarea rows={3} className={feld} value={daten.beschreibung} onChange={set('beschreibung')} disabled={gesperrt}
            placeholder={typ === 'regie' ? 'Was wurde zusätzlich gemacht? (Regie ist getrennt vom LV abrechenbar)' : ''} />
          {typ === 'reklamation' && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className={label}>Ursache</label>
                <textarea rows={2} className={feld} value={daten.ursache} onChange={set('ursache')} disabled={gesperrt} />
              </div>
              <div>
                <label className={label}>Maßnahme zur Nachbesserung</label>
                <textarea rows={2} className={feld} value={daten.massnahme} onChange={set('massnahme')} disabled={gesperrt} />
              </div>
            </div>
          )}
          {typ === 'abnahme' && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => !gesperrt && setDaten((d) => ({ ...d, ohneMaengel: !d.ohneMaengel }))}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium border ${daten.ohneMaengel ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <Icon name="check" className="w-4 h-4 inline mr-1.5" />Abnahme ohne Mängel
                </button>
              </div>
              {!daten.ohneMaengel && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Mängel / Restarbeiten (mit Frist)</p>
                  {daten.maengel.map((m, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" className={feld} placeholder="Mangel beschreiben" value={m.text} disabled={gesperrt}
                        onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, text: e.target.value } : x) }))} />
                      <input type="date" className={`${feld} !w-40`} value={m.frist || ''} disabled={gesperrt}
                        onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, frist: e.target.value } : x) }))} />
                      <button onClick={() => setDaten((d) => ({ ...d, maengel: d.maengel.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setDaten((d) => ({ ...d, maengel: [...d.maengel, { text: '', frist: '' }] }))} className="text-sm text-praxis-600 font-medium">+ Mangel</button>
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Vorbehalte des Auftraggebers (Pflichtangabe) *</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Vertragsstrafe (§ 11 VOB/B) vorbehalten:</span>
                  {[['nein', false], ['ja', true]].map(([lbl, wert]) => (
                    <button key={lbl} onClick={() => !gesperrt && setDaten((d) => ({ ...d, vorbehaltVertragsstrafe: wert }))}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-bold border ${daten.vorbehaltVertragsstrafe === wert ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <input type="text" className={`${feld} mt-2`} placeholder="Sonstige Vorbehalte (bekannte Mängel, Restleistungen) – oder leer"
                  value={daten.vorbehalteSonstige} onChange={set('vorbehalteSonstige')} disabled={gesperrt} />
              </div>
            </div>
          )}
        </Sektion>

        {typ === 'regie' && (
          <Sektion nr={naechste()} titel="Arbeitszeit je Person (Stundenlohnzettel) & Material" pflicht erfuellt={stundenOk}>
            <p className="text-[11px] text-slate-400 mb-2">
              Wie im MAM-Protokoll: je Person eine Zeile mit Datum und Von/Bis – Namen sind Pflicht (§ 15 Abs. 3 VOB/B).
            </p>
            <datalist id="monteur-namen">
              {users.filter((u) => u.aktiv !== false).map((u) => <option key={u.id} value={u.name} />)}
            </datalist>
            {daten.stunden.map((z, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-2.5 mb-2 grid grid-cols-2 sm:grid-cols-7 gap-2 items-end">
                <div className="col-span-2">
                  <label className={label}>Name *</label>
                  <input list="monteur-namen" type="text" className={feld} value={z.name} disabled={gesperrt}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, name: e.target.value } : s) }))} />
                </div>
                <div>
                  <label className={label}>Datum</label>
                  <input type="date" className={feld} value={z.datum} disabled={gesperrt}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, datum: e.target.value } : s) }))} />
                </div>
                <div>
                  <label className={label}>Von</label>
                  <input type="time" className={feld} value={z.von} disabled={gesperrt}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, von: e.target.value, anzahl: dauerStunden(e.target.value, s.bis) || s.anzahl } : s) }))} />
                </div>
                <div>
                  <label className={label}>Bis</label>
                  <input type="time" className={feld} value={z.bis} disabled={gesperrt}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, bis: e.target.value, anzahl: dauerStunden(s.von, e.target.value) || s.anzahl } : s) }))} />
                </div>
                <div>
                  <label className={label}>Std.</label>
                  <input type="number" step="0.25" min="0" className={feld} value={z.anzahl} disabled={gesperrt}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, anzahl: e.target.value } : s) }))} />
                </div>
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <label className={label}>Satz €</label>
                    <select className={feld} value={z.art} disabled={gesperrt} onChange={(e) => {
                      const art = e.target.value
                      setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, art, satz: art === 'helfer' ? (einst.regieHelfer || 31) : (einst.regieFacharbeiter || 35) } : s) }))
                    }}>
                      <option value="facharbeiter">FA {einst.regieFacharbeiter || 35}</option>
                      <option value="helfer">HE {einst.regieHelfer || 31}</option>
                    </select>
                  </div>
                  {!gesperrt && (
                    <button onClick={() => setDaten((d) => ({ ...d, stunden: d.stunden.filter((_, j) => j !== i) }))} className="pb-2 text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mb-4">
              {!gesperrt ? (
                <button onClick={() => setDaten((d) => ({ ...d, stunden: [...d.stunden, { name: '', datum: daten.datum, art: 'facharbeiter', von: '07:00', bis: '16:00', anzahl: dauerStunden('07:00', '16:00'), satz: einst.regieFacharbeiter || 35 }] }))}
                  className="text-sm text-praxis-600 font-medium">+ Person/Tag</button>
              ) : <span />}
              <span className="text-sm font-bold">{euro(stundenSumme)}</span>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-2">Materialverbrauch (aus Artikelstamm)</p>
            {daten.material.map((z, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm flex-1 min-w-[180px]">{z.name} <span className="text-xs text-slate-400">({euro(z.preis)}/{z.einheit || 'Stk'})</span></span>
                <input type="number" step="0.5" min="0" className={`${feld} !w-24`} value={z.menge} disabled={gesperrt}
                  onChange={(e) => setDaten((d) => ({ ...d, material: d.material.map((m, j) => j === i ? { ...m, menge: e.target.value } : m) }))} />
                <span className="text-xs text-slate-400 w-20">= {euro((Number(z.menge) || 0) * (Number(z.preis) || 0))}</span>
                {!gesperrt && (
                  <button onClick={() => setDaten((d) => ({ ...d, material: d.material.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {!gesperrt && (
              <select className={feld} value="" onChange={(e) => {
                const a = katalog.find((k) => k.id === e.target.value)
                if (a) setDaten((d) => ({ ...d, material: [...d.material, { artikelId: a.id, name: a.name, einheit: a.einheit, preis: a.preis, menge: 1 }] }))
              }}>
                <option value="">+ Artikel hinzufügen …</option>
                {katalog.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name} ({euro(a.preis)})</option>)}
              </select>
            )}
            {daten.material.length > 0 && <p className="text-right text-sm font-bold mt-1">{euro(materialSumme)}</p>}
          </Sektion>
        )}

        <Sektion nr={naechste()} titel="NACHHER – Ergebnis der Arbeit" pflicht erfuellt={fotosNachher.length >= 1}>
          {fotoSektion({ phase: 'nachher' })}
        </Sektion>

        <Sektion nr={naechste()} titel="Unterschriften" pflicht={typ === 'abnahme'} erfuellt={abnahmeUnterschriftenOk}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                Auftraggeber / Bauleitung {typ === 'abnahme' ? '(Pflicht)' : '(optional – gilt als Anerkenntnis)'}
              </p>
              {alteKunde && !kundeCanvas ? (
                <div>
                  <img src={alteKunde} alt="Unterschrift Kunde" className="h-20 border border-slate-200 rounded-xl bg-white" />
                  {!gesperrt && <button onClick={() => setAlteKunde('')} className="mt-1 text-xs text-slate-500 hover:text-praxis-600">Neu unterschreiben</button>}
                </div>
              ) : gesperrt ? <p className="text-xs text-slate-400">Keine Unterschrift hinterlegt.</p> : (
                <UnterschriftFeld onAenderung={setKundeCanvas} />
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="text" className={feld} placeholder="Vor- und Nachname *" value={daten.unterschriftName} onChange={set('unterschriftName')} disabled={gesperrt} />
                <input type="text" className={feld} placeholder="Funktion (z. B. Bauleiter) *" value={daten.unterschriftFunktion} onChange={set('unterschriftFunktion')} disabled={gesperrt} />
                <input type="text" className={`${feld} col-span-2`} placeholder="Firma (z. B. Bothmer Akustikbau GmbH)" value={daten.unterschriftFirma} onChange={set('unterschriftFirma')} disabled={gesperrt} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                Monteur – Gabara Service GmbH {typ === 'abnahme' ? '(Pflicht)' : '(optional)'}
              </p>
              {alteMonteur && !monteurCanvas ? (
                <div>
                  <img src={alteMonteur} alt="Unterschrift Monteur" className="h-20 border border-slate-200 rounded-xl bg-white" />
                  {!gesperrt && <button onClick={() => setAlteMonteur('')} className="mt-1 text-xs text-slate-500 hover:text-praxis-600">Neu unterschreiben</button>}
                </div>
              ) : gesperrt ? <p className="text-xs text-slate-400">Keine Unterschrift hinterlegt.</p> : (
                <UnterschriftFeld onAenderung={setMonteurCanvas} hinweis="Unterschrift Monteur" />
              )}
              <p className="mt-2 text-xs text-slate-400">{mitarbeiter?.name || user?.name || ''}</p>
            </div>
          </div>
        </Sektion>

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>}
        {!gesperrt && !einreichenOk && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Zum Einreichen fehlt noch: {gateHinweis() || '–'}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100">
            {gesperrt ? 'Schließen' : 'Abbrechen'}
          </button>
          {!gesperrt && (
            <>
              <button onClick={() => speichern('entwurf')} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
                Als Entwurf speichern
              </button>
              <button onClick={() => speichern('eingereicht')} disabled={!einreichenOk}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-praxis-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-praxis-700">
                Einreichen
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
