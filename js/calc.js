// Jaksojen laskenta sovelluksen tiedoista (välimuistilla, koska samaa jaksoa kysytään monesta kortista)
import { S, list, periods, settings, today, cat, addDays } from "./core.js";
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
export const catLabel = id => { const c = cat(id); return `${c.emoji || "•"} ${c.name}`; };

// =============================================================
//  Tilit: käyttötilin ja säästötilien saldot
//  Saldo = viimeksi syötetty saldo (balance, balanceDate, balanceAt)
//        + sen jälkeen toteutuneet rivit + tilin omat kirjaukset (entries)
//  Syöttöpäivän rivit oletetaan jo saldossa oleviksi, paitsi tapahtumat,
//  jotka on kirjattu sovellukseen saldon syöttämisen jälkeen.
// =============================================================
export const accounts = () => list("accounts").sort((a, b) => (a.type === "kaytto" ? -1 : 0) - (b.type === "kaytto" ? -1 : 0) || (a.order ?? 99) - (b.order ?? 99) || (a.name || "").localeCompare(b.name || "", "fi"));
export const mainAcc = () => list("accounts").find(a => a.type === "kaytto") || null;
export const savingsAccs = () => accounts().filter(a => a.type !== "kaytto");

// Toteutuneet rivit päivän `from` jälkeen tähän päivään asti
export function rowsSince(from, fromAt = "") {
  const P = periods(), t = today(), out = [];
  if (!from || from > t) return out;
  const a = P.indexOf(from), b = P.indexOf(t);
  for (let n = a; n <= b && n - a < 200; n++) for (const r of period(n).rows) {
    if (r.state !== "paid" || r.date > t || r.date < from) continue;
    if (r.date === from) {
      const tx = !r.recurring && !r.salary ? list("tx").find(x => x.id === r.id) : null;
      if (!tx || !fromAt || (tx.createdAt || "") <= fromAt) continue;
    }
    out.push(r);
  }
  return out;
}
const entriesSince = (acc, from) => (acc.entries || []).filter(e => e.date <= today() && (!from || e.at > (acc.balanceAt || "") || e.date > from));
// Säästötililtä käyttötilille nostetut (ilman tulokirjausta) lisäävät käyttötilin saldoa
function withdrawalsTo(main) {
  let s = 0;
  for (const a of savingsAccs()) for (const e of a.entries || []) if (e.type === "nosto" && e.toMain && !e.txId && e.date <= today() && (e.date > main.balanceDate || (e.date === main.balanceDate && e.at > (main.balanceAt || "")))) s += Math.abs(e.amount);
  return s;
}
export function accBalance(acc) {
  if (!acc) return 0;
  let s = Number(acc.balance) || 0;
  if (acc.type === "kaytto") {
    for (const r of rowsSince(acc.balanceDate, acc.balanceAt)) s += r.kind === "tulo" ? r.amount : -r.amount;
    s += withdrawalsTo(acc);
  } else if (acc.cat) {
    for (const r of rowsSince(acc.balanceDate, acc.balanceAt)) if (r.kind === "saasto" && r.cat === acc.cat) s += r.amount;
  }
  for (const e of entriesSince(acc, acc.balanceDate)) s += Number(e.amount) || 0;
  return round2(s);
}
// Käyttötili: nyt, laskujen jälkeen ennen seuraavaa palkkaa, ja kuinka paljon on aiemmista palkoista
export function mainSummary() {
  const acc = mainAcc(); if (!acc) return null;
  const now = accBalance(acc), { rows, sum } = current();
  const pending = rows.filter(r => !r.salary && (r.state === "due" || r.state === "late") || (!r.recurring && !r.salary && r.date > today()));
  const net = round2(pending.reduce((s, r) => s + (r.kind === "tulo" ? r.amount : -r.amount), 0));
  const after = round2(now + net);
  return { acc, now, after, net, thisPay: sum.total, older: round2(after - sum.total) };
}
export const savingsTotal = () => round2(savingsAccs().reduce((s, a) => s + accBalance(a), 0));
// Viimeisimmät tilitapahtumat (näytetään tilin ikkunassa)
export function accMovements(acc, limit = 40) {
  const from = addDays(today(), -120);
  const base = acc.balanceDate && acc.balanceDate > from ? acc.balanceDate : from;
  let rows = rowsSince(base, acc.balanceDate === base ? acc.balanceAt : "");
  if (acc.type !== "kaytto") rows = rows.filter(r => r.kind === "saasto" && r.cat === acc.cat);
  const ent = (acc.entries || []).filter(e => e.date <= today()).map(e => ({ id: "e:" + e.at, date: e.date, amount: Math.abs(e.amount), kind: e.amount >= 0 ? "tulo" : "meno", note: ENTRY_TYPES[e.type] + (e.note ? ": " + e.note : ""), entry: e, state: "paid" }));
  return [...rows.map(r => acc.type === "kaytto" ? r : { ...r, kind: "tulo" }), ...ent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
export const ENTRY_TYPES = { korko: "Korko / tuotto", talletus: "Talletus", nosto: "Nosto", tasaus: "Saldon tasaus" };
