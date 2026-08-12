import { useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { euro, parseZahl } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { komprimiere, GRENZE_BYTES } from '@shared/bild.js'
import { UnterschriftFeld, unterschriftAlsDataUrl } from '@shared/unterschrift.jsx'
import { useEntwurf } from '@shared/entwurf.js'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'
import Modal from '../components/Modal.jsx'
import EntwurfHinweis from '../components/EntwurfHinweis.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, Meldung } from '../components/Seite.jsx'
import { druckeRegieFrei } from '../drucken.js'

// FREIE REGIE (ausdrücklicher Wunsch des Inhabers): ein Regiebericht OHNE
// Projektbindung – für Arbeiten, die nie als Projekt angelegt wurden.
//
// ZWEI verbindliche Nachträge des Inhabers:
//  a) Der freie Regiebericht erzeugt AUSSCHLIESSLICH ein PDF. Er taucht in
//     KEINER Gesamtabrechnung auf – nicht im RechnungWizard, nicht in der
//     Abrechnung, nicht in den Kennzahlen, nicht im Stundenzettel. Dafür
//     trägt jedes Dokument `frei: true`, und alle Auswertungen nehmen es
//     hart aus. NIE Stundenzeilen in die Sammlung `stunden` schreiben!
//  b) Unterschrift AM HANDY VOR ORT: die vorhandene Unterschrift-Komponente
//     (shared/unterschrift.jsx, Vollbild-Dialog) direkt im Formular –
//     Auftraggeber/Bauleitung mit Name + Funktion, Auftragnehmer optional.
//     Beide Bilder wandern MIT in die Entwurfssicherung (Fund der
//     V1-Prüfung: sonst sind sie nach dem Neuladen weg).
//
// Speicherform (berichte-Dokument): typ 'regie', frei: true, projektId: '',
// baustelleFrei{name,ort,auftraggeber}, zeitraumVon, zeitraumBis,
// beschreibung, anordnung{durch,am,art}, stunden[{name,qualifikation,tage,
// stdProTag,satz}], status 'entwurf' | 'abgeschlossen'.

function lokaleUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `rf-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Zeilensumme einer Stundenzeile: Tage × Std/Tag × Lohn (parseZahl, weil
// "8,5" in Textfeldern steht – Number("8,5") wäre NaN und still 0).
function zeilenSumme(z) {
  return parseZahl(z.tage) * parseZahl(z.stdProTag) * parseZahl(z.satz)
}

function gesamtSumme(stunden) {
  return (stunden || []).reduce((s, z) => s + zeilenSumme(z), 0)
}

function datumKurz(iso) {
  return iso ? datumLok(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
}

// Höchstens `ms` auf den Server warten (Muster BerichtForm/mitFrist):
// offline geht der Schreibvorgang in die Warteschlange – nichts darf hängen.
function mitFrist(versprechen, ms = 2500) {
  versprechen.catch(() => {})
  return Promise.race([
    versprechen,
    new Promise((auf) => setTimeout(() => auf(undefined), ms)),
  ])
}

// ---------------------------------------------------------------- Formular

function RegieFreiForm({ bericht = null, user, onClose }) {
  useLang()
  const users = useCollection('users')
  const einst = useEinstellungen()
  const gesperrt = Boolean(bericht && bericht.status === 'abgeschlossen')

  // Lokale Kennung VOR dem ersten Foto (Eiserne Regel: nie eine
  // Server-Kennung vor einem Foto). Sie wandert in die Entwurfssicherung,
  // sonst wären bereits gesicherte Fotos nach dem Neuladen Waisen.
  const draftId = useRef(bericht?.id || lokaleUuid())
  const docAngelegt = useRef(Boolean(bericht))
  const [fotoSchluessel, setFotoSchluessel] = useState(draftId.current)
  // Firestore liefert where()-Treffer in Dokument-ID-Reihenfolge (Zufalls-IDs) –
  // Galerie und PDF sollen die Aufnahme-/Upload-Reihenfolge zeigen (createdAt).
  const fotosRoh = useWhere('photos', 'berichtId', fotoSchluessel)
  const fotos = [...fotosRoh].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const fotoRef = useRef(null)

  const satzFuer = (qualifikation) => Number(
    qualifikation === 'helfer' ? (einst.regieHelfer ?? 31) : (einst.regieFacharbeiter ?? 35)
  ) || 0

  const neueZeile = (qualifikation = 'facharbeiter') => ({
    name: '', qualifikation, tage: '1', stdProTag: '8', satz: String(satzFuer(qualifikation)),
  })

  const [daten, setDaten] = useState(() => ({
    baustelleName: bericht?.baustelleFrei?.name || '',
    baustelleOrt: bericht?.baustelleFrei?.ort || '',
    auftraggeber: bericht?.baustelleFrei?.auftraggeber || '',
    beschreibung: bericht?.beschreibung || '',
    zeitraumVon: bericht?.zeitraumVon || heuteISO(),
    zeitraumBis: bericht?.zeitraumBis || heuteISO(),
    anordnungDurch: bericht?.anordnung?.durch || '',
    anordnungAm: bericht?.anordnung?.am || '',
    anordnungArt: bericht?.anordnung?.art || '',
    stunden: bericht?.stunden?.length
      ? bericht.stunden.map((z) => ({
          name: z.name || '',
          qualifikation: z.qualifikation === 'helfer' ? 'helfer' : 'facharbeiter',
          tage: String(z.tage ?? ''), stdProTag: String(z.stdProTag ?? ''), satz: String(z.satz ?? ''),
        }))
      : [neueZeile()],
    // Unterschriften als Bild im Formularzustand: so überleben sie die
    // Entwurfssicherung (Fund der V1-Prüfung).
    unterschriftName: bericht?.unterschriftName || '',
    unterschriftFunktion: bericht?.unterschriftFunktion || '',
    unterschriftKundeBild: bericht?.unterschriftKunde || '',
    unterschriftMonteurName: bericht?.unterschriftMonteurName || user?.name || '',
    unterschriftMonteurBild: bericht?.unterschriftMonteur || '',
  }))
  const [fehler, setFehler] = useState('')
  const [ladeFoto, setLadeFoto] = useState(false)
  const [laeuft, setLaeuft] = useState(false)

  const set = (feldName) => (e) => setDaten((d) => ({ ...d, [feldName]: e.target.value }))
  const setZeile = (i, felder) => setDaten((d) => ({
    ...d, stunden: d.stunden.map((z, j) => (j === i ? { ...z, ...felder } : z)),
  }))

  // Entwurfs-Sicherung: Formularzustand + lokale Berichtskennung. Die Fotos
  // hängen bereits am Store (berichtId), nur die Kennung darf nicht verloren
  // gehen – deshalb steht sie MIT im Entwurf.
  const entwurfDaten = { draftId: draftId.current, ...daten }
  const entwurf = useEntwurf(`regie-frei:${bericht?.id || 'neu'}`, entwurfDaten, !gesperrt)

  function entwurfZurueckholen() {
    const alt = entwurf.wiederherstellen()
    if (!alt) return
    if (!bericht && alt.draftId) {
      draftId.current = alt.draftId
      setFotoSchluessel(alt.draftId)
    }
    const { draftId: _weg, ...rest } = alt
    setDaten((d) => ({ ...d, ...rest }))
  }

  const summe = gesamtSumme(daten.stunden)
  const stundenOk = daten.stunden.length > 0
    && daten.stunden.every((z) => z.name.trim() && parseZahl(z.tage) > 0 && parseZahl(z.stdProTag) > 0)
  const zeitraumOk = Boolean(daten.zeitraumVon && daten.zeitraumBis && daten.zeitraumVon <= daten.zeitraumBis)
  const anordnungFehlt = !daten.anordnungDurch.trim()
  const abschliessenOk = daten.baustelleName.trim() && daten.beschreibung.trim() && zeitraumOk && stundenOk

  function gateHinweis() {
    const teile = []
    if (!daten.baustelleName.trim()) teile.push(t('rf.gateBaustelle'))
    if (!daten.beschreibung.trim()) teile.push(t('allg.beschreibung'))
    if (!zeitraumOk) teile.push(t('rf.gateZeitraum'))
    if (!stundenOk) teile.push(t('rf.gateStunden'))
    return teile.join(' · ')
  }

  // Der Bericht wird VOR dem ersten Foto als Entwurf angelegt, damit die
  // photos-Dokumente nie an einer ungespeicherten Kennung hängen.
  async function stelleDocSicher() {
    if (docAngelegt.current) return
    try {
      await mitFrist(withStore((s) => s.add('berichte', {
        id: draftId.current, typ: 'regie', frei: true, projektId: '',
        mitarbeiterId: user?.userId || '', mitarbeiterName: user?.name || '',
        datum: heuteISO(), status: 'entwurf', beschreibung: daten.beschreibung,
        baustelleFrei: { name: daten.baustelleName, ort: daten.baustelleOrt, auftraggeber: daten.auftraggeber },
        createdAt: Date.now(), eingereichtAm: 0,
      })))
      docAngelegt.current = true
    } catch (e) {
      docAngelegt.current = false
      throw e
    }
  }

  // VIELE Fotos auf einmal (Mehrfachauswahl), Phase 'sonstig' – es gibt hier
  // bewusst KEINE Vorher-/Nachher-Pflicht. Vorhandene Foto-Infrastruktur:
  // komprimiere() + GRENZE_BYTES + photos-Sammlung mit berichtId-Bezug.
  async function fotosHinzu(e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length || gesperrt) return
    setFehler('')
    setLadeFoto(true)
    try {
      for (const datei of dateien) {
        if (!datei.type.startsWith('image/')) { setFehler(t('bf.fehlerKeinBild', { name: datei.name })); continue }
        const dataUrl = await komprimiere(datei)
        if (dataUrl.length > GRENZE_BYTES) { setFehler(t('bf.fehlerZuGross')); continue }
        await stelleDocSicher()
        await mitFrist(withStore((s) => s.add('photos', {
          projektId: '', berichtId: draftId.current, terminId: '',
          phase: 'sonstig', dataUrl, name: datei.name,
          von: user?.name || '', vonId: user?.userId || '', createdAt: Date.now(),
        })))
      }
    } catch (err) {
      setFehler(err.message || t('bf.fehlerBild'))
    } finally {
      setLadeFoto(false)
    }
  }

  async function fotoLoeschen(foto) {
    if (gesperrt) return
    if (!confirm(t('bf.fotoLoeschenFrage'))) return
    await withStore((s) => s.remove('photos', foto.id))
  }

  async function speichern(status) {
    if (gesperrt || laeuft) return
    if (status === 'abgeschlossen' && !abschliessenOk) {
      setFehler(t('bf.fehltNoch', { text: gateHinweis() }))
      return
    }
    setLaeuft(true)
    try {
      // Schutz gegen zwei offene Tabs/Geräte: ist der Bericht auf dem Server
      // inzwischen abgeschlossen (unterschrieben – Beweismittel § 15 Abs. 3
      // VOB/B), darf dieser eingefrorene Formularstand ihn NICHT mehr per
      // setDoc-Upsert überschreiben. Die Firestore-Regel (gesperrterStatus)
      // lehnt den Schreibversuch serverseitig ohnehin ab – hier gibt es die
      // verständliche Meldung dazu. Offline (Frist abgelaufen) wird normal
      // weitergeschrieben; dann entscheidet die Server-Regel.
      const aufServer = await mitFrist(withStore((s) => s.get('berichte', draftId.current)))
      if (aufServer && aufServer.status === 'abgeschlossen') {
        setFehler(t('rf.bereitsAbgeschlossen'))
        return
      }
      const doc = {
        id: draftId.current, typ: 'regie', frei: true, projektId: '',
        mitarbeiterId: bericht?.mitarbeiterId || user?.userId || '',
        mitarbeiterName: bericht?.mitarbeiterName || user?.name || '',
        datum: heuteISO(), status,
        baustelleFrei: {
          name: daten.baustelleName.trim(),
          ort: daten.baustelleOrt.trim(),
          auftraggeber: daten.auftraggeber.trim(),
        },
        zeitraumVon: daten.zeitraumVon,
        zeitraumBis: daten.zeitraumBis,
        beschreibung: daten.beschreibung,
        anordnung: {
          durch: daten.anordnungDurch.trim(),
          am: daten.anordnungAm,
          art: daten.anordnungArt,
        },
        stunden: daten.stunden
          .filter((z) => z.name.trim() || parseZahl(z.tage) > 0)
          .map((z) => ({
            name: z.name.trim(),
            qualifikation: z.qualifikation === 'helfer' ? 'helfer' : 'facharbeiter',
            tage: parseZahl(z.tage) || 0,
            stdProTag: parseZahl(z.stdProTag) || 0,
            satz: parseZahl(z.satz) || satzFuer(z.qualifikation),
          })),
        unterschriftKunde: daten.unterschriftKundeBild || '',
        unterschriftName: daten.unterschriftName.trim(),
        unterschriftFunktion: daten.unterschriftFunktion.trim(),
        unterschriftMonteur: daten.unterschriftMonteurBild || '',
        unterschriftMonteurName: daten.unterschriftMonteurName.trim(),
        createdAt: bericht?.createdAt || Date.now(),
        eingereichtAm: bericht?.eingereichtAm || 0,
        abgeschlossenAm: status === 'abgeschlossen' ? Date.now() : (bericht?.abgeschlossenAm || 0),
      }
      docAngelegt.current = true
      await mitFrist(withStore((s) => s.add('berichte', doc)))
      // BEWUSST keine Zeilen in die Sammlung `stunden` und keine Kennzahlen:
      // der freie Regiebericht ist ein eigenständiges Papier (Nachtrag a).
      entwurf.loeschen()
      onClose()
    } catch (e) {
      setFehler(e.message || '')
    } finally {
      setLaeuft(false)
    }
  }

  // Große Trefferflächen: das Formular wird am Handy vor Ort ausgefüllt und
  // unterschrieben – min-h-12 auf allen Eingaben, Knöpfe min-h-12.
  const feld = 'w-full min-h-12 rounded-feld border border-rahmen bg-karte px-3 py-2 text-sm text-schrift focus:outline-none focus:ring-2 focus:ring-praxis-500 disabled:bg-gedeckt disabled:text-schrift-zart'
  const label = 'block text-xs font-semibold text-schrift-leise mb-1'

  return (
    <Modal
      titel={`${t('rf.titel')} · ${bericht ? t(gesperrt ? 'allg.ansehen' : 'allg.bearbeiten') : t('rf.neuKurz')}`}
      icon="regie"
      onClose={onClose}
      breite="max-w-3xl"
    >
      <div className="space-y-3">
        <EntwurfHinweis eintrag={entwurf.gefunden} onWiederherstellen={entwurfZurueckholen} onVerwerfen={entwurf.verwerfen} />

        {/* Nachtrag a des Inhabers – SICHTBAR auf der Seite */}
        <Meldung art="info">{t('rf.hinweisNurPdf')}</Meldung>

        {/* Baustelle als FREITEXT – bewusst KEIN Projekt-Dropdown */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-3">{t('rf.abschnittBaustelle')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>{t('rf.baustelleName')} *</label>
              <input type="text" className={feld} value={daten.baustelleName} onChange={set('baustelleName')}
                placeholder={t('rf.baustelleNamePlatz')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('rf.baustelleOrt')}</label>
              <input type="text" className={feld} value={daten.baustelleOrt} onChange={set('baustelleOrt')}
                placeholder={t('rf.baustelleOrtPlatz')} disabled={gesperrt} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t('rf.auftraggeber')}</label>
              <input type="text" className={feld} value={daten.auftraggeber} onChange={set('auftraggeber')}
                placeholder={t('rf.auftraggeberPlatz')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('rf.zeitraumVon')} *</label>
              <input type="date" dir="ltr" className={feld} value={daten.zeitraumVon} onChange={set('zeitraumVon')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('rf.zeitraumBis')} *</label>
              <input type="date" dir="ltr" className={feld} value={daten.zeitraumBis} onChange={set('zeitraumBis')} disabled={gesperrt} />
            </div>
          </div>
        </section>

        {/* Arbeiten / Beschreibung */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-3">{t('rf.abschnittArbeiten')} *</p>
          <textarea rows={4} className={`${feld} min-h-24`} value={daten.beschreibung} onChange={set('beschreibung')}
            placeholder={t('rf.arbeitenPlatz')} disabled={gesperrt} />
        </section>

        {/* Anordnung – sichtbar, aber NICHT blockierend */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-3">{t('rf.abschnittAnordnung')}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>{t('bf.angeordnetDurch')}</label>
              <input type="text" className={feld} value={daten.anordnungDurch} onChange={set('anordnungDurch')}
                placeholder={t('bf.angeordnetPlatz')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('bf.angeordnetAm')}</label>
              <input type="date" dir="ltr" className={feld} value={daten.anordnungAm} onChange={set('anordnungAm')} disabled={gesperrt} />
            </div>
            <div>
              <label className={label}>{t('bf.anzeigeArt')}</label>
              <select className={feld} value={daten.anordnungArt} onChange={set('anordnungArt')} disabled={gesperrt}>
                <option value="">{t('allg.waehlen')}</option>
                <option value="muendlich">{t('bf.muendlich')}</option>
                <option value="schriftlich">{t('bf.schriftlich')}</option>
                <option value="mail">{t('bf.perMail')}</option>
              </select>
            </div>
          </div>
          {anordnungFehlt && !gesperrt && (
            <div className="mt-3"><Meldung art="warnung">{t('rf.anordnungWarnung')}</Meldung></div>
          )}
        </section>

        {/* Stunden: Zeilen mit Freitext-Name (datalist), Qualifikation,
            Tage × Std/Tag × Lohn. Beispiel des Inhabers – „4 Tage,
            2 Facharbeiter + 1 Helfer" – sind drei Zeilen. */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-1">{t('rf.abschnittStunden')} *</p>
          <p className="text-[12px] text-schrift-zart mb-3">{t('rf.stundenHinweis')}</p>
          <datalist id="rf-namen">
            {users.filter((u) => u.aktiv !== false && u.name).map((u) => <option key={u.id} value={u.name} />)}
          </datalist>
          {daten.stunden.map((z, i) => (
            <div key={i} className="border border-rahmen rounded-feld p-2.5 mb-2 grid grid-cols-6 gap-2 items-end">
              <div className="col-span-6 sm:col-span-2 min-w-0">
                <label className={label}>{t('allg.name')} *</label>
                <input type="text" list="rf-namen" className={feld} value={z.name} disabled={gesperrt}
                  placeholder={t('bf.vorNachname')}
                  onChange={(e) => setZeile(i, { name: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-1 min-w-0">
                <label className={label}>{t('rf.qualifikation')}</label>
                <select className={`${feld} !px-1.5`} value={z.qualifikation} disabled={gesperrt}
                  onChange={(e) => setZeile(i, { qualifikation: e.target.value, satz: String(satzFuer(e.target.value)) })}>
                  <option value="facharbeiter">{t('einst.facharbeiter')}</option>
                  <option value="helfer">{t('einst.helfer')}</option>
                </select>
              </div>
              <div className="col-span-1 min-w-0">
                <label className={label}>{t('rf.tage')}</label>
                <input type="text" inputMode="decimal" className={`${feld} !px-1.5 text-center`} value={z.tage} disabled={gesperrt}
                  onChange={(e) => setZeile(i, { tage: e.target.value })} />
              </div>
              <div className="col-span-1 min-w-0">
                <label className={label}>{t('rf.stdProTag')}</label>
                <input type="text" inputMode="decimal" className={`${feld} !px-1.5 text-center`} value={z.stdProTag} disabled={gesperrt}
                  onChange={(e) => setZeile(i, { stdProTag: e.target.value })} />
              </div>
              <div className="col-span-1 min-w-0">
                <label className={label}>{t('rf.lohn')}</label>
                <input type="text" inputMode="decimal" className={`${feld} !px-1.5 text-center`} value={z.satz} disabled={gesperrt}
                  onChange={(e) => setZeile(i, { satz: e.target.value })} />
              </div>
              <div className="col-span-6 flex items-center gap-2 pt-0.5">
                <span className="text-[12px] text-schrift-leise">
                  {parseZahl(z.tage)} × {parseZahl(z.stdProTag)} {t('allg.stunden')} × {euro(parseZahl(z.satz))} ={' '}
                  <strong>{euro(zeilenSumme(z))}</strong>
                </span>
                {!gesperrt && daten.stunden.length > 1 && (
                  <button
                    onClick={() => setDaten((d) => ({ ...d, stunden: d.stunden.filter((_, j) => j !== i) }))}
                    className="ml-auto min-h-11 px-2 text-schrift-zart hover:text-red-500"
                    title={t('lv.zeileEntfernen')}
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            {!gesperrt ? (
              <button
                onClick={() => setDaten((d) => ({ ...d, stunden: [...d.stunden, neueZeile()] }))}
                className="min-h-12 px-4 rounded-feld border border-rahmen bg-karte text-sm font-semibold text-praxis-600 hover:bg-praxis-50"
              >
                + {t('rf.zeileNeu')}
              </button>
            ) : <span />}
            <span className="text-sm font-bold">{t('rf.gesamt')}: {euro(summe)}</span>
          </div>
        </section>

        {/* Fotos: VIELE auf einmal, keine Vorher-/Nachher-Pflicht */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-3">
            {t('rf.abschnittFotos')}
            <span className="ml-2 text-xs font-semibold text-schrift-leise">{t('rf.fotoAnzahl', { n: fotos.length })}</span>
          </p>
          {!gesperrt && (
            <button onClick={() => fotoRef.current?.click()} disabled={ladeFoto}
              className="w-full min-h-12 px-3 rounded-feld bg-schrift text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="foto" className="w-4 h-4" />
              {ladeFoto ? t('bf.verarbeite') : t('rf.fotosHochladen')}
            </button>
          )}
          <input ref={fotoRef} type="file" accept="image/*" multiple className="hidden" onChange={fotosHinzu} />
          {fotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {fotos.map((f) => (
                <div key={f.id} className="relative">
                  <img src={f.dataUrl} alt={f.name} className="w-full h-24 object-cover rounded-feld border border-rahmen" />
                  {!gesperrt && (
                    <button onClick={() => fotoLoeschen(f)} aria-label={t('allg.loeschen')}
                      className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center bg-karte/90 rounded-full text-schrift-leise hover:text-red-600">
                      <Icon name="x" className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-schrift-zart">{t('rf.keineFotos')}</p>
          )}
        </section>

        {/* Unterschrift am Handy vor Ort (Nachtrag b) */}
        <section className={S.KARTE + ' p-4'}>
          <p className="text-sm font-bold text-schrift-stark mb-3">{t('bf.sektionUnterschriften')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-schrift-leise mb-1.5">{t('rf.unterschriftKunde')}</p>
              {daten.unterschriftKundeBild ? (
                <div>
                  <img src={daten.unterschriftKundeBild} alt="" style={{ backgroundColor: '#ffffff' }}
                    className="w-full h-24 object-contain border border-rahmen rounded-feld" />
                  {!gesperrt && (
                    <button onClick={() => setDaten((d) => ({ ...d, unterschriftKundeBild: '' }))}
                      className="mt-1 min-h-11 text-xs text-schrift-leise hover:text-praxis-600">
                      {t('bf.neuUnterschreiben')}
                    </button>
                  )}
                </div>
              ) : gesperrt ? <p className="text-xs text-schrift-zart">{t('bf.keineUnterschrift')}</p> : (
                <UnterschriftFeld onAenderung={(canvas) => setDaten((d) => ({
                  ...d, unterschriftKundeBild: canvas ? unterschriftAlsDataUrl(canvas) : '',
                }))} />
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="text" className={feld} placeholder={t('bf.vorNachname')}
                  value={daten.unterschriftName} onChange={set('unterschriftName')} disabled={gesperrt} />
                <input type="text" className={feld} placeholder={t('bf.funktion')}
                  value={daten.unterschriftFunktion} onChange={set('unterschriftFunktion')} disabled={gesperrt} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-schrift-leise mb-1.5">{t('rf.unterschriftAn')}</p>
              {daten.unterschriftMonteurBild ? (
                <div>
                  <img src={daten.unterschriftMonteurBild} alt="" style={{ backgroundColor: '#ffffff' }}
                    className="w-full h-24 object-contain border border-rahmen rounded-feld" />
                  {!gesperrt && (
                    <button onClick={() => setDaten((d) => ({ ...d, unterschriftMonteurBild: '' }))}
                      className="mt-1 min-h-11 text-xs text-schrift-leise hover:text-praxis-600">
                      {t('bf.neuUnterschreiben')}
                    </button>
                  )}
                </div>
              ) : gesperrt ? <p className="text-xs text-schrift-zart">{t('bf.keineUnterschrift')}</p> : (
                <UnterschriftFeld onAenderung={(canvas) => setDaten((d) => ({
                  ...d, unterschriftMonteurBild: canvas ? unterschriftAlsDataUrl(canvas) : '',
                }))} />
              )}
              <input type="text" className={`${feld} mt-2`} placeholder={t('bf.vorNachname')}
                value={daten.unterschriftMonteurName} onChange={set('unterschriftMonteurName')} disabled={gesperrt} />
            </div>
          </div>
        </section>

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-feld px-3 py-2">{fehler}</p>}
        {!gesperrt && !abschliessenOk && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-feld px-3 py-2">
            {t('bf.fehltNoch', { text: gateHinweis() || '–' })}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-rahmen">
          <button onClick={onClose} className="min-h-12 px-4 rounded-feld text-sm font-medium text-schrift-leise hover:bg-gedeckt-tief">
            {t(gesperrt ? 'allg.schliessen' : 'allg.abbrechen')}
          </button>
          {!gesperrt && (
            <>
              <button onClick={() => speichern('entwurf')} disabled={laeuft}
                className="min-h-12 px-4 rounded-feld text-sm font-medium bg-gedeckt-tief text-schrift disabled:opacity-40">
                {t('rw.alsEntwurf')}
              </button>
              <button onClick={() => speichern('abgeschlossen')} disabled={!abschliessenOk || laeuft}
                className="min-h-12 px-4 rounded-feld text-sm font-bold bg-praxis-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-praxis-700">
                {t('rf.abschliessen')}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Seite

export default function RegieFrei({ user }) {
  useLang()
  const berichte = useCollection('berichte')
  const einst = useEinstellungen()
  const [formular, setFormular] = useState(null)   // 'neu' | bericht-Objekt

  const freie = berichte
    .filter((b) => b.typ === 'regie' && b.frei === true)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  async function drucken(b) {
    const fotos = await withStore((s) => (s.listWhere
      ? s.listWhere('photos', 'berichtId', b.id)
      : s.list('photos').then((alle) => alle.filter((p) => p.berichtId === b.id))))
    // Aufnahme-/Upload-Reihenfolge statt Zufalls-Dokument-IDs (Firestore where())
    fotos.sort((a, b2) => (a.createdAt || 0) - (b2.createdAt || 0))
    druckeRegieFrei({ bericht: b, fotos, einst })
  }

  return (
    <div className={S.SEITE_SCHMAL}>
      <Seitenkopf icon="regie" titel={t('nav.regieFrei')} sub={t('rf.sub')}>
        <button onClick={() => setFormular('neu')} className={S.BTN_PRIMAER}>
          <Icon name="plus" groesse="s" /> {t('rf.neu')}
        </button>
      </Seitenkopf>

      {/* Nachtrag a des Inhabers – gut sichtbar auf der Seite */}
      <div className="mb-4"><Meldung art="info">{t('rf.hinweisNurPdf')}</Meldung></div>

      {freie.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="regie" titel={t('rf.leerTitel')} text={t('rf.leerText')} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {freie.map((b) => (
            <div key={b.id} className="bg-karte rounded-karte border border-rahmen shadow-karte p-4 flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{t('rf.kennzeichen')}</span>
              <button onClick={() => setFormular(b)} className="flex-1 min-w-[200px] text-start">
                <p className="font-semibold text-schrift-stark truncate">
                  {b.baustelleFrei?.name || t('rf.titel')}
                  {b.baustelleFrei?.ort ? <span className="font-normal text-schrift-leise"> · {b.baustelleFrei.ort}</span> : null}
                </p>
                <p className="text-sm text-schrift-leise truncate">
                  {b.baustelleFrei?.auftraggeber || '–'} · {datumKurz(b.zeitraumVon)} – {datumKurz(b.zeitraumBis)}
                  {' · '}{euro(gesamtSumme(b.stunden))}
                </p>
              </button>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${b.status === 'abgeschlossen' ? 'bg-emerald-100 text-emerald-700' : 'bg-gedeckt-tief text-schrift'}`}>
                {t(b.status === 'abgeschlossen' ? 'status.abgeschlossen' : 'status.entwurf')}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => setFormular(b)} className="min-h-11 px-3 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium">
                  {t(b.status === 'abgeschlossen' ? 'allg.ansehen' : 'allg.bearbeiten')}
                </button>
                <button onClick={() => drucken(b)} className="min-h-11 px-3 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium flex items-center gap-1">
                  <Icon name="doc" className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formular && (
        <RegieFreiForm
          bericht={formular === 'neu' ? null : formular}
          user={user}
          onClose={() => setFormular(null)}
        />
      )}
    </div>
  )
}
