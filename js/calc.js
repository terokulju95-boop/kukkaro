// Jaksojen laskenta sovelluksen tiedoista (välimuistilla, koska samaa jaksoa kysytään monesta kortista)
import { S, list, periods, settings, today, cat } from "./core.js";
import { periodRows, summarize, occurrences, amountAt, timesPerYear, nextOccurrence, round2 } from "./money.js";

let cache = new Map(), cacheKey = "";
// S.dataVer kasvaa aina, kun tiedot tai asetukset muuttuvat (main.js)
function key() { return today() + "|" + (S.dataVer || 0); }
function fresh() { const k = key(); if (k !== cacheKey) { cacheKey = k; cache = new Map(); } }

export const curIndex = () => periods().indexOf(today());
// Jakson tiedot: { p, rows, sum }. Ylijäämän siirto lasketaan aloitusjaksosta eteenpäin.
export function period(n) {
  fresh();
  if (cache.has(n)) return cache.get(n);
  const P = periods(), st = settings(), p = P.get(n);
  const rows = periodRows(p, list("tx"), list("recurring"), P, today());
  let carry = 0;
  if (st.carry && st.carryFrom) {
    const from = P.indexOf(st.carryFrom);
    if (n > from && n - from < 60) carry = period(n - 1).sum.total;
  }
  const sum = summarize(p, rows, today(), st.forecast, carry);
  const r = { p, rows, sum };
  cache.set(n, r);
  return r;
}
export const current = () => period(curIndex());

// Kategorioittain: { catId: summa } annetuista riveistä
export function byCat(rows, kind = "meno", paidOnly = false) {
  const m = {};
  for (const r of rows) if (r.kind === kind && r.state !== "skip" && (!paidOnly || r.state === "paid")) m[r.cat || ""] = round2((m[r.cat || ""] || 0) + r.amount);
  return m;
}
// Toistuvan keskimääräinen hinta jaksossa ja vuodessa
export function recurringCost(r) {
  const amt = amountAt(r, today()), times = timesPerYear(r.rhythm, settings().cycle);
  return { year: round2(amt * times), period: round2(amt * times * settings().cycle / 365.25), month: round2(amt * times / 12) };
}
export const nextOf = r => nextOccurrence(r, today(), periods());
// Säästötavoitteen kertymä: lähtösumma + kategorian toteutuneet säästöt tavoitteen aloituksen jälkeen
export function goalSaved(g) {
  const from = g.baseDate || "0000", t = today(), P = periods();
  let s = Number(g.base) || 0;
  for (const x of list("tx")) if (x.kind === "saasto" && x.cat === g.cat && x.date > from && x.date <= t) s += Number(x.amount) || 0;
  for (const r of list("recurring")) if ((r.kind === "saasto") && r.cat === g.cat) for (const d of occurrences(r, from > r.start ? from : r.start, t, P)) {
    if (d <= from) continue;
    const o = r.occ?.[d]; if (o?.s === "skip") continue;
    if (o?.s === "paid" || (o?.s !== "open" && r.auto !== false)) s += typeof o?.a === "number" ? o.a : amountAt(r, d);
  }
  return round2(s);
}
export const catLabel = id => { const c = cat(id); return `${c.emoji || "•"} ${c.name}`; };
