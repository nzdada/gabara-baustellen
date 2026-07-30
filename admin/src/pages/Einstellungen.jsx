import { useEffect, useRef, useState } from 'react'
import { useCollection, withStore, speichereSetting } from '../hooks.js'
import { EINSTELLUNGEN_DEFAULTS } from '@shared/einstellungen.js'
import { storeModus } from '@shared/store.js'
import { kalenderKonfiguriert, kalenderVerbunden, kalenderVerbinden } from '@shared/googleCalendar.js'
import { mailKonfiguriert } from '@shared/mail.js'
import { heuteISO, addTage, normalisiereFenster } from '@shared/slots.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr, datumLok, WOCHENTAGE } from '@shared/i18n.js'

const T = {
  titel: { de: 'Einstellungen & System', en: 'Settings & system', ar: 'الإعدادات والنظام' },
  status: { de: 'Systemstatus', en: 'System status', ar: 'حالة النظام' },
  daten: { de: 'Datenhaltung:', en: 'Data storage:', ar: 'تخزين البيانات:' },
  datenFirebase: { de: 'Firebase Firestore (Frankfurt, EU) – online von überall', en: 'Firebase Firestore (Frankfurt, EU) – online from anywhere', ar: 'Firebase Firestore (فرانكفورت، الاتحاد الأوروبي) – متاح من أي مكان' },
  datenLokal: { de: 'Lokaler Demo-Modus (Daten nur in diesem Browser)', en: 'Local demo mode (data only in this browser)', ar: 'وضع تجريبي محلي (البيانات في هذا المتصفح فقط)' },
  google: { de: 'Google Kalender:', en: 'Google Calendar:', ar: 'تقويم جوجل:' },
  gVerbunden: { de: 'verbunden', en: 'connected', ar: 'متصل' },
  gKonf: { de: 'konfiguriert, nicht verbunden', en: 'configured, not connected', ar: 'مهيأ، غير متصل' },
  gDemo: { de: 'Demo-Modus (keine Client-ID hinterlegt)', en: 'demo mode (no client ID configured)', ar: 'وضع تجريبي (لا يوجد معرف عميل)' },
  verbinden: { de: 'Jetzt verbinden', en: 'Connect now', ar: 'اتصل الآن' },
  mail: { de: 'Patienten-Mails (Bestätigung/Absage):', en: 'Patient e-mails (confirmation/decline):', ar: 'رسائل المرضى (تأكيد/إلغاء):' },
  mailAktiv: { de: 'aktiv (Apps-Script-Mail-Dienst)', en: 'active (Apps Script mail service)', ar: 'مفعّل (خدمة بريد Apps Script)' },
  mailInaktiv: { de: 'nicht eingerichtet – seed/erinnerung.gs als Web-App bereitstellen und URL in shared/firebase-config.js (MAIL_DIENST.url) eintragen', en: 'not set up – deploy seed/erinnerung.gs as a web app and store the URL in shared/firebase-config.js (MAIL_DIENST.url)', ar: 'غير مفعّل – انشر seed/erinnerung.gs كتطبيق ويب وأدخل الرابط في الإعدادات' },
  lokalHinweis: {
    de: 'Für den Betrieb von überall (Tablet + Empfang gleichzeitig) wird Firebase aktiviert – Anleitung in der README (Konto: nasiradada.98@gmail.com). Die Oberfläche bleibt exakt gleich.',
    en: 'For operation from anywhere (tablet + front desk at the same time) Firebase is activated – see README (account: nasiradada.98@gmail.com). The interface stays exactly the same.',
    ar: 'للعمل من أي مكان (الجهاز اللوحي والاستقبال معًا) يتم تفعيل Firebase – الدليل في README (الحساب: nasiradada.98@gmail.com). تبقى الواجهة كما هي تمامًا.',
  },
  erinnerungTitel: { de: 'Termin-Erinnerungen (1 Tag vorher)', en: 'Appointment reminders (1 day before)', ar: 'تذكيرات المواعيد (قبل يوم واحد)' },
  erinnerungText: {
    de: 'Ein Google-Apps-Script sendet täglich um 17:00 Uhr automatisch E-Mail-Erinnerungen für alle morgigen Termine (Datei seed/erinnerung.gs). Patienten ohne E-Mail stehen hier zum Anrufen:',
    en: 'A Google Apps Script automatically sends e-mail reminders for all of tomorrow’s appointments daily at 17:00 (file seed/erinnerung.gs). Patients without e-mail are listed here to be called:',
    ar: 'يرسل سكربت Google Apps تلقائيًا رسائل تذكير يومية الساعة 17:00 لجميع مواعيد الغد (الملف seed/erinnerung.gs). المرضى بدون بريد إلكتروني مدرجون هنا للاتصال بهم:',
  },
  morgen: { de: 'Morgen', en: 'Tomorrow', ar: 'غدًا' },
  termine: { de: 'Termine', en: 'appointments', ar: 'مواعيد' },
  uhr: { de: 'Uhr', en: '', ar: '' },
  erinnert: { de: '✓ erinnert', en: '✓ reminded', ar: '✓ تم التذكير' },
  offen: { de: 'offen', en: 'pending', ar: 'قيد الانتظار' },
  demoSenden: { de: 'Demo: Erinnerungen jetzt als gesendet markieren', en: 'Demo: mark reminders as sent now', ar: 'تجريبي: وضع علامة "أُرسلت" على التذكيرات الآن' },
  demoTitel: { de: 'Demo-Daten', en: 'Demo data', ar: 'بيانات تجريبية' },
  demoText: {
    de: 'Setzt Patienten, Termine und Anfragen auf den Vorführ-Stand zurück (fiktive Daten, Termine relativ zu heute). Ideal direkt vor der Präsentation beim Zahnarzt.',
    en: 'Resets patients, appointments and requests to the demo state (fictional data, appointments relative to today). Ideal right before the presentation.',
    ar: 'يعيد المرضى والمواعيد والطلبات إلى حالة العرض (بيانات وهمية، مواعيد نسبةً إلى اليوم). مثالي قبل العرض مباشرة.',
  },
  demoFrage: { de: 'Alle Daten auf den Demo-Stand zurücksetzen?', en: 'Reset all data to the demo state?', ar: 'إعادة تعيين جميع البيانات إلى حالة العرض؟' },
  demoKnopf: { de: 'Demo-Daten zurücksetzen', en: 'Reset demo data', ar: 'إعادة تعيين البيانات التجريبية' },
  erledigt: { de: '✓ Erledigt!', en: '✓ Done!', ar: '✓ تم!' },
  // Globale Konfiguration
  globalTitel: { de: 'Globale Einstellungen', en: 'Global settings', ar: 'الإعدادات العامة' },
  globalHinweis: { de: 'Gespeichert in der Datenbank (settings/global) – gilt sofort für die ganze Verwaltung. Werte im Mail-Dienst (Apps Script) ggf. mit anpassen.', en: 'Stored in the database (settings/global) – applies immediately to the whole admin. Adjust the mail service (Apps Script) values accordingly if needed.', ar: 'محفوظة في قاعدة البيانات وتسري فورًا على الإدارة كلها.' },
  gLokal: { de: 'Lokalisierung & Standards', en: 'Localisation & standards', ar: 'اللغة والمعايير' },
  gSprache: { de: 'Standardsprache', en: 'Default language', ar: 'اللغة الافتراضية' },
  gWaehrung: { de: 'Währung', en: 'Currency', ar: 'العملة' },
  gDatum: { de: 'Datumsformat', en: 'Date format', ar: 'صيغة التاريخ' },
  gFristen: { de: 'Automatisierung & Fristen', en: 'Automation & deadlines', ar: 'الأتمتة والمهل' },
  gStorno: { de: 'Stornierungsfrist (Stunden)', en: 'Cancellation deadline (hours)', ar: 'مهلة الإلغاء (ساعات)' },
  gGebuehr: { de: 'Ausfallgebühr (€)', en: 'No-show fee (€)', ar: 'رسوم الإلغاء (€)' },
  gFeedback: { de: 'Feedback-Versand nach (Stunden)', en: 'Feedback e-mail after (hours)', ar: 'إرسال الملاحظات بعد (ساعات)' },
  gKatalog: { de: 'Kataloge & Praxisdaten', en: 'Catalogues & practice data', ar: 'الكتالوجات وبيانات العيادة' },
  gModus: { de: 'Abrechnungskatalog', en: 'Billing catalogue', ar: 'كتالوج الفوترة' },
  gName: { de: 'Praxisname', en: 'Practice name', ar: 'اسم العيادة' },
  gAnschrift: { de: 'Anschrift', en: 'Address', ar: 'العنوان' },
  gTelefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
  gEmail: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
  gBank: { de: 'Bank', en: 'Bank', ar: 'البنك' },
  gIban: { de: 'IBAN (für Rechnungs-PDF)', en: 'IBAN (for invoice PDF)', ar: 'IBAN (لفاتورة PDF)' },
  gSpeichern: { de: 'Einstellungen speichern', en: 'Save settings', ar: 'حفظ الإعدادات' },
  gGespeichert: { de: '✓ Gespeichert', en: '✓ Saved', ar: '✓ تم الحفظ' },
  // Wochenplan Pausen & Abwesenheiten
  wpTitel: { de: 'Wochenplan: Pausen & Abwesenheiten', en: 'Weekly plan: breaks & absences', ar: 'الخطة الأسبوعية: الاستراحات والغياب' },
  wpHinweis: {
    de: 'Diese Zeiten wiederholen sich jede Woche und sind für Patienten online NICHT buchbar (Mittagspause, Besprechung, Fortbildung …). Sie gelten sofort für die Online-Buchung und die interne Terminvergabe.',
    en: 'These times repeat every week and are NOT bookable online for patients (lunch break, meeting, training …). They apply immediately to online booking and internal scheduling.',
    ar: 'تتكرر هذه الأوقات أسبوعيًا ولا يمكن للمرضى حجزها عبر الإنترنت. تسري فورًا على الحجز الإلكتروني والمواعيد الداخلية.',
  },
  wpTag: { de: 'Wochentag', en: 'Weekday', ar: 'اليوم' },
  von: { de: 'Von', en: 'From', ar: 'من' },
  bis: { de: 'Bis', en: 'Until', ar: 'إلى' },
  wpGrund: { de: 'Grund', en: 'Reason', ar: 'السبب' },
  wpGrundPlatzhalter: { de: 'z. B. Mittagspause', en: 'e.g. lunch break', ar: 'مثال: استراحة الغداء' },
  wpHinzu: { de: '+ Pause eintragen', en: '+ Add break', ar: '+ إضافة استراحة' },
  wpKeine: { de: 'Keine wiederkehrenden Pausen eingetragen.', en: 'No recurring breaks entered.', ar: 'لا استراحات متكررة.' },
  // Öffnungszeiten
  ozTitel: { de: 'Öffnungszeiten', en: 'Opening hours', ar: 'ساعات العمل' },
  ozHinweis: {
    de: 'Diese Zeitfenster bestimmen, wann Patienten online buchen können – sie gelten sofort für die Webseite und die interne Terminvergabe. Ein Tag ohne Zeitfenster ist online nicht buchbar (z. B. „nur telefonisch erreichbar").',
    en: 'These time windows define when patients can book online – they apply immediately to the website and internal scheduling. A day without windows cannot be booked online (e.g. "reachable by phone only").',
    ar: 'تحدد هذه الفترات متى يمكن للمرضى الحجز عبر الإنترنت – وتسري فورًا على الموقع والمواعيد الداخلية. اليوم بدون فترات لا يمكن حجزه عبر الإنترنت.',
  },
  ozGeschlossen: { de: 'online nicht buchbar', en: 'not bookable online', ar: 'غير متاح للحجز' },
  ozHinzu: { de: '+ Zeitfenster hinzufügen', en: '+ Add time window', ar: '+ إضافة فترة' },
  ozSonntag: { de: 'Sonntag ist immer geschlossen.', en: 'Sunday is always closed.', ar: 'الأحد مغلق دائمًا.' },
  ozTelefon: { de: '☎ telefonisch erreichbar', en: '☎ reachable by phone', ar: '☎ متاحون هاتفيًا' },
  // Urlaub & Betriebsferien
  ozUrlaubTitel: { de: 'Urlaub & Betriebsferien', en: 'Holidays & practice closure', ar: 'الإجازات والعطل' },
  ozUrlaubHinweis: {
    de: 'In diesen Zeiträumen können Patienten online KEINE Termine buchen – die Buchungsseite zeigt einen Urlaubs-Hinweis. Gilt auch für die interne Terminvergabe (Patiententermine).',
    en: 'During these periods patients CANNOT book online – the booking page shows a holiday notice. Also applies to internal patient scheduling.',
    ar: 'خلال هذه الفترات لا يمكن للمرضى الحجز عبر الإنترنت – وتعرض صفحة الحجز إشعار الإجازة.',
  },
  ozUrlaubHinzu: { de: '+ Urlaub eintragen', en: '+ Add holiday', ar: '+ إضافة إجازة' },
  ozUrlaubKeiner: { de: 'Kein Urlaub eingetragen.', en: 'No holiday entered.', ar: 'لا إجازات مسجلة.' },
}

// Halbe Stunden 07:00–20:00 für die Pausen-Auswahl
const WP_ZEITEN = []
for (let m = 7 * 60; m <= 20 * 60; m += 30) {
  WP_ZEITEN.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}

export default function Einstellungen() {
  useLang()
  const appointments = useCollection('appointments')
  // EIN Live-Abo auf settings für alle Karten (statt drei parallelen Listenern)
  const settingsRows = useCollection('settings')
  const [zurueckgesetzt, setZurueckgesetzt] = useState(false)
  const [gVerbunden, setGVerbunden] = useState(kalenderVerbunden())
  const modus = storeModus()

  const morgen = addTage(heuteISO(), 1)
  const morgige = appointments.filter((a) => a.datum === morgen && a.status === 'bestaetigt')

  async function demoReset() {
    if (!confirm(tr(T.demoFrage))) return
    await withStore((s) => s.resetDemo())
    setZurueckgesetzt(true)
    setTimeout(() => setZurueckgesetzt(false), 4000)
  }

  async function erinnerungenMarkieren() {
    await withStore(async (s) => {
      for (const a of morgige) {
        await s.update('appointments', a.id, { erinnerung: 'gesendet' })
      }
    })
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>

      {/* Systemstatus */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 text-sm mb-3">{tr(T.status)}</h2>
        <div className="space-y-2.5 text-sm">
          <p className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${modus === 'firebase' ? 'bg-praxis-500' : 'bg-amber-400'}`} />
            {tr(T.daten)} <strong>{modus === 'firebase' ? tr(T.datenFirebase) : tr(T.datenLokal)}</strong>
          </p>
          <p className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${mailKonfiguriert() ? 'bg-praxis-500' : 'bg-amber-400'}`} />
            {tr(T.mail)} <strong>{mailKonfiguriert() ? tr(T.mailAktiv) : tr(T.mailInaktiv)}</strong>
          </p>
          <p className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${gVerbunden ? 'bg-praxis-500' : 'bg-slate-300'}`} />
            {tr(T.google)} <strong>
              {gVerbunden ? tr(T.gVerbunden) : kalenderKonfiguriert() ? tr(T.gKonf) : tr(T.gDemo)}
            </strong>
            {kalenderKonfiguriert() && !gVerbunden && (
              <button
                onClick={async () => { await kalenderVerbinden(); setGVerbunden(true) }}
                className="mx-2 text-praxis-700 font-semibold hover:underline"
              >
                {tr(T.verbinden)}
              </button>
            )}
          </p>
        </div>
        {modus === 'lokal' && (
          <p className="mt-3 text-xs text-slate-400 leading-relaxed">{tr(T.lokalHinweis)}</p>
        )}
      </div>

      {/* Termin-Erinnerungen */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
          <Icon name="bell" className="w-4 h-4 text-praxis-600" /> {tr(T.erinnerungTitel)}
        </h2>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">{tr(T.erinnerungText)}</p>
        <p className="text-sm font-semibold text-slate-700 mb-2">{tr(T.morgen)} ({datumLok(morgen)}): {morgige.length} {tr(T.termine)}</p>
        {morgige.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {morgige.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-4 py-2.5">
                <span>{a.start} {tr(T.uhr)} · {a.patientName} · {a.behandlung}</span>
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                  a.erinnerung === 'gesendet' ? 'bg-praxis-100 text-praxis-800' : 'bg-amber-100 text-amber-700'
                }`}>
                  {a.erinnerung === 'gesendet' ? tr(T.erinnert) : tr(T.offen)}
                </span>
              </div>
            ))}
          </div>
        )}
        {morgige.some((a) => a.erinnerung !== 'gesendet') && (
          <button
            onClick={erinnerungenMarkieren}
            className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full"
          >
            {tr(T.demoSenden)}
          </button>
        )}
      </div>

      {/* Öffnungszeiten: bestimmen die online buchbaren Zeitfenster */}
      <Oeffnungszeiten settingsRows={settingsRows} />

      {/* Wochenplan: wiederkehrende Pausen & Abwesenheiten (blocken die Buchung) */}
      <Wochenplan settingsRows={settingsRows} />

      {/* Globale Konfiguration (Modul 10) */}
      <GlobaleEinstellungen settingsRows={settingsRows} />

      {/* Demo-Daten */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 text-sm mb-1">{tr(T.demoTitel)}</h2>
        <p className="text-xs text-slate-500 mb-4">{tr(T.demoText)}</p>
        <button
          onClick={demoReset}
          className="bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2.5 rounded-full"
        >
          {tr(T.demoKnopf)}
        </button>
        {zurueckgesetzt && <span className="mx-3 text-sm text-praxis-700 font-semibold">{tr(T.erledigt)}</span>}
      </div>
    </div>
  )
}

// Öffnungszeiten je Wochentag (settings/oeffnungszeiten, öffentlich lesbar – nur Uhrzeiten).
// Quelle für Online-Buchung, interne Terminvergabe und Kalender-Kopfzeile.
// Überlappende Fenster eines Tages zu einem zusammenfassen (verhindert doppelte Slots)
function fensterZusammenfassen(liste) {
  const sortiert = [...liste].sort((a, b) => a.von.localeCompare(b.von))
  const out = []
  for (const f of sortiert) {
    const letztes = out[out.length - 1]
    if (letztes && f.von <= letztes.bis) {
      if (f.bis > letztes.bis) letztes.bis = f.bis
    } else out.push({ ...f })
  }
  return out
}

function Oeffnungszeiten({ settingsRows }) {
  const doc = settingsRows.find((r) => r.id === 'oeffnungszeiten')
  // Optimistischer Zwischenstand: schnelle Klicks rechnen auf dem zuletzt
  // geschriebenen Stand weiter, statt auf dem alten Render (Race beim Doppel-Löschen)
  const entwurfRef = useRef(null)
  const angelegtRef = useRef(!!doc)
  useEffect(() => { entwurfRef.current = null }, [doc])

  const stand = entwurfRef.current || {
    fenster: normalisiereFenster(doc?.fenster || null),
    telefon: doc?.telefon || [5],
    urlaub: doc?.urlaub || [],
  }

  const [tag, setTag] = useState(1)
  const [von, setVon] = useState('08:00')
  const [bis, setBis] = useState('12:00')
  const [uVon, setUVon] = useState('')
  const [uBis, setUBis] = useState('')
  const [, neuZeichnen] = useState(0)

  function speichern(neuerStand) {
    entwurfRef.current = neuerStand
    neuZeichnen((x) => x + 1)
    const vorhanden = !!doc || angelegtRef.current
    angelegtRef.current = true
    speichereSetting('oeffnungszeiten', neuerStand, vorhanden)
  }

  function hinzufuegen() {
    if (bis <= von) return
    const fenster = { ...stand.fenster, [tag]: fensterZusammenfassen([...stand.fenster[tag], { von, bis }]) }
    speichern({ ...stand, fenster })
  }

  function entfernen(t, index) {
    const fenster = { ...stand.fenster, [t]: stand.fenster[t].filter((_, i) => i !== index) }
    speichern({ ...stand, fenster })
  }

  function telefonWechseln(t) {
    const telefon = stand.telefon.includes(t)
      ? stand.telefon.filter((x) => x !== t)
      : [...stand.telefon, t].sort((a, b) => a - b)
    speichern({ ...stand, telefon })
  }

  function urlaubHinzufuegen() {
    if (!uVon || !uBis || uBis < uVon) return
    const urlaub = [...stand.urlaub, { von: uVon, bis: uBis }].sort((a, b) => a.von.localeCompare(b.von))
    speichern({ ...stand, urlaub })
    setUVon('')
    setUBis('')
  }

  function urlaubEntfernen(index) {
    speichern({ ...stand, urlaub: stand.urlaub.filter((_, i) => i !== index) })
  }

  const selectKlasse = 'rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="font-bold text-slate-800 text-sm mb-1">🕐 {tr(T.ozTitel)}</h2>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{tr(T.ozHinweis)}</p>

      {/* Wochenübersicht Mo–Sa */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
        {[1, 2, 3, 4, 5, 6].map((t) => (
          <div key={t} className="border border-slate-100 rounded-xl p-2.5 min-h-[76px]">
            <p className="text-[11px] font-bold text-slate-500 mb-1.5">{tr(WOCHENTAGE[t])}</p>
            {stand.fenster[t].length === 0 ? (
              <>
                <p className="text-[10px] text-slate-400 italic">{tr(T.ozGeschlossen)}</p>
                {/* Geschlossene Tage können trotzdem telefonisch erreichbar sein */}
                <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stand.telefon.includes(t)}
                    onChange={() => telefonWechseln(t)}
                    className="accent-praxis-600"
                  />
                  {tr(T.ozTelefon)}
                </label>
              </>
            ) : (
              stand.fenster[t].map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-praxis-50 border border-praxis-200 rounded-lg px-2 py-1 mb-1">
                  <span className="flex-1 min-w-0 block text-[10px] font-bold text-praxis-800" dir="ltr">{f.von}–{f.bis}</span>
                  <button
                    onClick={() => entfernen(t, i)}
                    className="shrink-0 text-praxis-400 hover:text-red-600 text-xs font-bold"
                    title="Löschen"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* Neues Zeitfenster */}
      <div className="flex flex-wrap items-end gap-2.5 bg-slate-50 rounded-xl p-3.5">
        <label className="block text-xs font-medium text-slate-600">{tr(T.wpTag)}
          <select value={tag} onChange={(e) => setTag(Number(e.target.value))} className={`mt-1 block ${selectKlasse}`}>
            {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>{tr(WOCHENTAGE[t])}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">{tr(T.von)}
          <select value={von} onChange={(e) => { setVon(e.target.value); if (bis <= e.target.value) setBis(WP_ZEITEN[WP_ZEITEN.indexOf(e.target.value) + 2] || '20:00') }} className={`mt-1 block ${selectKlasse}`} dir="ltr">
            {WP_ZEITEN.slice(0, -1).map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">{tr(T.bis)}
          <select value={bis} onChange={(e) => setBis(e.target.value)} className={`mt-1 block ${selectKlasse}`} dir="ltr">
            {WP_ZEITEN.filter((z) => z > von).map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <button onClick={hinzufuegen} className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
          {tr(T.ozHinzu)}
        </button>
      </div>
      <p className="mt-2.5 text-[11px] text-slate-400">{tr(T.ozSonntag)}</p>

      {/* Urlaub & Betriebsferien: sperren die Online-Buchung komplett */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-bold text-slate-800 mb-1">🏖 {tr(T.ozUrlaubTitel)}</p>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{tr(T.ozUrlaubHinweis)}</p>
        {stand.urlaub.length === 0 ? (
          <p className="text-xs text-slate-400 mb-3">{tr(T.ozUrlaubKeiner)}</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {stand.urlaub.map((u, i) => (
              <span key={i} className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-sky-800">
                🏖 {datumLok(u.von, { day: '2-digit', month: '2-digit', year: 'numeric' })} – {datumLok(u.bis, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                <button onClick={() => urlaubEntfernen(i)} className="text-sky-400 hover:text-red-600 font-bold" title="Löschen">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2.5 bg-slate-50 rounded-xl p-3.5">
          <label className="block text-xs font-medium text-slate-600">{tr(T.von)}
            <input type="date" value={uVon} onChange={(e) => { setUVon(e.target.value); if (uBis && uBis < e.target.value) setUBis(e.target.value) }}
              className={`mt-1 block ${selectKlasse}`} dir="ltr" />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.bis)}
            <input type="date" value={uBis} min={uVon || undefined} onChange={(e) => setUBis(e.target.value)}
              className={`mt-1 block ${selectKlasse}`} dir="ltr" />
          </label>
          <button onClick={urlaubHinzufuegen} disabled={!uVon || !uBis}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
            {tr(T.ozUrlaubHinzu)}
          </button>
        </div>
      </div>
    </div>
  )
}

// Wochenplan: wiederkehrende Pausen/Abwesenheiten (settings/pausen, öffentlich lesbar,
// enthält NUR Wochentag + Uhrzeiten + Grund). Blockt Online-Buchung + Terminvergabe.
function Wochenplan({ settingsRows }) {
  const doc = settingsRows.find((r) => r.id === 'pausen')
  // Gleiches optimistisches Muster wie bei den Öffnungszeiten (schnelle Doppel-Klicks)
  const entwurfRef = useRef(null)
  const angelegtRef = useRef(!!doc)
  useEffect(() => { entwurfRef.current = null }, [doc])
  const eintraege = entwurfRef.current || doc?.eintraege || []

  const [tag, setTag] = useState(1)
  const [von, setVon] = useState('12:00')
  const [bis, setBis] = useState('13:00')
  const [grund, setGrund] = useState('')
  const [, neuZeichnen] = useState(0)

  function speichern(neueEintraege) {
    entwurfRef.current = neueEintraege
    neuZeichnen((x) => x + 1)
    const vorhanden = !!doc || angelegtRef.current
    angelegtRef.current = true
    speichereSetting('pausen', { eintraege: neueEintraege }, vorhanden)
  }

  function hinzufuegen() {
    if (bis <= von) return
    const neu = [...eintraege, { tag: Number(tag), von, bis, grund: grund.trim() || 'Pause' }]
    neu.sort((a, b) => a.tag - b.tag || a.von.localeCompare(b.von))
    speichern(neu)
    setGrund('')
  }

  const selectKlasse = 'rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="font-bold text-slate-800 text-sm mb-1">🗓 {tr(T.wpTitel)}</h2>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{tr(T.wpHinweis)}</p>

      {/* Wochenübersicht Mo–Sa */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
        {[1, 2, 3, 4, 5, 6].map((t) => {
          const tages = eintraege.filter((e) => e.tag === t)
          return (
            <div key={t} className="border border-slate-100 rounded-xl p-2.5 min-h-[76px]">
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">{tr(WOCHENTAGE[t])}</p>
              {tages.length === 0 ? (
                <p className="text-[10px] text-slate-300">–</p>
              ) : (
                tages.map((e, i) => (
                  <div key={i} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-1">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[10px] font-bold text-amber-800" dir="ltr">{e.von}–{e.bis}</span>
                      <span className="block text-[10px] text-amber-700 truncate">{e.grund}</span>
                    </span>
                    <button
                      onClick={() => speichern(eintraege.filter((x) => x !== e))}
                      className="shrink-0 text-amber-400 hover:text-red-600 text-xs font-bold"
                      title="Löschen"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
      {eintraege.length === 0 && <p className="text-xs text-slate-400 mb-3">{tr(T.wpKeine)}</p>}

      {/* Neue Pause eintragen */}
      <div className="flex flex-wrap items-end gap-2.5 bg-slate-50 rounded-xl p-3.5">
        <label className="block text-xs font-medium text-slate-600">{tr(T.wpTag)}
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={`mt-1 block ${selectKlasse}`}>
            {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>{tr(WOCHENTAGE[t])}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">{tr(T.von) || 'Von'}
          <select value={von} onChange={(e) => { setVon(e.target.value); if (bis <= e.target.value) setBis(WP_ZEITEN[WP_ZEITEN.indexOf(e.target.value) + 2] || '20:00') }} className={`mt-1 block ${selectKlasse}`} dir="ltr">
            {WP_ZEITEN.slice(0, -1).map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">{tr(T.bis) || 'Bis'}
          <select value={bis} onChange={(e) => setBis(e.target.value)} className={`mt-1 block ${selectKlasse}`} dir="ltr">
            {WP_ZEITEN.filter((z) => z > von).map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600 flex-1 min-w-40">{tr(T.wpGrund)}
          <input value={grund} onChange={(e) => setGrund(e.target.value)} placeholder={tr(T.wpGrundPlatzhalter)}
            className={`mt-1 block w-full ${selectKlasse}`} />
        </label>
        <button onClick={hinzufuegen} className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
          {tr(T.wpHinzu)}
        </button>
      </div>
    </div>
  )
}

// Zentrale Konfiguration – nichts hardcodiert, alles in settings/global
function GlobaleEinstellungen({ settingsRows }) {
  const globalRow = settingsRows.find((r) => r.id === 'global')
  const gespeicherte = { ...EINSTELLUNGEN_DEFAULTS, ...(globalRow || {}) }
  const [form, setForm] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (form === null) setForm(gespeicherte)
  }, [gespeicherte, form])

  if (!form) return null

  const feld = (key) => ({
    value: form[key] ?? '',
    onChange: (e) => setForm({ ...form, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }),
    className: 'mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500',
  })

  async function speichern() {
    await speichereSetting('global', { ...EINSTELLUNGEN_DEFAULTS, ...form }, !!globalRow)
    setOk(true)
    setTimeout(() => setOk(false), 3000)
  }

  const gruppe = (titel, inhalt) => (
    <div className="mt-5 first:mt-0">
      <p className="text-xs font-bold text-praxis-700 uppercase tracking-wide mb-2">{titel}</p>
      <div className="grid sm:grid-cols-3 gap-3">{inhalt}</div>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="font-bold text-slate-800 text-sm mb-1">⚙ {tr(T.globalTitel)}</h2>
      <p className="text-xs text-slate-500 mb-4">{tr(T.globalHinweis)}</p>

      {gruppe(tr(T.gLokal), (
        <>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gSprache)}
            <select {...feld('standardSprache')} className={feld('standardSprache').className + ' bg-white'}>
              <option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gWaehrung)}
            <select {...feld('waehrung')} className={feld('waehrung').className + ' bg-white'}>
              <option value="EUR">EUR €</option><option value="CHF">CHF</option><option value="USD">USD $</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gDatum)}
            <select {...feld('datumsformat')} className={feld('datumsformat').className + ' bg-white'}>
              <option value="TT.MM.JJJJ">TT.MM.JJJJ</option><option value="JJJJ-MM-TT">JJJJ-MM-TT</option><option value="MM/TT/JJJJ">MM/TT/JJJJ</option>
            </select>
          </label>
        </>
      ))}

      {gruppe(tr(T.gFristen), (
        <>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gStorno)}
            <input type="number" min="1" {...feld('stornoFristStunden')} dir="ltr" />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gGebuehr)}
            <input type="number" min="0" {...feld('ausfallGebuehr')} dir="ltr" />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gFeedback)}
            <input type="number" min="0" {...feld('feedbackVerzoegerungStunden')} dir="ltr" />
          </label>
        </>
      ))}

      {gruppe(tr(T.gKatalog), (
        <>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gModus)}
            <select {...feld('katalogModus')} className={feld('katalogModus').className + ' bg-white'}>
              <option value="GOZ">GOZ (privat)</option><option value="BEMA">BEMA (gesetzlich)</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">{tr(T.gName)}
            <input type="text" {...feld('praxisName')} />
          </label>
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">{tr(T.gAnschrift)}
            <input type="text" {...feld('praxisAnschrift')} />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gTelefon)}
            <input type="text" {...feld('praxisTelefon')} dir="ltr" />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gEmail)}
            <input type="email" {...feld('praxisEmail')} dir="ltr" />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gBank)}
            <input type="text" {...feld('bankName')} />
          </label>
          <label className="block text-xs font-medium text-slate-600">{tr(T.gIban)}
            <input type="text" {...feld('iban')} dir="ltr" />
          </label>
        </>
      ))}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={speichern} className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-bold px-5 py-2.5 rounded-full">
          {tr(T.gSpeichern)}
        </button>
        {ok && <span className="text-sm font-semibold text-praxis-700">{tr(T.gGespeichert)}</span>}
      </div>
    </div>
  )
}
