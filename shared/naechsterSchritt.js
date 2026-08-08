// Was ist als Nächstes zu tun?
//
// WARUM ES DAS GIBT
// Rückmeldung des Auftraggebers: "das Programm ist schwer zu bedienen". Auf
// Nachfrage war es nicht die Zahl der Menüpunkte, nicht die Tipperei und nicht
// die Fachbegriffe – sondern: man weiß nicht, was als Nächstes kommt.
//
// Die bisherige Übersicht war ein ZWEITES Menü: sechs Kacheln, die auf Bereiche
// verlinken. Sie zeigt Zahlen, aber keine Handlung. Wer nicht weiß, dass nach
// dem Anlegen einer Baustelle das Leistungsverzeichnis kommt, erfährt es dort
// nicht.
//
// Deshalb hier: Regeln über den vorhandenen Daten, die konkrete Sätze mit einem
// Ziel liefern. Kein neues Datenfeld, keine neue Sammlung.
//
// GRUNDSÄTZE
// - Jede Handlung nennt ein ZIEL (Link) und ist in einem Satz gesagt.
// - Sortiert nach Dringlichkeit, nicht nach Bereich.
// - Was nichts zu tun gibt, erscheint NICHT. Eine Liste, die immer gleich
//   aussieht, wird nach drei Tagen übersehen.
// - Reine Funktionen ohne React: so sind sie prüfbar, ohne die Oberfläche zu
//   starten.

import { istOffen } from './projektstatus.js'
import { fortschrittRaum } from './raumflaeche.js'
import { fortschrittAufgaben } from './raumaufgaben.js'
import { heuteISO } from './slots.js'
import { mengenAbweichung, zahlText } from './aufmass.js'
import { isoVonZeit, addMonate } from './abrechnung.js'
import { parseZahl } from './format.js'

// Dringlichkeit: kleiner = weiter oben
export const DRINGEND = 0     // kostet Geld oder blockiert andere
export const OFFEN = 1        // wartet auf eine Entscheidung
export const HINWEIS = 2      // sollte irgendwann

function tageSeit(iso) {
  if (!iso) return 0
  const dann = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(dann.getTime())) return 0
  return Math.floor((Date.now() - dann.getTime()) / 86400000)
}

function tageSeitZahl(ms) {
  if (!ms) return 0
  return Math.floor((Date.now() - ms) / 86400000)
}

// ---------------------------------------------------------------- Büro

export function schritteBuero({
  projekte = [], lvpositionen = [], berichte = [], appointments = [],
  requests = [], users = [], rechnungen = [], spesen = [], leistungen = [],
  raeume = [],
} = {}) {
  const raus = []
  const heute = heuteISO()

  // 1. Neue Anfragen von der Webseite – jeder Tag ohne Antwort kostet den Auftrag
  const neue = requests.filter((r) => r.status === 'neu')
  if (neue.length) {
    const aeltester = Math.max(...neue.map((r) => tageSeitZahl(r.createdAt)))
    raus.push({
      id: 'anfragen',
      stufe: aeltester >= 2 ? DRINGEND : OFFEN,
      icon: 'inbox',
      text: { de: `${neue.length} neue Anfrage(n) von der Webseite`, ar: `${neue.length} طلب جديد من الموقع` },
      detail: aeltester >= 2
        ? { de: `Die älteste liegt seit ${aeltester} Tagen`, ar: `الأقدم منذ ${aeltester} يومًا` }
        : null,
      ziel: '/anfragen',
      knopf: { de: 'Ansehen', ar: 'عرض' },
    })
  }

  // 2. Eingereichte Berichte – ohne Freigabe zählen sie weder für den
  //    Stundenzettel noch für die Rechnung. Das ist der häufigste Stau.
  const eingereicht = berichte.filter((b) => b.status === 'eingereicht')
  if (eingereicht.length) {
    const aeltester = Math.max(...eingereicht.map((b) => tageSeitZahl(b.eingereichtAm)))
    raus.push({
      id: 'berichte-freigeben',
      stufe: aeltester >= 3 ? DRINGEND : OFFEN,
      icon: 'bericht',
      text: { de: `${eingereicht.length} Bericht(e) warten auf Freigabe`, ar: `${eingereicht.length} تقرير بانتظار الاعتماد` },
      detail: aeltester >= 3
        ? { de: `Seit ${aeltester} Tagen. Erst nach der Freigabe zählen die Stunden und die Mengen.`,
            ar: `منذ ${aeltester} يومًا. لا تُحتسب الساعات والكميات إلا بعد الاعتماد.` }
        : { de: 'Erst nach der Freigabe zählen die Stunden und die Mengen.',
            ar: 'لا تُحتسب الساعات والكميات إلا بعد الاعتماد.' },
      ziel: '/berichte',
      knopf: { de: 'Freigeben', ar: 'اعتماد' },
    })
  }

  // 3. Laufende Baustelle ohne Leistungsverzeichnis – ohne LV gibt es nichts
  //    abzurechnen und der Monteur sieht keine Aufgaben.
  const mitLv = new Set(lvpositionen.map((p) => p.projektId))
  const ohneLv = projekte.filter((p) => istOffen(p.status) && !mitLv.has(p.id))
  for (const p of ohneLv.slice(0, 3)) {
    raus.push({
      id: `lv-fehlt-${p.id}`,
      stufe: OFFEN,
      icon: 'lv',
      text: { de: `${p.name}: noch kein Leistungsverzeichnis`, ar: `${p.name}: لا يوجد جدول كميات بعد` },
      detail: { de: 'Ohne LV lässt sich nichts abrechnen, und auf dem Handy stehen keine Aufgaben.',
                ar: 'بدون جدول الكميات لا يمكن إصدار فاتورة، ولا تظهر مهام على الهاتف.' },
      ziel: `/projekte/${p.id}?bereich=lv`,
      knopf: { de: 'LV importieren', ar: 'استيراد الجدول' },
    })
  }

  // 4. Freigegebene, aber noch nicht abgerechnete Leistung – hier liegt Geld
  const freigegeben = berichte.filter((b) => b.status === 'freigegeben')
  if (freigegeben.length) {
    const jeProjekt = {}
    for (const b of freigegeben) {
      const summe = (b.stunden || []).reduce((s, z) => s + (Number(z.anzahl) || 0) * (Number(z.satz) || 0), 0)
        + (b.material || []).reduce((s, m) => s + (Number(m.menge) || 0) * (Number(m.preis) || 0), 0)
      jeProjekt[b.projektId] = (jeProjekt[b.projektId] || 0) + summe
    }
    for (const [projektId, betrag] of Object.entries(jeProjekt).slice(0, 3)) {
      const p = projekte.find((x) => x.id === projektId)
      if (!p || betrag <= 0) continue
      raus.push({
        id: `abrechnen-${projektId}`,
        stufe: OFFEN,
        icon: 'euro',
        text: { de: `${p.name}: freigegebene Leistung noch nicht abgerechnet`, ar: `${p.name}: أعمال معتمدة لم تُفوتر بعد` },
        detail: { de: `Rund ${betrag.toFixed(0)} € aus Regieberichten`, ar: `نحو ${betrag.toFixed(0)} يورو من تقارير الساعات` },
        ziel: '/abrechnung',
        knopf: { de: 'Rechnung erstellen', ar: 'إنشاء فاتورة' },
      })
    }
  }

  // 5. Einsätze ohne zugewiesenen Monteur – die erscheinen auf keinem Handy
  const ohneMonteur = appointments.filter(
    (a) => a.datum >= heute && !a.erledigt && !(a.mitarbeiterIds || []).length && a.projektId
  )
  if (ohneMonteur.length) {
    raus.push({
      id: 'einsatz-ohne-monteur',
      stufe: DRINGEND,
      icon: 'calendar',
      text: { de: `${ohneMonteur.length} Einsatz/Einsätze ohne Monteur`, ar: `${ohneMonteur.length} مهمة بدون فني` },
      detail: { de: 'Sie stehen im Kalender, erscheinen aber auf keinem Handy – niemand fährt hin.',
                ar: 'تظهر في التقويم لكنها لا تصل إلى أي هاتف – لن يذهب أحد.' },
      ziel: '/',
      knopf: { de: 'Zuweisen', ar: 'إسناد' },
    })
  }

  // 5b. Raeume, die der Monteur fertig gemeldet hat.
  //
  // Das ist der Bogen von der Baustelle ins Buero: Was draussen abgehakt wird,
  // muss hier ankommen, sonst meldet der Monteur ins Leere.
  //
  // ZWEI WEGE FUEHREN ZU "FERTIG", UND BEIDE ZAEHLEN:
  //  - alle ARBEITSSCHRITTE des Raums abgehakt (Aufgabenliste), oder
  //  - alle FLAECHEN des Raums mit Foto fertig gemeldet.
  // Vorher zaehlte nur der erste. Ein Projekt frisch aus dem Plan-Import hat
  // aber gar keine Aufgaben (PlanImport legt `aufgaben: []` an) – dort meldete
  // der Monteur 24 Raeume mit Deckenfoto und vier Wandfotos fertig, und im
  // Buero erschien nie ein einziger Hinweis. 442 dokumentierte Quadratmeter
  // blieben unabgerechnet liegen.
  const raumFertig = (r) => {
    const ausAufgaben = fortschrittAufgaben(r)
    if (ausAufgaben.hatAufgaben) return ausAufgaben.alleFertig
    return fortschrittRaum(r).alleFertig
  }
  const fertigeRaeume = raeume.filter((r) => r.aktiv !== false && raumFertig(r))
  if (fertigeRaeume.length) {
    const jeProjekt = {}
    for (const r of fertigeRaeume) {
      ;(jeProjekt[r.projektId] = jeProjekt[r.projektId] || []).push(r)
    }
    for (const [projektId, liste] of Object.entries(jeProjekt).slice(0, 3)) {
      const p = projekte.find((x) => x.id === projektId)
      if (!p) continue
      const namen = liste.slice(0, 3).map((r) => r.nummer || r.name || '?').join(', ')
      const alleRaeume = raeume.filter((r) => r.projektId === projektId && r.aktiv !== false)
      const komplett = alleRaeume.length > 0 && liste.length === alleRaeume.length
      raus.push({
        id: `raeume-fertig-${projektId}`,
        stufe: komplett ? DRINGEND : OFFEN,
        icon: 'raum',
        text: komplett
          ? { de: `${p.name}: alle ${liste.length} Räume fertig gemeldet`, ar: `${p.name}: تم الإبلاغ عن اكتمال جميع الغرف (${liste.length})` }
          : { de: `${p.name}: ${liste.length} von ${alleRaeume.length} Räumen fertig`, ar: `${p.name}: ${liste.length} من ${alleRaeume.length} غرف منجزة` },
        detail: komplett
          ? { de: `Alle Aufgaben abgehakt (${namen}${liste.length > 3 ? ' …' : ''}). Mengen prüfen und abrechnen.`,
              ar: `اكتملت جميع المهام (${namen}${liste.length > 3 ? ' …' : ''}). راجع الكميات وأصدر الفاتورة.` }
          : { de: `Fertig: ${namen}${liste.length > 3 ? ' …' : ''}`, ar: `منجز: ${namen}${liste.length > 3 ? ' …' : ''}` },
        ziel: `/projekte/${projektId}?bereich=raeume`,
        knopf: { de: 'Räume ansehen', ar: 'عرض الغرف' },
      })
    }
  }

  // 6. Mitarbeiter ohne Benutzerkonto – ohne UID greift die Übergangsregel und
  //    jeder Angemeldete darf alles; außerdem trennt der Stundenzettel nicht sauber.
  const ohneKonto = users.filter((u) => u.aktiv !== false
    && ['mitarbeiter', 'vorarbeiter'].includes(u.rolle) && !u.email)
  if (ohneKonto.length) {
    raus.push({
      id: 'users-ohne-konto',
      stufe: HINWEIS,
      icon: 'zahnrad',
      text: { de: `${ohneKonto.length} Mitarbeiter ohne Benutzerkonto`, ar: `${ohneKonto.length} موظف بدون حساب` },
      detail: { de: 'Ohne eigenes Konto lassen sich Stunden und Meldungen nicht sauber zuordnen.',
                ar: 'بدون حساب خاص لا يمكن ربط الساعات والبلاغات بشكل صحيح.' },
      ziel: '/einstellungen',
      knopf: { de: 'Einstellungen', ar: 'الإعدادات' },
    })
  }

  // 7. Eingereichte Spesen
  const spesenOffen = spesen.filter((s) => s.status === 'eingereicht')
  if (spesenOffen.length) {
    raus.push({
      id: 'spesen',
      stufe: HINWEIS,
      icon: 'spesen',
      text: { de: `${spesenOffen.length} Spesen-Beleg(e) noch nicht erstattet`, ar: `${spesenOffen.length} إيصال مصاريف لم يُسدّد` },
      detail: null,
      ziel: '/berichte',
      knopf: { de: 'Ansehen', ar: 'عرض' },
    })
  }

  return raus.sort((a, b) => a.stufe - b.stufe)
}

// ---------------------------------------------------------------- Leitstand (AP 7)
//
// Das Band WAS HAKT der Leitstand-Übersicht (Plan 3.2): höchstens 7 Zeilen,
// sonst ein grüner Balken. Diese Regeln lesen NUR, was der Leitstand ohnehin
// geladen hat – Teams, die Einsätze des Tages, Regieanordnungen, LV-Positionen,
// Geräte-Lebenszeichen und die Kennzahlen-Unterdokumente. KEIN Aufgaben-Vollabo.
//
// `kennzahlen` ist die Liste der projekte/{id}/kennzahlen/live-Dokumente
// (id = projektId); `teams` kommt aus teamsAus() (shared/teams.js).

// Stundenzettel nach § 15 Abs. 3 VOB/B: ab so vielen Tagen ohne Vorlage wird
// die Zeile DRINGEND – jeder weitere Tag verschiebt die Anerkennungsuhr.
export const STUNDENZETTEL_FRIST_TAGE = 3

// Einbehalte tauchen so viele Monate VOR der Fälligkeit im Band WAS HAKT auf –
// genug Vorlauf, um Bürgschaft oder Anforderung vorzubereiten (Plan 8.9).
export const EINBEHALT_VORLAUF_MONATE = 3

export function schritteLeitstand({
  teams = [], einsaetzeHeute = [], regieanordnungen = [], lvpositionen = [],
  projekte = [], geraete = [], kennzahlen = [], users = [], einbehalte = [], jetzt = Date.now(),
} = {}) {
  const raus = []
  const projektVon = (id) => projekte.find((p) => p.id === id)
  const tageSeitMs = (ms) => (ms ? Math.floor((jetzt - ms) / 86400000) : 0)

  // 1. Kolonne ohne Einsatz heute – Leute stehen ohne Baustelle da.
  const abgedeckt = (team) => einsaetzeHeute.some((e) => e.status !== 'abgesagt'
    && (e.teamId === team.name || e.teamName === team.name
      || (e.mitarbeiterIds || []).some((id) => team.mitglieder.some((m) => m.id === id))))
  for (const team of teams) {
    if (abgedeckt(team)) continue
    raus.push({
      id: `kolonne-frei-${team.name}`,
      stufe: DRINGEND,
      icon: 'team',
      text: { de: `${team.name} hat heute keinen Einsatz`, ar: `${team.name} بدون مهمة اليوم` },
      detail: { de: `${team.mitglieder.length} Mann ohne Baustelle.`, ar: `${team.mitglieder.length} عامل بدون ورشة.` },
      ziel: '/uebersicht#wochentafel',
      knopf: { de: 'Wochentafel', ar: 'جدول الأسبوع' },
    })
  }

  // 2. Regie ausgeführt, Stundenzettel nicht vorgelegt – § 15 Abs. 3 VOB/B.
  //    Ohne Vorlage läuft KEINE Anerkennungsfrist; jeder Tag kostet.
  const offeneVorlagen = regieanordnungen
    .filter((a) => a.status === 'ausgefuehrt' && !a.vorgelegtAm)
    .map((a) => ({ a, tage: tageSeitMs(a.ausgefuehrtAm || a.angeordnetAm) }))
    .sort((x, y) => y.tage - x.tage)
  for (const { a, tage } of offeneVorlagen.slice(0, 2)) {
    const p = projektVon(a.projektId)
    raus.push({
      id: `regie-vorlage-${a.id}`,
      stufe: tage >= STUNDENZETTEL_FRIST_TAGE ? DRINGEND : OFFEN,
      icon: 'regie',
      text: {
        de: `Regie „${a.titel || '?'}“${p ? ` (${p.name})` : ''}: Stundenzettel seit ${tage} Tag(en) nicht vorgelegt`,
        ar: `عمل إضافي «${a.titel || '?'}»${p ? ` (${p.name})` : ''}: كشف الساعات لم يُقدَّم منذ ${tage} يوم`,
      },
      detail: { de: '§ 15 Abs. 3 VOB/B – erst die Vorlage startet die Anerkennungsfrist.',
                ar: '§ 15 Abs. 3 VOB/B – لا تبدأ مهلة الاعتراف إلا بالتقديم.' },
      ziel: '/berichte',
      knopf: { de: 'Jetzt vorlegen', ar: 'قدّم الآن' },
    })
  }

  // 3. Mengen-Abweichung über 10 % (§ 2 Abs. 3 VOB/B) – nur MEHRmengen:
  //    weniger Ist als Soll ist mitten in der Arbeit der Normalfall.
  const offeneIds = new Set(projekte.filter((p) => istOffen(p.status)).map((p) => p.id))
  const abweichungen = lvpositionen
    .filter((pos) => pos.typ === 'position' && offeneIds.has(pos.projektId) && parseZahl(pos.menge) > 0)
    .map((pos) => ({ pos, ab: mengenAbweichung(parseZahl(pos.menge), parseZahl(pos.istMenge)) }))
    .filter(({ ab }) => ab.ueberSchwelle && ab.richtung === 'mehr')
    .sort((x, y) => y.ab.prozent - x.ab.prozent)
  for (const { pos, ab } of abweichungen.slice(0, 2)) {
    const p = projektVon(pos.projektId)
    raus.push({
      id: `abweichung-${pos.id}`,
      stufe: DRINGEND,
      icon: 'lv',
      text: {
        de: `${p?.name || '?'} Pos. ${pos.oz || '?'}: Ist ${zahlText(parseZahl(pos.istMenge))} zu Soll ${zahlText(parseZahl(pos.menge))} ${pos.einheit || ''} = +${zahlText(ab.prozent)} %`,
        ar: `${p?.name || '?'} بند ${pos.oz || '?'}: المنفَّذ ${zahlText(parseZahl(pos.istMenge))} مقابل ${zahlText(parseZahl(pos.menge))} ${pos.einheit || ''} = ‎+${zahlText(ab.prozent)} %`,
      },
      detail: { de: '§ 2 Abs. 3 VOB/B: neuen Einheitspreis verlangen – Herleitung beilegen.',
                ar: '§ 2 Abs. 3 VOB/B: يمكن المطالبة بسعر وحدة جديد – أرفق الحساب.' },
      ziel: `/projekte/${pos.projektId}?bereich=lv`,
      knopf: { de: 'Nachtrag', ar: 'ملحق' },
    })
  }

  // 4. Aufgaben ohne LV-Position – zusätzliche Leistung: Nachtrag VOR der
  //    Ausführung ankündigen (§ 2 Abs. 6 VOB/B), sonst ist das Geld weg.
  for (const k of kennzahlen) {
    const n = Math.round(parseZahl(k?.aufgabenOhnePosition))
    if (n <= 0) continue
    const p = projektVon(k.id)
    raus.push({
      id: `ohne-position-${k.id}`,
      stufe: DRINGEND,
      icon: 'alert',
      text: { de: `${p?.name || k.id}: ${n} Aufgabe(n) ohne LV-Position`, ar: `${p?.name || k.id}: ${n} مهمة بدون بند في جدول الكميات` },
      detail: { de: '§ 2 Abs. 6 VOB/B: Nachtrag VOR der Ausführung ankündigen.',
                ar: '§ 2 Abs. 6 VOB/B: أعلن عن الملحق قبل التنفيذ.' },
      ziel: `/projekte/${k.id}?bereich=lv`,
      knopf: { de: 'Ankündigung', ar: 'إعلان' },
    })
  }

  // 5. Räume ohne Vorher-Foto – ohne Vorher-Bild ist der Nachher-Beweis
  //    bei der Abnahme nichts wert.
  for (const k of kennzahlen) {
    const n = Math.round(parseZahl(k?.raeumeOhneVorher))
    if (n <= 0) continue
    const p = projektVon(k.id)
    raus.push({
      id: `ohne-vorher-${k.id}`,
      stufe: OFFEN,
      icon: 'foto',
      text: { de: `${p?.name || k.id}: ${n} Raum/Räume ohne Vorher-Foto`, ar: `${p?.name || k.id}: ${n} غرفة بدون صورة «قبل»` },
      detail: { de: 'Ohne Vorher-Bild taugt das Nachher-Bild bei der Abnahme nicht als Beweis.',
                ar: 'بدون صورة «قبل» لا تصلح صورة «بعد» دليلًا عند الاستلام.' },
      ziel: `/fotoampel?projekt=${k.id}`,
      knopf: { de: 'Fotoampel', ar: 'إشارة الصور' },
    })
  }

  // 6. Geräte-Rückstand: Handy seit Tagen ohne Lebenszeichen, Fotos hängen
  //    in der Warteschlange – die Beweise liegen nur auf dem Gerät.
  for (const g of geraete) {
    const wartend = Math.round(parseZahl(g?.wartendeFotos))
    const tage = tageSeitMs(g?.letzterKontaktAm)
    if (wartend <= 0 || tage < 2) continue
    const wer = users.find((u) => u.id === g.id)
    raus.push({
      id: `geraet-${g.id}`,
      stufe: OFFEN,
      icon: 'tablet',
      text: {
        de: `${wer?.name || g.id}: Handy seit ${tage} Tagen ohne Lebenszeichen`,
        ar: `${wer?.name || g.id}: الهاتف بلا إشارة حياة منذ ${tage} يوم`,
      },
      detail: { de: `${wartend} Foto(s) in der Warteschlange – sie liegen nur auf dem Gerät.`,
                ar: `${wartend} صورة في قائمة الانتظار – محفوظة على الجهاز فقط.` },
      ziel: '/einstellungen',
      knopf: { de: 'Geräte', ar: 'الأجهزة' },
    })
  }

  // 7. Sicherheitseinbehalte (Plan 8.9): drei Monate vor Fälligkeit erscheint
  //    die Zeile – ein nicht angemahnter Einbehalt wird in etwa jedem dritten
  //    Fall NIE gezogen. Überfällige werden DRINGEND.
  const heuteIso = isoVonZeit(jetzt)
  const vorlaufBis = addMonate(heuteIso, EINBEHALT_VORLAUF_MONATE)
  const faellige = einbehalte
    .filter((e) => e.status === 'offen' && e.faelligAm && e.faelligAm <= vorlaufBis)
    .sort((x, y) => String(x.faelligAm).localeCompare(String(y.faelligAm)))
  for (const e of faellige.slice(0, 2)) {
    const p = projektVon(e.projektId)
    const ueberfaellig = e.faelligAm < heuteIso
    const betrag = Math.round(parseZahl(e.betrag))
    raus.push({
      id: `einbehalt-${e.id}`,
      stufe: ueberfaellig ? DRINGEND : HINWEIS,
      icon: 'euro',
      text: {
        de: `Einbehalt ${betrag} €${p ? ` (${p.name})` : ''} ${ueberfaellig ? 'ist seit' : 'wird am'} ${e.faelligAm} fällig`,
        ar: `الضمان المحتجز ${betrag} يورو${p ? ` (${p.name})` : ''} ${ueberfaellig ? 'مستحق منذ' : 'يستحق في'} ${e.faelligAm}`,
      },
      detail: { de: 'Anfordern oder durch Bürgschaft ablösen – nicht angemahnte Einbehalte verjähren in der Schublade.',
                ar: 'اطلبه أو استبدله بكفالة – الضمانات غير المطالب بها تسقط بالتقادم.' },
      ziel: '/abrechnung',
      knopf: { de: 'Abrechnung', ar: 'الفوترة' },
    })
  }

  return raus.sort((a, b) => a.stufe - b.stufe)
}

// ---------------------------------------------------------------- Monteur

export function schritteMonteur({ appointments = [], berichte = [], projekte = [], user = null } = {}) {
  const raus = []
  const heute = heuteISO()
  const meine = appointments.filter((a) => (a.mitarbeiterIds || []).includes(user?.userId))

  // 1. Heutiger Einsatz – die eine Sache, die jetzt zählt
  const heutige = meine.filter((a) => a.datum === heute && !a.erledigt)
  for (const a of heutige) {
    const p = projekte.find((x) => x.id === a.projektId)
    raus.push({
      id: `heute-${a.id}`,
      stufe: DRINGEND,
      icon: 'baustelle',
      text: { de: p?.name || a.titel || 'Einsatz heute', ar: p?.name || a.titel || 'مهمة اليوم' },
      detail: { de: `${a.start || ''}–${a.ende || ''} · Mengen melden, wenn du fertig bist`,
                ar: `${a.start || ''}–${a.ende || ''} · أبلغ عن الكميات عند الانتهاء` },
      ziel: a.projektId ? `/monteur/baustelle/${a.projektId}` : '/monteur',
      knopf: { de: 'Zur Baustelle', ar: 'إلى الورشة' },
    })
  }

  // 2. Eigene Entwürfe, die liegen geblieben sind
  const entwuerfe = berichte.filter((b) => b.status === 'entwurf' && b.mitarbeiterId === user?.userId)
  for (const b of entwuerfe.slice(0, 3)) {
    const tage = tageSeit(b.datum)
    raus.push({
      id: `entwurf-${b.id}`,
      stufe: tage >= 1 ? DRINGEND : OFFEN,
      icon: 'bericht',
      text: { de: 'Bericht noch nicht eingereicht', ar: 'تقرير لم يُرسل بعد' },
      detail: tage >= 1
        ? { de: `Seit ${tage} Tag(en) als Entwurf. Solange zählt er nirgends mit.`,
            ar: `مسودة منذ ${tage} يوم. لا يُحتسب في أي مكان حتى الإرسال.` }
        : { de: 'Als Entwurf gespeichert – er zählt erst nach dem Einreichen.',
            ar: 'محفوظ كمسودة – لا يُحتسب إلا بعد الإرسال.' },
      ziel: b.projektId ? `/monteur/baustelle/${b.projektId}` : '/monteur',
      knopf: { de: 'Öffnen', ar: 'فتح' },
    })
  }

  // 3. Vergangene Einsätze, die nie auf erledigt gesetzt wurden
  const offenVergangen = meine.filter((a) => a.datum < heute && !a.erledigt)
  if (offenVergangen.length) {
    raus.push({
      id: 'nicht-erledigt',
      stufe: OFFEN,
      icon: 'clock',
      text: { de: `${offenVergangen.length} Einsatz/Einsätze nicht abgeschlossen`, ar: `${offenVergangen.length} مهمة غير منتهية` },
      detail: { de: 'Bitte nachtragen, sonst fehlen die Stunden.', ar: 'يرجى التسجيل لاحقًا، وإلا نقصت الساعات.' },
      ziel: '/monteur',
      knopf: { de: 'Ansehen', ar: 'عرض' },
    })
  }

  return raus.sort((a, b) => a.stufe - b.stufe)
}

// ---------------------------------------------------------------- je Baustelle

// Genau EIN Satz, was an dieser Baustelle als Nächstes dran ist.
// Für die Fortschrittsleiste im Projekt-Detail.
export function schrittProjekt({ projekt, lvpositionen = [], appointments = [], berichte = [], leistungen = [] }) {
  if (!projekt) return null
  const eigene = lvpositionen.filter((p) => p.projektId === projekt.id && p.typ === 'position')
  const termine = appointments.filter((a) => a.projektId === projekt.id)
  const eigeneBerichte = berichte.filter((b) => b.projektId === projekt.id)

  if (!eigene.length) {
    return {
      text: { de: 'Leistungsverzeichnis fehlt', ar: 'جدول الكميات مفقود' },
      hilfe: { de: 'Ohne LV gibt es keine Mengen, keine Aufgaben am Handy und nichts abzurechnen.',
               ar: 'بدون جدول الكميات لا توجد كميات ولا مهام على الهاتف ولا شيء للفوترة.' },
      ziel: `/projekte/${projekt.id}?bereich=lv`,
      knopf: { de: 'LV importieren', ar: 'استيراد الجدول' },
    }
  }
  if (!termine.length) {
    return {
      text: { de: 'Noch kein Einsatz geplant', ar: 'لم تُخطط أي مهمة بعد' },
      hilfe: { de: 'Im Kalender einen Tag anklicken, Baustelle wählen, Kolonne antippen.',
               ar: 'انقر يومًا في التقويم، اختر الورشة، وحدد الفريق.' },
      ziel: '/',
      knopf: { de: 'Einsatz planen', ar: 'تخطيط مهمة' },
    }
  }
  const eingereicht = eigeneBerichte.filter((b) => b.status === 'eingereicht')
  if (eingereicht.length) {
    return {
      text: { de: `${eingereicht.length} Bericht(e) warten auf Freigabe`, ar: `${eingereicht.length} تقرير بانتظار الاعتماد` },
      hilfe: { de: 'Erst nach der Freigabe zählen Stunden und Mengen.', ar: 'لا تُحتسب الساعات والكميات إلا بعد الاعتماد.' },
      ziel: '/berichte',
      knopf: { de: 'Freigeben', ar: 'اعتماد' },
    }
  }
  const offeneMenge = eigene.some((p) => (Number(p.istMenge) || 0) < (Number(p.menge) || 0))
  if (offeneMenge) {
    return {
      text: { de: 'Arbeiten laufen', ar: 'الأعمال جارية' },
      hilfe: { de: 'Die Monteure melden ihre Mengen am Handy. Nichts zu tun.',
               ar: 'يبلّغ الفنيون عن كمياتهم عبر الهاتف. لا يوجد ما يجب فعله.' },
      ziel: null,
      knopf: null,
    }
  }
  return {
    text: { de: 'Alle Mengen erbracht – abrechnen', ar: 'اكتملت جميع الكميات – الفوترة' },
    hilfe: { de: 'Die vertraglichen Mengen sind gemeldet.', ar: 'تم الإبلاغ عن الكميات التعاقدية.' },
    ziel: '/abrechnung',
    knopf: { de: 'Rechnung erstellen', ar: 'إنشاء فاتورة' },
  }
}
