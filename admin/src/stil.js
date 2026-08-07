// EINZIGE Quelle für die Optik der Büro-Verwaltung.
//
// Regel: Keine Seite und keine Komponente definiert eigene feld-/knopf-/karte-
// Klassenstrings. Wer ein neues Muster braucht, ergänzt es HIER.
// Die Tokens dahinter stehen in admin/src/index.css.
//
// Die Monteur-Handy-Ansicht (pages/monteur/) ist bewusst ausgenommen –
// dort gelten große Touch-Ziele statt Büro-Dichte.

/* ---------------- Seitenrahmen + Seitenkopf ---------------- */
// Volle Breite wie zuvor – kein max-w, der Bildschirm wird ausgenutzt.
export const SEITE = 'p-4 lg:p-6'
export const SEITE_SCHMAL = 'p-4 lg:p-6'
export const KOPF = 'flex flex-wrap items-center gap-x-4 gap-y-3 mb-6'
export const KOPF_KACHEL = 'w-11 h-11 rounded-karte bg-praxis-50 text-praxis-600 flex items-center justify-center shrink-0'
export const KOPF_TITEL = 'text-titel font-bold text-schrift-stark'
export const KOPF_SUB = 'text-sm text-schrift-leise mt-0.5'
export const KOPF_AKTION = 'ml-auto flex flex-wrap items-center gap-2'

/* ---------------- Karte / Panel ---------------- */
export const KARTE = 'bg-karte rounded-karte border border-rahmen shadow-karte'
export const KARTE_PAD = 'bg-karte rounded-karte border border-rahmen shadow-karte p-5'
export const KARTE_KOPF = 'flex flex-wrap items-center gap-2.5 px-5 py-3.5 bg-gedeckt border-b border-rahmen rounded-t-karte'
export const KARTE_TITEL = 'text-abschnitt font-bold text-schrift-stark'
export const KARTE_BODY = 'p-5'
export const KARTE_LISTE = 'divide-y divide-rahmen'
export const KARTE_ZEILE = 'px-5 py-4 flex flex-wrap items-start gap-x-4 gap-y-3 hover:bg-praxis-50/60 transition'

/* ---------------- Knöpfe (je zwei Größen) ---------------- */
const B = 'inline-flex items-center justify-center gap-2 font-semibold rounded-feld transition select-none '
  + 'disabled:opacity-45 disabled:pointer-events-none focus:outline-none '
  + 'focus-visible:ring-2 focus-visible:ring-praxis-400 focus-visible:ring-offset-2'

export const BTN_PRIMAER = `${B} px-4 py-2.5 text-sm bg-praxis-600 text-white hover:bg-praxis-700`
export const BTN_PRIMAER_S = `${B} px-3 py-1.5 text-xs bg-praxis-600 text-white hover:bg-praxis-700`
export const BTN_ZWEIT = `${B} px-4 py-2.5 text-sm bg-karte text-schrift border border-rahmen-stark hover:border-praxis-400 hover:text-praxis-700 hover:bg-praxis-50`
export const BTN_ZWEIT_S = `${B} px-3 py-1.5 text-xs bg-karte text-schrift border border-rahmen-stark hover:border-praxis-400 hover:text-praxis-700`
export const BTN_GEFAHR = `${B} px-4 py-2.5 text-sm bg-gefahr text-white hover:brightness-110`
export const BTN_GEFAHR_S = `${B} px-3 py-1.5 text-xs bg-gefahr-flaeche text-gefahr hover:bg-gefahr hover:text-white`
export const BTN_STILL = `${B} px-3 py-2 text-sm text-schrift-leise hover:bg-gedeckt hover:text-schrift-stark`
export const BTN_ICON = 'inline-flex items-center justify-center w-9 h-9 rounded-feld text-schrift-zart hover:text-praxis-600 hover:bg-praxis-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-praxis-400'
export const BTN_ICON_GEFAHR = 'inline-flex items-center justify-center w-9 h-9 rounded-feld text-schrift-zart hover:text-gefahr hover:bg-gefahr-flaeche transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gefahr'

/* ---------------- Formular ---------------- */
export const LABEL = 'flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-schrift-leise mb-1.5'
export const FELD = 'w-full rounded-feld border border-rahmen bg-karte px-3.5 py-2.5 text-sm text-schrift '
  + 'placeholder:text-schrift-zart transition focus:outline-none focus:border-praxis-500 '
  + 'focus:ring-4 focus:ring-praxis-500/12 disabled:bg-gedeckt disabled:text-schrift-zart'
export const FELD_S = 'w-full rounded-feld border border-rahmen bg-karte px-2.5 py-1.5 text-xs text-schrift '
  + 'placeholder:text-schrift-zart focus:outline-none focus:border-praxis-500 focus:ring-4 focus:ring-praxis-500/12'
export const SELECT = `${FELD} select-pfeil`
export const SELECT_S = `${FELD_S} select-pfeil`
export const TEXTAREA = `${FELD} min-h-24 resize-y leading-relaxed`
export const FELD_ERR = 'border-gefahr bg-gefahr-flaeche/50 focus:border-gefahr focus:ring-gefahr/15'
export const ERR_TEXT = 'mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-gefahr'
export const FELD_REIHE = 'grid grid-cols-1 sm:grid-cols-2 gap-4'

/* ---------------- Tabelle (kein Zebra: feine Linie + kräftiger Hover) ---------------- */
export const TAB_HUELLE = 'bg-karte rounded-karte border border-rahmen shadow-karte overflow-hidden'
export const TAB_SCROLL = 'overflow-x-auto'
export const TAB = 'w-full text-sm'
export const TH = 'px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wider text-schrift-leise bg-gedeckt border-b border-rahmen whitespace-nowrap'
export const TH_FILTER = 'px-3 py-2 bg-gedeckt border-b border-rahmen'
export const TR = 'border-b border-rahmen last:border-0 transition cursor-pointer hover:bg-praxis-50/70'
export const TD = 'px-4 py-3.5 text-schrift align-middle'
export const TD_STARK = 'px-4 py-3.5 font-semibold text-schrift-stark align-middle'
export const TD_LEISE = 'px-4 py-3.5 text-[14px] text-schrift-leise align-middle'
export const TD_ZAHL = 'px-4 py-3.5 text-right font-semibold text-schrift-stark whitespace-nowrap zahl align-middle'
export const TD_ICON = 'px-3 py-3.5 w-10 text-schrift-zart align-middle'

/* ---------------- Chips / Badges ---------------- */
export const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap'
export const CHIP_NEUTRAL = `${CHIP} bg-gedeckt-tief text-schrift-leise`
export const CHIP_MARKE = `${CHIP} bg-praxis-100 text-praxis-800`
export const CHIP_OK = `${CHIP} bg-ok-flaeche text-ok`
export const CHIP_WARN = `${CHIP} bg-warnung-flaeche text-warnung`
export const CHIP_GEFAHR = `${CHIP} bg-gefahr-flaeche text-gefahr`
export const CHIP_INFO = `${CHIP} bg-info-flaeche text-info`
export const ZAEHLER = 'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-praxis-600 text-white text-[12px] font-bold zahl'
export const ZAEHLER_STILL = 'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-gedeckt-tief text-schrift-leise text-[12px] font-bold zahl'

/** Status-Chip einfärben: <span className={CHIP} style={chipTon(st.farbe)}> */
export const chipTon = (hex) => ({ backgroundColor: `${hex}1f`, color: hex })

/* ---------------- Filterleiste / Chip-Reihe ---------------- */
export const FILTERLEISTE = 'flex items-center gap-2 overflow-x-auto pb-1.5 mb-5 -mx-1 px-1'
export const FCHIP = 'shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-praxis-400'
export const FCHIP_AUS = 'bg-karte border-rahmen text-schrift-leise hover:border-praxis-400 hover:text-praxis-700'
export const FCHIP_AN = 'bg-praxis-600 border-praxis-600 text-white'
export const FZAHL_AUS = 'rounded-full bg-gedeckt-tief px-1.5 py-0.5 text-[11px] text-schrift-leise zahl'
export const FZAHL_AN = 'rounded-full bg-karte/25 px-1.5 py-0.5 text-[11px] zahl'
export const SEGMENT = 'inline-flex items-center gap-1 rounded-full border border-rahmen bg-karte p-1'
export const SEG_AUS = 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-schrift-leise hover:bg-gedeckt transition'
export const SEG_AN = 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold bg-praxis-600 text-white transition'

/* ---------------- Leerzustand ---------------- */
export const LEER = 'flex flex-col items-center justify-center text-center px-6 py-14'
export const LEER_KREIS = 'w-14 h-14 rounded-full bg-praxis-50 text-praxis-400 flex items-center justify-center mb-3'
export const LEER_TITEL = 'font-bold text-schrift-stark'
export const LEER_TEXT = 'mt-1 text-sm text-schrift-leise max-w-sm'

/* ---------------- Meldung / Hinweis ---------------- */
const M = 'flex items-start gap-2.5 rounded-feld border px-4 py-3 text-sm'
export const MELDUNG_OK = `${M} bg-ok-flaeche border-ok/25 text-ok`
export const MELDUNG_WARN = `${M} bg-warnung-flaeche border-warnung/25 text-warnung`
export const MELDUNG_GEFAHR = `${M} bg-gefahr-flaeche border-gefahr/25 text-gefahr`
export const MELDUNG_INFO = `${M} bg-info-flaeche border-info/25 text-info`

/* ---------------- Dialog ---------------- */
export const MODAL_HUELLE = 'fixed inset-0 flex items-end sm:items-center justify-center bg-praxis-900/45 p-0 sm:p-4'
export const MODAL_KARTE = 'bg-karte w-full rounded-t-modal sm:rounded-modal shadow-hoch max-h-[92vh] flex flex-col'
export const MODAL_KOPF = 'flex items-center gap-3 px-6 py-4 border-b border-rahmen shrink-0'
export const MODAL_KACHEL = 'w-9 h-9 rounded-feld bg-praxis-50 text-praxis-600 flex items-center justify-center shrink-0'
export const MODAL_TITEL = 'font-bold text-schrift-stark'
export const MODAL_BODY = 'overflow-y-auto px-6 py-5'
export const MODAL_FUSS = 'flex flex-wrap gap-2 px-6 py-4 border-t border-rahmen bg-gedeckt rounded-b-modal shrink-0'

/* ---------------- Navigation (helle Seitenleiste) ---------------- */
// Dunkle Seitenleiste (Original): helle Schrift auf praxis-900
export const NAV_LINK = 'flex items-center gap-3 px-3 py-2.5 rounded-feld text-sm font-medium transition'
export const NAV_AUS = 'text-praxis-100/80 hover:bg-white/10'
export const NAV_AN = 'bg-praxis-600 text-white'
// Helle Variante für Navigationen INNERHALB einer Karte (Projekt-Detail, Reiter)
export const NAV_HELL_AUS = 'text-schrift hover:bg-praxis-50/60'
export const NAV_HELL_AN = 'bg-praxis-600 text-white'
export const NAV_MOB = 'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition'
export const NAV_MOB_AN = 'text-praxis-700'
export const NAV_MOB_AUS = 'text-schrift-zart'

/* ---------------- Kennzahl-Kachel ---------------- */
export const KPI = 'bg-karte rounded-karte border border-rahmen shadow-karte p-5 flex items-start gap-4'
export const KPI_KACHEL = 'w-11 h-11 rounded-feld bg-praxis-50 text-praxis-600 flex items-center justify-center shrink-0'
export const KPI_ZAHL = 'text-[28px] leading-none font-bold text-schrift-stark zahl'
export const KPI_LABEL = 'text-xs font-semibold uppercase tracking-wider text-schrift-leise mt-1'

/* ---------------- Feste Zuordnung Begriff -> Icon ----------------
   Gilt app-weit. Wer ein Icon braucht, nimmt es HIER heraus – so heißt
   dieselbe Sache überall gleich und das Auge findet sie wieder. */
export const IKON = {
  projekt: 'folder', baustelle: 'baustelle', kunde: 'firma', mitarbeiter: 'person', team: 'team',
  termin: 'calendar', terminliste: 'list', bericht: 'bericht', regie: 'regie',
  reklamation: 'reklamation', abnahme: 'abnahme', rechnung: 'rechnung', abrechnung: 'euro',
  material: 'material', stunden: 'stunden', spesen: 'spesen', fahrt: 'truck', foto: 'foto',
  unterschrift: 'signatur', lv: 'lv', anschrift: 'pin', telefon: 'phone', email: 'mail',
  anfragen: 'inbox', einstellungen: 'zahnrad', dashboard: 'diagramm', uebersicht: 'home',
  import: 'upload', pdf: 'pdf', drucken: 'drucken', speichern: 'speichern', suche: 'suche',
  filter: 'filter', bearbeiten: 'stift', loeschen: 'muell', kopieren: 'kopieren', neu: 'plus',
  schliessen: 'x', zurueck: 'arrowLeft', weiter: 'arrowRight', aufklappen: 'chevronUnten',
  monteur: 'tablet', abmelden: 'logout', warnung: 'alert', erfolg: 'erfolg', info: 'info',
}

/* Berichts-Typ und Vorgangs-Status -> Icon */
export const IKON_BERICHT = { regie: 'regie', reklamation: 'reklamation', abnahme: 'abnahme' }
export const IKON_STATUS = {
  entwurf: 'stift', eingereicht: 'inbox', freigegeben: 'erfolg', abgerechnet: 'euro',
  vorbereitet: 'stift', uebertragen: 'arrowRight', gestellt: 'mail', bezahlt: 'erfolg',
  storniert: 'x', erstattet: 'erfolg',
}
