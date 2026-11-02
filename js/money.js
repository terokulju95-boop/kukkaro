// =============================================================
//  Kukkaro – rahalaskenta (puhtaat funktiot, ei Firebasea)
//  Jaksot, toistuvat menot, pyhäpäivät ja jakson yhteenveto.
//  Testattavissa myös Nodella: node tests/unit.mjs
// =============================================================

// ---------- Päivämäärät (merkkijonot muodossa "2026-11-25") ----------
export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const today = () => ymd(new Date());
export function addMonths(s, n, day) {
  const d = parseYmd(s); const want = day || d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(want, last));
  return ymd(d);
}
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// ---------- Suomen pankkipyhät ----------
// Palkka maksetaan edellisenä pankkipäivänä, jos palkkapäivä osuu viikonloppuun tai pyhään.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(new Date(y, month - 1, day, 12));
}
const holidayCache = {};
export function bankHolidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const e = easter(y);
  // Juhannusaatto: perjantai 19.–25.6.
  let mid = `${y}-06-19`; while (parseYmd(mid).getDay() !== 5) mid = addDays(mid, 1);
  const list = {
    [`${y}-01-01`]: "Uudenvuodenpäivä", [`${y}-01-06`]: "Loppiainen", [addDays(e, -2)]: "Pitkäperjantai",
    [addDays(e, 1)]: "2. pääsiäispäivä", [`${y}-05-01`]: "Vappu", [addDays(e, 39)]: "Helatorstai",
    [mid]: "Juhannusaatto", [`${y}-12-06`]: "Itsenäisyyspäivä", [`${y}-12-24`]: "Jouluaatto",
    [`${y}-12-25`]: "Joulupäivä", [`${y}-12-26`]: "Tapaninpäivä"
  };
  return (holidayCache[y] = list);
}
export const holidayName = s => bankHolidays(Number(s.slice(0, 4)))[s] || null;
export const isBankDay = s => { const wd = parseYmd(s).getDay(); return wd !== 0 && wd !== 6 && !holidayName(s); };
export function prevBankDay(s) { let d = s; for (let i = 0; i < 10 && !isBankDay(d); i++) d = addDays(d, -1); return d; }

// ---------- Asetukset ----------
export const DEFAULT_SETTINGS = {
  payday: "2026-11-25",   // mikä tahansa tiedossa oleva palkkapäivä
  cycle: 28,              // jakson pituus päivinä
  salary: 595.36,         // nettopalkka
  salaryName: "Palkka",
  holidayShift: true,     // viikonloppu/pyhä → edellinen pankkipäivä
  forecast: true,         // "Jäljellä" vähentää myös tulevat toistuvat menot
  carry: false,           // edellisen jakson ylijäämä siirtyy seuraavaan
  carryFrom: null,        // mistä jaksosta siirto alkaa (jakson avain)
  lowPerDay: 10           // varoitusraja: €/päivä
};
export function mergeSettings(s = {}) {
  const t = { ...DEFAULT_SETTINGS };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.payday || "")) t.payday = s.payday;
  if ([7, 14, 28].includes(Number(s.cycle))) t.cycle = Number(s.cycle);
  if (typeof s.salary === "number" && isFinite(s.salary)) t.salary = s.salary;
  if (typeof s.salaryName === "string" && s.salaryName.trim()) t.salaryName = s.salaryName.slice(0, 40);
  for (const k of ["holidayShift", "forecast", "carry"]) if (typeof s[k] === "boolean") t[k] = s[k];
  if (typeof s.carryFrom === "string") t.carryFrom = s.carryFrom;
  if (typeof s.since === "string") t.since = s.since;
  if (typeof s.lowPerDay === "number" && s.lowPerDay >= 0) t.lowPerDay = s.lowPerDay;
  t.done = !!s.done;
  return t;
}

// ---------- Jaksot ----------
// Jakso n alkaa palkkapäivänä payday + n × cycle. Jakson avain on aikataulun mukainen päivä,
// ja käyttäjä voi siirtää yksittäisen jakson alkua (palkka tuli eri päivänä) tai muuttaa sen palkkaa.
export class Periods {
  constructor(settings, overrides = {}) { this.s = mergeSettings(settings); this.o = overrides; this.cache = new Map(); }
  scheduled(n) { return addDays(this.s.payday, n * this.s.cycle); }
  start(n) {
    const key = this.scheduled(n), ov = this.o[key];
    if (ov?.start) return ov.start;
    return this.s.holidayShift ? prevBankDay(key) : key;
  }
  get(n) {
    if (this.cache.has(n)) return this.cache.get(n);
    const key = this.scheduled(n), start = this.start(n), end = addDays(this.start(n + 1), -1), ov = this.o[key] || {};
    const p = { n, key, start, end, days: daysBetween(start, end) + 1, salary: typeof ov.salary === "number" ? ov.salary : this.s.salary, moved: !!ov.start, note: ov.note || "", shifted: !ov.start && start !== key };
    this.cache.set(n, p);
    return p;
  }
  indexOf(date) {
    let n = Math.floor(daysBetween(this.s.payday, date) / this.s.cycle);
    for (let i = 0; i < 4 && date < this.start(n); i++) n--;
    for (let i = 0; i < 4 && date >= this.start(n + 1); i++) n++;
    return n;
  }
  at(date) { return this.get(this.indexOf(date)); }
  byKey(key) { return this.get(Math.round(daysBetween(this.s.payday, key) / this.s.cycle)); }
}

// ---------- Toistuvat ----------
export const RHYTHMS = [
  ["kk", "Kuukausittain", 1], ["palkka", "Joka palkkapäivä", 0], ["vk", "Viikoittain", 7], ["2vk", "Joka 2. viikko", 14],
  ["4vk", "Joka 4. viikko", 28], ["2kk", "Joka 2. kuukausi", 2], ["3kk", "Neljännesvuosittain", 3], ["6kk", "Puolivuosittain", 6], ["vuosi", "Vuosittain", 12]
];
const MONTHLY = { kk: 1, "2kk": 2, "3kk": 3, "6kk": 6, vuosi: 12 };
const WEEKLY = { vk: 7, "2vk": 14, "4vk": 28 };
export const rhythmName = r => (RHYTHMS.find(x => x[0] === r) || RHYTHMS[0])[1];
// Kuinka monta kertaa vuodessa (keskiarvo) – vuosikulun ja jaksokohtaisen keskiarvon laskuun
export function timesPerYear(r, cycle = 28) {
  if (r === "palkka") return 365.25 / cycle;
  if (MONTHLY[r]) return 12 / MONTHLY[r];
  if (WEEKLY[r]) return 365.25 / WEEKLY[r];
  return 12;
}
// Hinta tiettynä päivänä: prices = [{ from, amount }] (vanhin ensin). Ilman historiaa käytetään amount-kenttää.
export function amountAt(r, date) {
  const p = (r.prices || []).filter(x => x && x.from <= date).sort((a, b) => a.from.localeCompare(b.from));
  return p.length ? Number(p.at(-1).amount) || 0 : Number(r.amount) || 0;
}
// Pankkipäiväsiirto: e-lasku, suoramaksu ja toistuva tilisiirto veloitetaan vasta seuraavana pankkipäivänä,
// jos eräpäivä on viikonloppu tai pyhä. Korttiveloitus (esim. Netflix kortilla) tapahtuu samana päivänä.
export const SHIFTS = [
  ["seur", "Seuraavana pankkipäivänä (e-lasku, suoramaksu, toistuva siirto)"],
  ["ei", "Samana päivänä (korttimaksu – myös viikonloppuna)"],
  ["edel", "Edellisenä pankkipäivänä"]
];
export function nextBankDay(s) { let d = s; for (let i = 0; i < 10 && !isBankDay(d); i++) d = addDays(d, 1); return d; }
export const shiftDate = (r, d) => r.rhythm === "palkka" ? d : (r.shift || "seur") === "seur" ? nextBankDay(d) : r.shift === "edel" ? prevBankDay(d) : d;

// Aikataulun mukaiset päivät välillä [a, b] (ennen pankkipäiväsiirtoa)
function scheduledDates(r, a, b, periods) {
  const from = r.start > a ? r.start : a, to = r.end && r.end < b ? r.end : b;
  if (from > to) return [];
  const out = [];
  if (r.rhythm === "palkka" && periods) {
    let n = periods.indexOf(from);
    for (let i = 0; i < 400; i++, n++) { const s = periods.get(n).start; if (s > to) break; if (s >= from) out.push(s); }
  } else if (WEEKLY[r.rhythm]) {
    const step = WEEKLY[r.rhythm];
    let k = Math.max(0, Math.ceil(daysBetween(r.start, from) / step));
    for (let i = 0; i < 400; i++, k++) { const d = addDays(r.start, k * step); if (d > to) break; if (d >= from) out.push(d); }
  } else {
    const step = MONTHLY[r.rhythm] || 1, day = Number(r.day) || parseYmd(r.start).getDate();
    const s0 = parseYmd(r.start), f0 = parseYmd(from);
    let k = Math.max(0, Math.floor(((f0.getFullYear() - s0.getFullYear()) * 12 + f0.getMonth() - s0.getMonth()) / step) - 1);
    for (let i = 0; i < 400; i++, k++) { const d = addMonths(r.start, k * step, day); if (d > to) break; if (d >= from) out.push(d); }
  }
  return out;
}
// Kaikki toistuvan erän todelliset veloituspäivät välillä [a, b] pankkipäiväsiirron jälkeen
export function occurrences(r, a, b, periods) {
  if (!r || r.active === false || !r.start) return [];
  // Siirto voi viedä erän enintään muutaman päivän eteen- tai taaksepäin (esim. pääsiäinen)
  const out = scheduledDates(r, addDays(a, -7), addDays(b, 7), periods).map(d => shiftDate(r, d)).filter(d => d >= a && d <= b);
  return [...new Set(out)];
}
// Seuraava erä tästä päivästä eteenpäin (enintään vuoden päähän)
export function nextOccurrence(r, from, periods) { return occurrences(r, from, addDays(from, 400), periods)[0] || null; }

// Yksittäisen erän tila: paid / skip / late / due
// r.occ = { "2026-11-15": { s: "paid" | "skip" | "open", a: summa } }
export function occState(r, date, t = today()) {
  const o = r.occ?.[date];
  if (o?.s === "skip") return "skip";
  if (o?.s === "paid") return "paid";
  if (o?.s !== "open" && r.auto !== false && date <= t) return "paid";
  return date < t ? "late" : "due";
}
export const occAmount = (r, date) => { const o = r.occ?.[date]; return typeof o?.a === "number" ? o.a : amountAt(r, date); };

// ---------- Jakson rivit ja yhteenveto ----------
// Rivi: { id, date, amount, kind: meno|tulo|saasto, cat, note, recurring?, rid?, state }
export function periodRows(p, tx, recurring, periods, t = today(), withSalary = true) {
  const rows = [];
  if (withSalary && p.salary) rows.push({ id: "salary:" + p.key, date: p.start, amount: p.salary, kind: "tulo", cat: "palkka", note: periods.s.salaryName, salary: true, state: p.start <= t ? "paid" : "due" });
  for (const x of tx) if (x.date >= p.start && x.date <= p.end) rows.push({ ...x, amount: Number(x.amount) || 0, kind: x.kind || "meno", state: "paid" });
  for (const r of recurring) for (const d of occurrences(r, p.start, p.end, periods)) {
    rows.push({ id: r.id + "@" + d, rid: r.id, date: d, amount: occAmount(r, d), kind: r.kind || "meno", cat: r.cat, note: r.name, recurring: true, state: occState(r, d, t), auto: r.auto !== false });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || (a.recurring ? 0 : 1) - (b.recurring ? 0 : 1));
}
export function summarize(p, rows, t = today(), forecast = true, carry = 0) {
  const sum = (f) => round2(rows.filter(f).reduce((s, r) => s + r.amount, 0));
  const live = r => r.state !== "skip";
  const income = sum(r => live(r) && r.kind === "tulo");
  const spent = sum(r => r.kind === "meno" && r.state === "paid");
  const saved = sum(r => r.kind === "saasto" && r.state === "paid");
  const upcoming = sum(r => r.kind === "meno" && (r.state === "due" || r.state === "late"));
  const upSave = sum(r => r.kind === "saasto" && (r.state === "due" || r.state === "late"));
  const late = rows.filter(r => r.state === "late").length;
  const left = round2(carry + income - spent - saved - (forecast ? upcoming + upSave : 0));
  const daysLeft = t < p.start ? p.days : t > p.end ? 0 : daysBetween(t, p.end) + 1;
  return { income, spent, saved, upcoming, upSave, late, carry: round2(carry), left, daysLeft, perDay: daysLeft ? round2(left / daysLeft) : 0, total: round2(carry + income - spent - saved - upcoming - upSave) };
}

// 28 päivän jaksoon osuu kuukausilasku joko kerran tai ei lainkaan: 13 jaksoa, 12 laskua.
// "Kevyt jakso" = kuukausittainen erä, joka on voimassa koko jakson, mutta ei osu siihen.
export function skippedMonthly(p, recurring, periods) {
  return recurring.filter(r => r.rhythm === "kk" && r.active !== false && r.start && r.start <= p.start && (!r.end || r.end >= p.end)
    && occurrences(r, p.start, p.end, periods).length === 0);
}
// Jos jakso on lyhyempi kuin kuukausi (7/14 pv) tai erä on viikoittainen, sama erä voi osua jaksoon useasti
export function doubles(p, recurring, periods) {
  return recurring.map(r => [r, occurrences(r, p.start, p.end, periods)]).filter(([r, d]) => d.length > 1 && MONTHLY[r.rhythm]);
}
