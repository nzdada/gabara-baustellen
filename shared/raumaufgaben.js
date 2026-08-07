// Aufgaben je Raum.
//
// WARUM ZUSÄTZLICH ZU DEN FLÄCHEN
// Die sechs Flächen (Decke, vier Wände, Boden) sagen WO gearbeitet wird. Sie
// sagen nicht WAS: derselbe Raum wird gespachtelt, grundiert, zweimal
// gestrichen. Der Maler denkt in diesen Schritten – "Wohnzimmer gespachtelt"
// ist eine Aussage, "Wohnzimmer 40 %" ist keine.
//
// Deshalb: eine Liste von Arbeitsschritten je Raum, die der Monteur abhakt.
// Sie ist die führende Fortschrittsanzeige. Die Flächen bleiben daneben
// bestehen – dort hängt der Fotonachweis je Wand.
//
// Ein Schritt KANN sich auf eine Fläche beziehen ("Nordwand spachteln"), muss
// aber nicht ("Raum abkleben"). Bezieht er sich auf eine, färbt sich diese
// Fläche in der 3D-Ansicht mit.

// Vorlage für einen typischen Malerauftrag im Innenausbau.
// Das Büro kann sie je Projekt ändern; hier steht nur der Ausgangspunkt.
export const VORLAGE_MALER = [
  { text: 'Abkleben und abdecken' },
  { text: 'Spachteln' },
  { text: 'Schleifen' },
  { text: 'Grundieren' },
  { text: '1. Anstrich' },
  { text: '2. Anstrich' },
  { text: 'Abkleben entfernen, Endreinigung' },
]

export const VORLAGE_KURZ = [
  { text: 'Grundieren' },
  { text: '1. Anstrich' },
  { text: '2. Anstrich' },
]

export const VORLAGEN = [
  { id: 'maler', schluessel: 'aufg.vorlageMaler', schritte: VORLAGE_MALER },
  { id: 'kurz', schluessel: 'aufg.vorlageKurz', schritte: VORLAGE_KURZ },
]

function uuid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Aufgaben aus einer Vorlage bauen
export function ausVorlage(vorlageId = 'maler') {
  const v = VORLAGEN.find((x) => x.id === vorlageId) || VORLAGEN[0]
  return v.schritte.map((s, i) => ({
    id: uuid(),
    text: s.text,
    flaecheId: s.flaecheId || '',
    sort: i,
    fertig: false,
    fertigAm: 0,
    fertigVon: '',
    notiz: '',
  }))
}

export function neueAufgabe(text, sort = 0) {
  return { id: uuid(), text: String(text || '').trim(), flaecheId: '', sort, fertig: false, fertigAm: 0, fertigVon: '', notiz: '' }
}

export function aufgabenVon(raum) {
  const a = Array.isArray(raum?.aufgaben) ? raum.aufgaben : []
  return [...a].sort((x, y) => (x.sort || 0) - (y.sort || 0))
}

// Fortschritt eines Raums NACH AUFGABEN.
//
// Bewusst nach Anzahl und nicht nach Fläche gewichtet: Die Schritte bauen
// aufeinander auf und dauern grob ähnlich lang. Ein "Spachteln" wiegt nicht
// weniger, nur weil der Raum klein ist.
export function fortschrittAufgaben(raum) {
  const a = aufgabenVon(raum)
  if (!a.length) return { prozent: 0, fertig: 0, gesamt: 0, alleFertig: false, hatAufgaben: false }
  const fertig = a.filter((x) => x.fertig).length
  return {
    prozent: Math.round((fertig / a.length) * 100),
    fertig,
    gesamt: a.length,
    alleFertig: fertig === a.length,
    hatAufgaben: true,
    naechste: a.find((x) => !x.fertig) || null,
  }
}

// Welche Flächen gelten als fertig?
//
// Zwei Wege führen dorthin, und beide zählen:
//  - der Zustand der Fläche selbst (raum.status) – gesetzt beim Fertigmelden
//    einer Wand mit Foto,
//  - ALLE Aufgaben des Raums erledigt – dann ist der Raum als Ganzes fertig,
//    und damit auch jede Fläche darin.
// Genau das war der Wunsch: "wenn ein Raum fertig mit Aufgaben, zeige grün".
export function flaechenZustand(raum, flaecheId) {
  const fort = fortschrittAufgaben(raum)
  if (fort.hatAufgaben && fort.alleFertig) return 'fertig'
  const eigener = (raum?.status || {})[flaecheId]
  if (eigener === 'fertig' || eigener === 'arbeit') return eigener
  // Läuft mindestens eine Aufgabe, gilt der Raum als in Arbeit
  if (fort.hatAufgaben && fort.fertig > 0) return 'arbeit'
  return 'offen'
}

// Gesamtfortschritt einer Baustelle nach Aufgaben
export function fortschrittGesamtAufgaben(raeume) {
  let fertig = 0
  let gesamt = 0
  let raeumeGesamt = 0
  let raeumeMitAufgaben = 0
  for (const r of raeume || []) {
    if (r.aktiv === false) continue
    raeumeGesamt++
    const f = fortschrittAufgaben(r)
    if (f.hatAufgaben) raeumeMitAufgaben++
    fertig += f.fertig
    gesamt += f.gesamt
  }
  // WARUM DIE RAUMZAHL MITKOMMT
  // Ein Raum ohne Aufgabenliste liefert gesamt = 0 und fällt damit aus Zähler
  // UND Nenner. Bei 20 Räumen, von denen einer geplant und abgehakt ist, stand
  // deshalb "100 % · 3 von 3 Schritte" – während 19 Räume unberührt waren.
  // Der Prozentwert bleibt ehrlich (er misst die geplanten Schritte), aber der
  // Aufrufer erfährt jetzt, auf wie vielen Räumen er beruht, und kann eine
  // vollständige Zahl von einer halben unterscheiden.
  return {
    prozent: gesamt > 0 ? Math.round((fertig / gesamt) * 100) : 0,
    fertig,
    gesamt,
    raeumeGesamt,
    raeumeMitAufgaben,
    vollstaendig: raeumeGesamt > 0 && raeumeMitAufgaben === raeumeGesamt,
  }
}
