// Abnahmeprotokoll V2 (AP 9, Plan Kapitel 7) – reiner Rechenkern ohne React
// und ohne Store: aus Räumen, Aufgaben, Fotos, Anordnungen und Stunden werden
// die Raumseiten des Protokolls und die Teilabnahme-Aufteilung gebaut.
// Gedruckt wird in admin/src/drucken.js (druckeAbnahme) – dorthin gehen nur
// fertige, datenmodellfreie Strukturen.
//
// DIE TEILABNAHME-REGEL (Plan 7.5): Fehlt einem Raum ein Bild, fällt NICHT
// das ganze Protokoll auf "Zwischenstand" zurück. Vollständige Räume werden
// abgenommen (Frist läuft, Gewährleistung startet je Raum), unvollständige
// stehen NAMENTLICH mit Grund auf dem Deckblatt: "Nicht Gegenstand dieser
// Abnahme". Alles-oder-nichts wäre der sichere Weg zum Platzhalterbild.

import { parseZahl } from './format.js'
import { vorschauPhotoId } from './fotoablage.js'
import { istFertigStatus } from './monteurtag.js'
import { anerkanntAbIso } from './fristen.js'

// Rollen, deren Bilder die Raumtafel füllen (Plan 7.3: NUR diese Rolle wird
// gezogen – sonst kämen bei 24 Räumen rund 264 Tagesfotos ins Protokoll).
const RAUMTAFEL_ROLLEN = new Set(['fototafel', 'raumtafel'])

// ------------------------------------------------------- Bildauswahl je Raum

// Automatische Vorauswahl (Plan 7.3): frühestes Vorher, spätestes Nachher –
// deterministisch, keine Sortiergeste nötig. `fotos` sind die V2-Metadaten
// (Sammlung fotos), nicht die Bilddaten.
// Beim REGIE-Paar zählt auch rolle 'meldebeleg': das Vorher/Nachher aus
// "Regie melden" IST das Bildpaar der Anordnung. Im Auftrag bleibt die
// Rolle streng – sonst fluten Tages-Meldebelege das Protokoll.
export function fotoPaar(fotos, { raumId, kontext = 'auftrag' } = {}) {
  const rollen = kontext === 'regie'
    ? new Set([...RAUMTAFEL_ROLLEN, 'meldebeleg'])
    : RAUMTAFEL_ROLLEN
  const passend = (Array.isArray(fotos) ? fotos : []).filter((f) => f.raumId === raumId
    && (f.kontext || 'auftrag') === kontext
    && rollen.has(f.rolle || 'fototafel'))
  const zeit = (f) => Number(f.aufgenommenAm) || Number(f.erstelltAm) || 0
  const vorher = passend.filter((f) => f.phase === 'vorher')
    .sort((a, b) => zeit(a) - zeit(b))[0] || null
  const nachher = passend.filter((f) => f.phase === 'nachher')
    .sort((a, b) => zeit(b) - zeit(a))[0] || null
  return { vorher, nachher }
}

// Bildquelle zu einem fotos-Metadatendokument: im Rückfallweg 'vorschau'
// liegt das 400er-Derivat als dataUrl in der photos-Sammlung (pv-<id>),
// im Storage-Modus zeigt pfade.druck auf das 900er-Derivat. Das Protokoll
// bettet bewusst NIE das 1600er-Beweisbild ein (Plan 7.3 – 24 Räume würden
// jedes Druckfenster sprengen); das Original bleibt über die Prüfsumme
// nachweisbar.
export function bildQuelle(foto, photos = []) {
  if (!foto) return ''
  const vorschau = (Array.isArray(photos) ? photos : [])
    .find((p) => p.id === vorschauPhotoId(foto.id) || p.fotoId === foto.id)
  if (vorschau?.dataUrl) return vorschau.dataUrl
  return foto.pfade?.druck || foto.pfade?.vorschau || ''
}

// Die Beweiszeile unters Bild (Plan 7.4): Aufnahmezeit mit QUELLE (EXIF oder
// Gerät), Servereingang und Prüfsumme – nie der Druckzeitpunkt.
export function fotoBeleg(foto, photos = []) {
  if (!foto) return null
  return {
    bild: bildQuelle(foto, photos),
    aufgenommenAm: Number(foto.aufgenommenAm) || 0,
    quelle: foto.aufgenommenAmQuelle === 'exif' ? 'EXIF' : 'Gerät',
    pruefsumme: (foto.sha256 || '').slice(0, 8),
    hochgeladenAm: Number(foto.hochgeladenAm) || 0,
  }
}

// ------------------------------------------------------- Teilabnahme

// Wartet dieser Raum (Plan 4.2 raeume.zustand bzw. wartende Aufgaben)?
function wartetGrundVon(raum, aufgabenDesRaums) {
  if (raum.zustand === 'wartet') return raum.wartetGrund || 'zugestellt'
  const wartend = (aufgabenDesRaums || []).find((a) => a.status === 'wartet')
  return wartend ? (wartend.wartetGrund || 'zugestellt') : ''
}

// Aufteilung der Räume für die Teilabnahme. Vollständig heißt: beide
// Auftrags-Bilder liegen vor (raum.fotoStand) und der Raum wartet nicht.
// Bereits abgenommene Räume (frühere Teilabnahme) werden nicht erneut
// abgenommen – sie stehen nachrichtlich auf dem Deckblatt.
export function teilabnahme(raeume = [], aufgaben = []) {
  const abzunehmen = []
  const ausgenommen = []
  const bereitsAbgenommen = []
  for (const raum of raeume) {
    if (raum.aktiv === false) continue
    if (raum.abnahmeAm) { bereitsAbgenommen.push(raum) ; continue }
    const stand = raum.fotoStand || {}
    const desRaums = aufgaben.filter((a) => a.raumId === raum.id)
    const gruende = []
    if (!parseZahl(stand.auftragVorher)) gruende.push('vorherFehlt')
    if (!parseZahl(stand.auftragNachher)) gruende.push('nachherFehlt')
    const wartet = wartetGrundVon(raum, desRaums)
    if (wartet) gruende.push(`wartet:${wartet}`)
    if (gruende.length) ausgenommen.push({ raum, gruende })
    else abzunehmen.push(raum)
  }
  return { abzunehmen, ausgenommen, bereitsAbgenommen }
}

// Die Raum-Patches für store.schreibeVorgang: Teilabnahme setzt je
// vollständigem Raum abnahmeAm/abnahmeVon/abnahmeBerichtId (Plan 7.5 –
// die Gewährleistungsfrist startet RAUMWEISE). EIN Vorgang, kein Löschen.
export function abnahmePatches(aufteilung, { berichtId = '', datum = '', von = '' } = {}) {
  return (aufteilung?.abzunehmen || []).map((raum) => ({
    coll: 'raeume',
    id: raum.id,
    patch: { abnahmeAm: datum, abnahmeVon: von, abnahmeBerichtId: berichtId },
  }))
}

// ------------------------------------------------------- Raumseiten

// Deutsche Grundtexte für den Ausdruck (PDF bleibt deutsch – Hausregel).
const WARTET_TEXT = {
  zugestellt: 'wartet: zugestellt',
  vorgewerkFehlt: 'wartet: Vorgewerk fehlt',
  keinZutritt: 'wartet: kein Zutritt',
  estrichNass: 'wartet: Estrich nass',
  kundeSperrt: 'wartet: Kunde sperrt',
}

export function grundText(grund) {
  if (grund === 'vorherFehlt') return 'Vorher-Bild fehlt'
  if (grund === 'nachherFehlt') return 'Nachher-Bild fehlt'
  if (grund.startsWith('wartet:')) return WARTET_TEXT[grund.slice(7)] || grund
  return grund
}

const ANZEIGE_TEXT = { muendlich: 'mündlich vor Ort', schriftlich: 'schriftlich', mail: 'per E-Mail' }

// Eine Seite je abzunehmendem Raum (Plan 7.2): AUFTRAG mit Mengenzeilen und
// Bildpaar, darunter REGIE mit Anordnung, Anerkennungsstand, Bildpaar und
// Stunden – beide Bildpaare auf demselben Blatt (die Anforderung wörtlich).
export function abnahmeSeiten({ raeume = [], aufgaben = [], fotos = [], photos = [], anordnungen = [], stunden = [] } = {}) {
  const aufteilung = teilabnahme(raeume, aufgaben)
  const seiten = aufteilung.abzunehmen.map((raum) => {
    const desRaums = aufgaben
      .filter((a) => a.raumId === raum.id)
      .sort((a, b) => parseZahl(a.schrittSort) - parseZahl(b.schrittSort))
    const auftragAufgaben = desRaums.filter((a) => (a.art || 'auftrag') !== 'regie')
    const paarAuftrag = fotoPaar(fotos, { raumId: raum.id, kontext: 'auftrag' })

    // Regieteil nur, wenn eine Anordnung diesen Raum betrifft ODER ein
    // Regie-Bildpaar am Raum hängt (Anordnung ohne raumIds: Foto entscheidet).
    const paarRegie = fotoPaar(fotos, { raumId: raum.id, kontext: 'regie' })
    const anordnung = anordnungen.find((a) => (a.raumIds || []).includes(raum.id))
      || (paarRegie.vorher || paarRegie.nachher
        ? anordnungen.find((a) => a.id === (paarRegie.vorher || paarRegie.nachher).anordnungId)
        : null)
    let regie = null
    if (anordnung) {
      const regieStunden = stunden
        .filter((s) => !s.storniert && s.anordnungId === anordnung.id)
        .reduce((summe, s) => summe + parseZahl(s.stundenGesamt), 0)
      regie = {
        titel: anordnung.titel || '',
        beschreibung: anordnung.beschreibung || '',
        angeordnetDurch: anordnung.angeordnetDurch || '',
        angeordnetAm: anordnung.angeordnetAm || '',
        anzeigeText: ANZEIGE_TEXT[anordnung.anzeigeArt] || ANZEIGE_TEXT.muendlich,
        vorgelegtAm: anordnung.vorgelegtAm || '',
        anerkanntAb: anordnung.vorgelegtAm
          ? (anordnung.anerkanntAb || anerkanntAbIso(anordnung.vorgelegtAm)) : '',
        bestritten: Boolean(anordnung.widersprochenAm || anordnung.status === 'bestritten'),
        stunden: Math.round(regieStunden * 100) / 100,
        vorher: fotoBeleg(paarRegie.vorher, photos),
        nachher: fotoBeleg(paarRegie.nachher, photos),
      }
    }

    return {
      raum,
      auftrag: {
        zeilen: auftragAufgaben.map((a) => ({
          schritt: a.schrittNameDe || a.schrittId || '',
          menge: parseZahl(a.menge),
          einheit: a.einheit || 'm²',
          oz: a.oz || '',
          fertig: istFertigStatus(a.status),
        })),
        ausgefuehrt: auftragAufgaben.filter((a) => istFertigStatus(a.status))
          .map((a) => a.schrittNameDe || a.schrittId).join(' · '),
        vorher: fotoBeleg(paarAuftrag.vorher, photos),
        nachher: fotoBeleg(paarAuftrag.nachher, photos),
      },
      regie,
    }
  })
  return { aufteilung, seiten }
}
