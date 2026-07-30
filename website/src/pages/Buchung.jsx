import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRAXIS, ANLIEGEN } from '@shared/praxis.js'
import { freieSlots, buchbareTage, endeZeit, wochentag, heuteISO, imUrlaub } from '@shared/slots.js'
import { getStore } from '@shared/store.js'
import { ZahnLogo, Icon, SprachSchalter } from '@shared/ui.jsx'
import { useLang, tr, datumLok, getLang } from '@shared/i18n.js'

const T = {
  schritte: [
    { de: 'Anliegen', en: 'Concern', ar: 'الطلب' },
    { de: 'Termin', en: 'Date & time', ar: 'الموعد' },
    { de: 'Ihre Daten', en: 'Your details', ar: 'بياناتك' },
  ],
  titel: { de: 'Termin online buchen', en: 'Book your appointment online', ar: 'احجز موعدك عبر الإنترنت' },
  untertitel: { de: 'Dauert weniger als eine Minute.', en: 'Takes less than a minute.', ar: 'يستغرق أقل من دقيقة.' },
  abbrechen: { de: 'Abbrechen', en: 'Cancel', ar: 'إلغاء' },
  minuten: { de: 'Minuten', en: 'minutes', ar: 'دقيقة' },
  ca: { de: 'ca.', en: 'approx.', ar: 'حوالي' },
  aendern: { de: 'Ändern', en: 'Change', ar: 'تغيير' },
  eigenTitel: { de: 'Beschreiben Sie kurz Ihr Anliegen', en: 'Briefly describe your concern', ar: 'صف طلبك باختصار' },
  eigenPlatzhalter: { de: 'z. B. Krone abgefallen, Zahnstein, zweite Meinung …', en: 'e.g. crown fell off, tartar, second opinion …', ar: 'مثال: سقط التاج، جير الأسنان، رأي ثانٍ …' },
  eigenWeiter: { de: 'Weiter zur Terminauswahl', en: 'Continue to time selection', ar: 'متابعة لاختيار الموعد' },
  freieZeiten: { de: 'freie Zeiten', en: 'free slots', ar: 'مواعيد متاحة' },
  freieZeit: { de: 'freie Zeit', en: 'free slot', ar: 'موعد متاح' },
  slotsHinweis: { de: 'Alle angezeigten Zeiten sind aktuell frei. Ihr Termin gilt nach unserer Bestätigung.', en: 'All shown times are currently available. Your appointment is final after our confirmation.', ar: 'جميع الأوقات المعروضة متاحة حاليًا. يصبح موعدك نهائيًا بعد تأكيدنا.' },
  nameLabel: { de: 'Ihr Name *', en: 'Your name *', ar: 'اسمك *' },
  namePlatzhalter: { de: 'Vor- und Nachname', en: 'First and last name', ar: 'الاسم الأول واسم العائلة' },
  telefonLabel: { de: 'Telefonnummer *', en: 'Phone number *', ar: 'رقم الهاتف *' },
  telefonPlatzhalter: { de: 'Für die Terminbestätigung', en: 'For appointment confirmation', ar: 'لتأكيد الموعد' },
  emailLabel: { de: 'E-Mail *', en: 'E-mail *', ar: 'البريد الإلكتروني *' },
  emailPlatzhalter: { de: 'Für Bestätigung & Terminerinnerung', en: 'For confirmation & reminder', ar: 'للتأكيد والتذكير بالموعد' },
  nachrichtLabel: { de: 'Nachricht an uns (optional)', en: 'Message to us (optional)', ar: 'رسالة لنا (اختياري)' },
  nachrichtPlatzhalter: { de: 'z. B. Neupatient, Wunsch-Behandler …', en: 'e.g. new patient, preferred dentist …', ar: 'مثال: مريض جديد، الطبيب المفضل …' },
  absenden: { de: 'Termin verbindlich anfragen', en: 'Request appointment', ar: 'إرسال طلب الموعد' },
  sendet: { de: 'Wird gesendet …', en: 'Sending …', ar: 'جارٍ الإرسال …' },
  datenschutz: { de: 'Wir verwenden Ihre Daten ausschließlich zur Terminvergabe.', en: 'We use your data exclusively for appointment scheduling.', ar: 'نستخدم بياناتك حصريًا لتنظيم المواعيد.' },
  fertigTitel: { de: 'Ihre Terminanfrage ist eingegangen!', en: 'Your appointment request has been received!', ar: 'تم استلام طلب موعدك!' },
  fAnliegen: { de: 'Anliegen:', en: 'Concern:', ar: 'الطلب:' },
  fWunsch: { de: 'Wunschtermin:', en: 'Requested time:', ar: 'الموعد المطلوب:' },
  fName: { de: 'Name:', en: 'Name:', ar: 'الاسم:' },
  uhr: { de: 'Uhr', en: '', ar: '' },
  fertigText: {
    de: 'Unser Team prüft Ihre Anfrage während der Öffnungszeiten und bestätigt den Termin per E-Mail oder telefonisch. Einen Tag vor dem Termin erhalten Sie automatisch eine Erinnerung an',
    en: 'Our team reviews your request during opening hours and confirms the appointment by e-mail or phone. One day before your appointment you will automatically receive a reminder at',
    ar: 'يراجع فريقنا طلبك خلال ساعات العمل ويؤكد الموعد عبر البريد الإلكتروني أو الهاتف. قبل الموعد بيوم ستصلك رسالة تذكير تلقائيًا على',
  },
  zurStartseite: { de: 'Zur Startseite', en: 'Back to home', ar: 'إلى الصفحة الرئيسية' },
  schmerzTitel: { de: 'Bei Schmerzen sind wir sofort für Sie da', en: 'In case of pain, we are here for you right away', ar: 'عند الألم نحن هنا من أجلك فورًا' },
  schmerzText: {
    de: 'Schmerztermine vergeben wir telefonisch, damit wir Ihnen noch heute helfen können. Bitte rufen Sie uns direkt an – wir nehmen uns Zeit für Sie.',
    en: 'We arrange pain appointments by phone so we can help you today. Please call us directly – we will take time for you.',
    ar: 'ننظم مواعيد الألم هاتفيًا حتى نتمكن من مساعدتك اليوم. يرجى الاتصال بنا مباشرة – سنأخذ وقتًا كافيًا لك.',
  },
  schmerzZeiten: { de: 'Am besten direkt zu unseren Öffnungszeiten anrufen.', en: 'Best to call during our opening hours.', ar: 'يفضل الاتصال خلال ساعات العمل.' },
  schmerzZurueck: { de: '← Anderes Anliegen wählen', en: '← Choose another concern', ar: '← اختر طلبًا آخر' },
  fehlerName: { de: 'Bitte geben Sie Ihren vollständigen Namen ein.', en: 'Please enter your full name.', ar: 'يرجى إدخال اسمك الكامل.' },
  fehlerTelefon: { de: 'Bitte geben Sie Ihre Telefonnummer ein.', en: 'Please enter your phone number.', ar: 'يرجى إدخال رقم هاتفك.' },
  fehlerEmail: { de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein – Sie erhalten darüber Bestätigung und Terminerinnerung.', en: 'Please enter a valid e-mail address – you will receive the confirmation and reminder there.', ar: 'يرجى إدخال بريد إلكتروني صحيح – ستصلك عليه رسالة التأكيد والتذكير.' },
  fehlerSenden: { de: 'Das hat leider nicht geklappt. Bitte rufen Sie uns an:', en: 'Unfortunately that did not work. Please call us:', ar: 'للأسف لم ينجح ذلك. يرجى الاتصال بنا:' },
  laedtZeiten: { de: 'Freie Termine werden geladen …', en: 'Loading available times …', ar: 'جارٍ تحميل المواعيد المتاحة …' },
  keineZeiten: {
    de: 'Aktuell ist keine Online-Buchung möglich. Bitte rufen Sie uns an – wir finden einen Termin für Sie.',
    en: 'Online booking is currently not available. Please call us – we will find an appointment for you.',
    ar: 'الحجز عبر الإنترنت غير متاح حاليًا. يرجى الاتصال بنا وسنجد لك موعدًا.',
  },
  slotWeg: {
    de: 'Der gewählte Termin ist leider gerade vergeben worden – bitte wählen Sie eine andere Zeit.',
    en: 'The selected time was just taken – please choose another one.',
    ar: 'تم حجز الوقت المختار للتو – يرجى اختيار وقت آخر.',
  },
  urlaubHinweis: {
    de: '🏖 Urlaub: Vom {von} bis {bis} ist unsere Praxis geschlossen – in dieser Zeit sind keine Online-Buchungen möglich.',
    en: '🏖 Holiday: our practice is closed from {von} to {bis} – no online bookings are possible during this time.',
    ar: '🏖 إجازة: عيادتنا مغلقة من {von} إلى {bis} – لا يمكن الحجز عبر الإنترنت خلال هذه الفترة.',
  },
}

function Fortschritt({ schritt }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {T.schritte.map((name, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-2 ${i <= schritt ? 'text-praxis-700' : 'text-slate-300'}`}>
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                i < schritt
                  ? 'bg-praxis-600 border-praxis-600 text-white'
                  : i === schritt
                    ? 'border-praxis-600 text-praxis-700'
                    : 'border-slate-200'
              }`}
            >
              {i < schritt ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-sm font-medium hidden sm:block ${i === schritt ? '' : 'opacity-70'}`}>{tr(name)}</span>
          </div>
          {i < T.schritte.length - 1 && <div className={`w-6 sm:w-10 h-0.5 ${i < schritt ? 'bg-praxis-500' : 'bg-slate-200'}`} />}
        </div>
      ))}
    </div>
  )
}

function SchmerzHinweis({ zurueck }) {
  return (
    <div className="max-w-lg mx-auto text-center bg-amber-50 border border-amber-200 rounded-3xl p-8">
      <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
        <Icon name="alert" className="w-7 h-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-900">{tr(T.schmerzTitel)}</h2>
      <p className="mt-2 text-slate-600 text-sm leading-relaxed">{tr(T.schmerzText)}</p>
      <a
        href={PRAXIS.telefonLink}
        className="mt-6 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg shadow-amber-500/25"
      >
        <Icon name="phone" className="w-6 h-6" /> <span dir="ltr">{PRAXIS.telefon}</span>
      </a>
      <p className="mt-4 text-xs text-slate-500">{tr(T.schmerzZeiten)}</p>
      <button onClick={zurueck} className="mt-6 text-sm text-praxis-700 font-medium hover:underline">
        {tr(T.schmerzZurueck)}
      </button>
    </div>
  )
}

export default function Buchung() {
  useLang()
  const [schritt, setSchritt] = useState(0)
  const [anliegen, setAnliegen] = useState(null)
  const [eigenText, setEigenText] = useState('')
  const [datum, setDatum] = useState(null)
  const [zeit, setZeit] = useState(null)
  const [busy, setBusy] = useState([])
  const [form, setForm] = useState({ name: '', telefon: '', email: '', nachricht: '' })
  const [fertig, setFertig] = useState(false)
  const [sende, setSende] = useState(false)
  const [fehler, setFehler] = useState('')
  const [slotHinweis, setSlotHinweis] = useState(false) // gewählte Zeit wurde zwischenzeitlich vergeben

  // Anzeige in der gewählten Sprache …
  const anliegenAnzeige = anliegen?.freitext ? (eigenText.trim() || tr(anliegen.titel)) : tr(anliegen?.titel)
  // … gespeichert wird kanonisch Deutsch (das Team arbeitet auf Deutsch)
  const anliegenKanonisch = anliegen?.freitext ? (eigenText.trim() || anliegen.titel.de) : anliegen?.titel.de

  const [pausen, setPausen] = useState([])
  const [zeiten, setZeiten] = useState(null) // konfigurierte Öffnungszeiten (settings)
  const [urlaub, setUrlaub] = useState([]) // Betriebsferien: [{von,bis}] – blocken die Buchung
  const [ozGeladen, setOzGeladen] = useState(false) // erst danach Tage anzeigen (kein statischer Vorab-Fallback)

  useEffect(() => {
    let unsub = () => {}
    let unsub2 = () => {}
    let unsub3 = () => {}
    let aktiv = true
    getStore().then((store) => {
      // Unmount vor dem Store-Init: nichts mehr abonnieren (sonst leckt der Listener)
      if (!aktiv) return
      unsub = store.subscribeSlots(setBusy)
      unsub2 = store.subscribePausen(setPausen)
      unsub3 = store.subscribeOeffnungszeiten((d) => {
        setZeiten(d?.fenster || null)
        setUrlaub(d?.urlaub || [])
        setOzGeladen(true)
      })
    })
    return () => { aktiv = false; unsub(); unsub2(); unsub3() }
  }, [])

  const tage = useMemo(() => buchbareTage(14, zeiten).filter((t) => !imUrlaub(t, urlaub)), [zeiten, urlaub])
  // Aktuelle/kommende Urlaubszeiträume für den Hinweis auf der Buchungsseite
  const urlaubAktuell = useMemo(() => urlaub.filter((u) => u.bis >= heuteISO()), [urlaub])
  const slotsProTag = useMemo(() => {
    if (!anliegen) return {}
    const map = {}
    for (const t of tage) {
      // Wiederkehrende Pausen/Abwesenheiten des Wochentags blocken die Buchung
      const tagesPausen = pausen
        .filter((p) => p.tag === wochentag(t))
        .map((p) => ({ datum: t, start: p.von, ende: p.bis }))
      map[t] = freieSlots(t, anliegen.dauer, [...busy, ...tagesPausen], zeiten)
    }
    return map
  }, [tage, anliegen, busy, pausen, zeiten])

  async function absenden(e) {
    e.preventDefault()
    setFehler('')
    if (form.name.trim().length < 3) return setFehler(tr(T.fehlerName))
    if (form.telefon.trim().length < 6) return setFehler(tr(T.fehlerTelefon))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setFehler(tr(T.fehlerEmail))
    // Auswahl gegen den AKTUELLEN Stand prüfen: der Slot kann inzwischen vergeben
    // oder der Tag in den Einstellungen geschlossen worden sein
    if (!(slotsProTag[datum] || []).includes(zeit)) {
      setZeit(null)
      setSlotHinweis(true)
      setSchritt(1)
      return
    }
    setSende(true)
    try {
      const store = await getStore()
      await store.addPublicRequest({
        name: form.name.trim(),
        telefon: form.telefon.trim(),
        email: form.email.trim(),
        nachricht: form.nachricht.trim(),
        anliegen: anliegenKanonisch,
        anliegenId: anliegen.id,
        dauer: anliegen.dauer,
        datum,
        start: zeit,
        sprache: getLang(), // Bestätigungs-/Erinnerungs-Mails kommen in dieser Sprache
      })
      setFertig(true)
    } catch (err) {
      setFehler(`${tr(T.fehlerSenden)} ${PRAXIS.telefon}`)
    } finally {
      setSende(false)
    }
  }

  const felder = [
    { key: 'name', label: T.nameLabel, type: 'text', placeholder: T.namePlatzhalter },
    { key: 'telefon', label: T.telefonLabel, type: 'tel', placeholder: T.telefonPlatzhalter },
    { key: 'email', label: T.emailLabel, type: 'email', placeholder: T.emailPlatzhalter },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-praxis-50 via-white to-white text-slate-900">
      <header className="bg-white/90 backdrop-blur border-b border-praxis-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-praxis-700 min-w-0">
            <ZahnLogo className="w-7 h-7 shrink-0" />
            <span className="font-bold text-sm truncate">{PRAXIS.name}</span>
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <SprachSchalter />
            <Link to="/" className="text-sm text-slate-500 hover:text-praxis-700 flex items-center gap-1.5">
              <Icon name="x" className="w-4 h-4" /> <span className="hidden sm:inline">{tr(T.abbrechen)}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24">
        {fertig ? (
          <div className="max-w-lg mx-auto text-center bg-white border border-praxis-100 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-praxis-100 text-praxis-600 flex items-center justify-center">
              <Icon name="check" className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900">{tr(T.fertigTitel)}</h2>
            <div className="mt-4 bg-praxis-50 rounded-2xl p-4 text-left rtl:text-right text-sm space-y-1.5">
              <p><span className="font-semibold text-slate-700">{tr(T.fAnliegen)}</span> {anliegenAnzeige}</p>
              <p><span className="font-semibold text-slate-700">{tr(T.fWunsch)}</span> {datumLok(datum)}, {zeit} {tr(T.uhr)}</p>
              <p><span className="font-semibold text-slate-700">{tr(T.fName)}</span> {form.name}</p>
            </div>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed">
              {tr(T.fertigText)} <span dir="ltr">{form.email}</span>.
            </p>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3 rounded-full">
              {tr(T.zurStartseite)}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">{tr(T.titel)}</h1>
            <p className="text-slate-500 text-center text-sm mt-1 mb-6">{tr(T.untertitel)}</p>
            <Fortschritt schritt={schritt} />
            {/* Urlaubs-Hinweis: sichtbar in jedem Buchungsschritt */}
            {urlaubAktuell.map((u, i) => (
              <p key={i} className="mt-5 max-w-lg mx-auto text-sm text-sky-900 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3.5 text-center leading-relaxed">
                {tr(T.urlaubHinweis)
                  .replace('{von}', datumLok(u.von, { day: '2-digit', month: '2-digit', year: 'numeric' }))
                  .replace('{bis}', datumLok(u.bis, { day: '2-digit', month: '2-digit', year: 'numeric' }))}
              </p>
            ))}

            {/* Schritt 1: Anliegen */}
            {schritt === 0 && (
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                {ANLIEGEN.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAnliegen(a)
                      if (!a.nurTelefon && !a.freitext) setSchritt(1)
                    }}
                    className={`text-left rtl:text-right bg-white border-2 rounded-2xl p-5 transition shadow-sm hover:shadow-md ${
                      a.nurTelefon
                        ? 'border-amber-200 hover:border-amber-400'
                        : 'border-praxis-100 hover:border-praxis-500'
                    } ${anliegen?.id === a.id ? 'border-praxis-600' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                        a.nurTelefon ? 'bg-amber-100 text-amber-600' : 'bg-praxis-50 text-praxis-600'
                      }`}>
                        <Icon name={a.icon} className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tr(a.titel)}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{tr(a.text)}</p>
                        {!a.nurTelefon && !a.freitext && (
                          <p className="text-xs text-praxis-600 font-medium mt-1.5">{tr(T.ca)} {a.dauer} {tr(T.minuten)}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {schritt === 0 && anliegen?.nurTelefon && (
              <div className="mt-6">
                <SchmerzHinweis zurueck={() => setAnliegen(null)} />
              </div>
            )}
            {schritt === 0 && anliegen?.freitext && (
              <div className="mt-6 max-w-lg mx-auto bg-white border-2 border-praxis-500 rounded-2xl p-6 shadow-sm">
                <p className="font-semibold text-slate-900">{tr(T.eigenTitel)}</p>
                <input
                  autoFocus
                  value={eigenText}
                  onChange={(e) => setEigenText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && eigenText.trim().length >= 3) setSchritt(1) }}
                  placeholder={tr(T.eigenPlatzhalter)}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
                <button
                  onClick={() => setSchritt(1)}
                  disabled={eigenText.trim().length < 3}
                  className="mt-4 w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl"
                >
                  {tr(T.eigenWeiter)}
                </button>
              </div>
            )}

            {/* Schritt 2: Termin wählen */}
            {schritt === 1 && anliegen && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{anliegenAnzeige}</span> · {tr(T.ca)} {anliegen.dauer} {tr(T.minuten)}
                  </p>
                  <button onClick={() => setSchritt(0)} className="text-sm text-praxis-700 font-medium hover:underline flex items-center gap-1">
                    <Icon name="arrowLeft" className="w-4 h-4 rtl:rotate-180" /> {tr(T.aendern)}
                  </button>
                </div>
                {slotHinweis && (
                  <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    {tr(T.slotWeg)}
                  </p>
                )}
                {/* Erst anzeigen, wenn die konfigurierten Öffnungszeiten geladen sind –
                    sonst würden kurz Tage aus dem statischen Fallback angeboten */}
                {!ozGeladen ? (
                  <p className="text-center text-sm text-slate-400 py-10">{tr(T.laedtZeiten)}</p>
                ) : tage.every((t) => (slotsProTag[t] || []).length === 0) ? (
                  <div className="text-center bg-white border border-slate-100 rounded-2xl p-8">
                    <p className="text-sm text-slate-600">{tr(T.keineZeiten)}</p>
                    <a href={PRAXIS.telefonLink} className="mt-4 inline-flex items-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3 rounded-full">
                      <Icon name="phone" className="w-5 h-5" /> <span dir="ltr">{PRAXIS.telefon}</span>
                    </a>
                  </div>
                ) : (
                <div className="space-y-3">
                  {tage.map((t) => {
                    const slots = slotsProTag[t] || []
                    if (slots.length === 0) return null
                    const offen = datum === t
                    return (
                      <div key={t} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <button
                          onClick={() => setDatum(offen ? null : t)}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-praxis-50/50"
                        >
                          <span className="font-semibold text-slate-800">
                            {datumLok(t, { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                          <span className="text-sm text-praxis-700 bg-praxis-50 rounded-full px-3 py-1 font-medium">
                            {slots.length} {slots.length === 1 ? tr(T.freieZeit) : tr(T.freieZeiten)}
                          </span>
                        </button>
                        {offen && (
                          <div className="px-5 pb-5 grid grid-cols-3 sm:grid-cols-5 gap-2" dir="ltr">
                            {slots.map((s) => (
                              <button
                                key={s}
                                onClick={() => {
                                  setZeit(s)
                                  setSlotHinweis(false)
                                  setSchritt(2)
                                }}
                                className={`py-3 rounded-xl font-semibold text-sm border-2 transition ${
                                  zeit === s && datum === t
                                    ? 'bg-praxis-600 border-praxis-600 text-white'
                                    : 'border-praxis-100 text-praxis-800 hover:border-praxis-500 hover:bg-praxis-50'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                )}
                <p className="mt-4 text-xs text-slate-400 text-center">{tr(T.slotsHinweis)}</p>
              </div>
            )}

            {/* Schritt 3: Kontaktdaten */}
            {schritt === 2 && anliegen && datum && zeit && (
              <form onSubmit={absenden} className="mt-8 max-w-lg mx-auto">
                <div className="bg-praxis-600 text-white rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{anliegenAnzeige}</p>
                    <p className="text-praxis-100 text-sm mt-0.5">
                      {datumLok(datum, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · <span dir="ltr">{zeit} – {endeZeit(zeit, anliegen.dauer)}</span> {tr(T.uhr)}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSchritt(1)} className="text-sm underline text-praxis-100 hover:text-white shrink-0">
                    {tr(T.aendern)}
                  </button>
                </div>
                <div className="mt-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  {felder.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-sm font-medium text-slate-700">{tr(f.label)}</span>
                      <input
                        type={f.type}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        placeholder={tr(f.placeholder)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-praxis-500"
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{tr(T.nachrichtLabel)}</span>
                    <textarea
                      value={form.nachricht}
                      onChange={(e) => setForm({ ...form, nachricht: e.target.value })}
                      rows={2}
                      placeholder={tr(T.nachrichtPlatzhalter)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-praxis-500"
                    />
                  </label>
                  {/* PZR: Ausfallgebühr deutlich sichtbar VOR dem Absenden */}
                  {anliegen.id === 'pzr' && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
                      ⚠️ {tr(PRAXIS.stornoHinweis)}
                    </p>
                  )}
                  {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
                  <button
                    type="submit"
                    disabled={sende}
                    className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-praxis-600/20"
                  >
                    {sende ? tr(T.sendet) : tr(T.absenden)}
                  </button>
                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    {tr(T.datenschutz)}
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  )
}
