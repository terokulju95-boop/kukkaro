// =============================================================
//  TOIMINNOT: lomakkeet, napautukset ja tallennukset
// =============================================================
import {
  $, DEFAULT_CATS, KINDS, NAV_MAX, S, SUGGESTED_RECURRING, LOGIN_EMAIL, auth, cat, cats, catColor, closeModal, collection, db, deleteField, doc, esc, eur,
  fail, findIn, fmtDate, fmtDateLong, fmtShort, fmtWd, getDoc, list, nowIso, openForm, openSheet, patch, periods, remove, save, saveSettings,
  sendPasswordResetEmail, setDoc, settings, signOut, toast, today, writeBatch, num, addDays
} from "./core.js";
import { RHYTHMS, SHIFTS, amountAt, occState, occAmount, parseYmd, round2, rhythmName } from "./money.js";
import { period, curIndex, accBalance, mainAcc, accMovements, ENTRY_TYPES } from "./calc.js";
import { rowHtml } from "./views/rows.js";
import { render, renderNav } from "./main.js";
import { DARK_STYLES, DEFAULT_THEME, T, THEME_DOC, THEME_PRESETS, cacheTheme, discardThemeDraft, mergeTheme, previewTheme, themeDirty } from "./theme.js";
import { THEMEVER_ACTIONS, pushThemeHistory } from "./views/teemat.js";
import { askNewPin, clearLock } from "./lock.js";

const KIND_OPTS = [["meno", "Meno"], ["tulo", "Tulo"], ["saasto", "Säästö"]];

// ---------- Poisto: kysytään tai kumottavissa ----------
export function confirmDel(text, col, item, after) {
  if (T().features.confirmDelete) {
    if (!confirm(text)) return false;
    remove(col, item.id); after?.(); toast("Poistettu"); return true;
  }
  const { id, ...data } = item;
  remove(col, id); after?.();
  toast("Poistettu", false, () => setDoc(doc(db, col, id), data).catch(fail));
  return true;
}

// ---------- Tapahtuma (pikalisäys ja muokkaus) ----------
// Viimeksi käytetyt menot pikavalinnoiksi: sama selite + kategoria, yleisimmät ensin
function recentSuggestions(kind) {
  const since = addDays(today(), -120), m = new Map();
  for (const x of list("tx")) {
    if (x.date < since || (x.kind || "meno") !== kind || !x.note) continue;
    const k = x.note.trim().toLowerCase() + "|" + x.cat;
    const e = m.get(k) || { note: x.note.trim(), cat: x.cat, n: 0, last: "", amount: x.amount };
    e.n++; if ((x.date || "") >= e.last) { e.last = x.date; e.amount = x.amount; }
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 8);
}
export const TX_FIELDS = [
  { name: "kind", label: "Laji", type: "segment", options: KIND_OPTS, def: "meno" },
  { name: "amount", label: "Summa (€)", type: "number", required: true, big: true, autofocus: true },
  { name: "cat", label: "Kategoria", type: "catpick", kindFrom: "kind" },
  { name: "date", label: "Päivä", type: "date", required: true, def: today },
  { name: "note", label: "Selite", placeholder: "esim. Lidl, Neste, synttärilahja", list: () => [...new Set(list("tx").map(x => x.note).filter(Boolean))].slice(-60) }
];
export function txForm(values = {}, id = null) {
  const kind0 = values.kind || "meno";
  const sugg = !id && T().features.quickRecent ? recentSuggestions(kind0) : [];
  const topHtml = sugg.length ? `<div class="fld"><span>Pikavalinnat</span><div class="chips quick-sugg">${sugg.map((s, i) => `<button type="button" class="chip-btn" data-sugg="${i}">${esc(cat(s.cat).emoji || "")} ${esc(s.note)}</button>`).join("")}</div></div>` : "";
  const form = openForm({
    title: id ? "Muokkaa tapahtumaa" : "Uusi tapahtuma", fields: TX_FIELDS, values, topHtml,
    submitLabel: id ? "Tallenna" : "Lisää",
    onSubmit: v => {
      if (!v.amount || v.amount <= 0) { alert("Anna summa (suurempi kuin 0)."); return false; }
      if (id) { save("tx", v, id); toast("Tallennettu"); }
      else { save("tx", v); const p = periods().at(v.date); toast(`${KINDS[v.kind][0]} ${eur(v.amount)} lisätty${p.n !== curIndex() ? ` jaksoon ${fmtShort(p.start)}–${fmtShort(p.end)}` : ""}`); }
    },
    onDelete: id ? () => confirmDel("Poistetaanko tapahtuma?", "tx", findIn("tx", id)) : null
  });
  form.querySelectorAll("[data-sugg]").forEach(b => b.onclick = () => {
    const s = sugg[Number(b.dataset.sugg)];
    form.elements.note.value = s.note;
    form.elements.cat.value = s.cat;
    form.querySelectorAll(".catbtn").forEach(c => c.classList.toggle("on", c.dataset.cid === s.cat));
    if (!form.elements.amount.value) form.elements.amount.value = (Number(s.amount) || 0).toLocaleString("fi-FI", { minimumFractionDigits: 2 });
    form.elements.amount.focus(); form.elements.amount.select();
  });
}
export const fabHtml = () => `<button class="fab" data-action="addTx" aria-label="Lisää tapahtuma"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`;

// ---------- Toistuva ----------
export const REC_FIELDS = [
  { name: "name", label: "Nimi", required: true, placeholder: "esim. Netflix" },
  { name: "kind", label: "Laji", type: "segment", options: KIND_OPTS, def: "meno" },
  { name: "amount", label: "Summa (€)", type: "number", required: true },
  { name: "cat", label: "Kategoria", type: "catpick", kindFrom: "kind" },
  { name: "rhythm", label: "Toistuu", type: "select", options: RHYTHMS.map(r => [r[0], r[1]]), def: "kk" },
  { name: "start", label: "Seuraava (tai ensimmäinen) veloituspäivä", type: "date", required: true, def: today, hint: "Kuukausittaisissa veloituspäivä on tämän päivän numero joka kuukausi. \"Kuukauden viimeinen päivä\" -rytmissä erä on aina kuun viimeisenä päivänä (28.–31.), ja tästä päivästä katsotaan vain, mistä kuusta se alkaa." },
  { name: "end", label: "Päättyy (tyhjä = toistaiseksi)", type: "date" },
  { name: "shift", label: "Jos eräpäivä on viikonloppu tai pyhä, raha lähtee tililtä", type: "select", options: SHIFTS, def: "seur", hint: "Ei koske \"Joka palkkapäivä\" -rytmiä: palkkapäivä on aina pankkipäivä." },
  { name: "auto", label: "Menee automaattisesti", type: "checkbox", def: true, hint: "Suoraveloitus, e-laskun automaattihyväksyntä tai kortti. Erä merkitään maksetuksi eräpäivänä itsestään. Pois päältä: kuittaat erän itse maksetuksi." },
  { name: "note", label: "Lisätiedot", type: "textarea", rows: 2 }
];
export function recForm(values = {}, id = null) {
  const old = id ? findIn("recurring", id) : null;
  const extraHtml = old ? `<label class="fld"><span>Jos hinta muuttui: uusi hinta voimassa alkaen</span>${`<span class="datefld"><input name="priceFrom" type="date" value="${today()}"><span class="date-show">${fmtDateLong(today())}</span></span>`}<small class="muted">Aiemmat jaksot lasketaan vanhalla hinnalla.</small></label>` : "";
  const form = openForm({
    title: old ? "Muokkaa: " + old.name : "Uusi toistuva", fields: REC_FIELDS, extraHtml,
    values: old ? { ...old, amount: amountAt(old, today()) } : values,
    onSubmit: (v, f) => {
      if (v.amount === null || v.amount < 0) { alert("Anna summa."); return false; }
      if (v.end && v.end < v.start) { alert("Päättymispäivä on ennen aloituspäivää."); return false; }
      const data = { ...v, active: old ? old.active !== false : true, day: v.rhythm === "kkloppu" ? 31 : parseYmd(v.start).getDate() };
      if (old) {
        const was = amountAt(old, today());
        if (round2(was) !== round2(v.amount)) {
          const from = f.elements.priceFrom?.value || today();
          const prices = (old.prices?.length ? [...old.prices] : [{ from: old.start || "2000-01-01", amount: Number(old.amount) || 0 }]).filter(x => x.from < from);
          prices.push({ from, amount: v.amount });
          data.prices = prices;
          toast(`Hinta päivitetty ${fmtDate(from)} alkaen`);
        } else toast("Tallennettu");
        save("recurring", data, old.id);
      } else { save("recurring", { ...data, prices: [], occ: {} }); toast(`${v.name} lisätty`); }
    },
    onDelete: old ? () => confirmDel(`Poistetaanko "${old.name}"? Myös aiempien jaksojen erät häviävät laskuista. Jos toistuva vain loppui, aseta mieluummin päättymispäivä.`, "recurring", old) : null
  });
  return form;
}
export function occSheet(rid, date) {
  const r = findIn("recurring", rid); if (!r) return;
  const st = occState(r, date), amt = occAmount(r, date), o = r.occ?.[date];
  const stTxt = { paid: r.auto !== false && !o ? "Maksettu automaattisesti" : "Maksettu", skip: "Ohitettu tällä kertaa", late: "Myöhässä – ei vielä kuitattu", due: "Tulossa" }[st];
  const btn = (k, l, cls = "") => `<button class="btn block ${cls}" data-sheet="${k}">${l}</button>`;
  openSheet(r.name, `<div class="occ-head"><div class="huge">${eur(amt)}</div><div class="muted">${fmtDateLong(date)} · ${esc(rhythmName(r.rhythm))}</div><div class="chips">${stateChip(st)}</div><p class="small muted">${stTxt}${typeof o?.a === "number" ? " · summaa muutettu tälle kerralle" : ""}</p></div>
    <div class="sheet-btns">
      ${st !== "paid" ? btn("paid", "✓ Merkitse maksetuksi", "primary") : btn("open", "Merkitse maksamattomaksi")}
      ${st !== "skip" ? btn("skip", "Ohita tämä kerta") : ""}
      ${btn("amount", "Muuta tämän kerran summaa")}
      ${o ? btn("reset", "Palauta oletukseksi", "ghost") : ""}
      ${btn("edit", "Muokkaa toistuvaa", "ghost")}
    </div>`, k => {
    const key = `occ.${date}`;
    if (k === "paid") { patch("recurring", r.id, { [key]: { ...(o || {}), s: "paid", at: nowIso() } }); toast("Merkitty maksetuksi"); }
    if (k === "open") patch("recurring", r.id, { [key]: { ...(o || {}), s: "open" } });
    if (k === "skip") { patch("recurring", r.id, { [key]: { ...(o || {}), s: "skip" } }); toast("Ohitettu tällä kertaa"); }
    if (k === "reset") patch("recurring", r.id, { [key]: deleteField() });
    if (k === "amount") {
      const v = prompt(`Summa ${fmtDate(date)} (€):`, amt.toLocaleString("fi-FI", { minimumFractionDigits: 2 }));
      if (v === null) return false;
      patch("recurring", r.id, { [key]: { ...(o || {}), a: num(v) } }); toast("Summa muutettu tälle kerralle");
    }
    if (k === "edit") setTimeout(() => recForm({}, r.id), 30);
  });
}
export const stateChip = st => ({
  paid: '<span class="chip ok-chip">✓ Maksettu</span>', skip: '<span class="chip">Ohitettu</span>',
  late: '<span class="chip bad">Myöhässä</span>', due: '<span class="chip">Tulossa</span>'
})[st];

// ---------- Jakso: palkka ja alkupäivä ----------
export function periodSheet(n) {
  const { p } = period(n), st = settings(), ov = findIn("periods", p.key);
  const close = openSheet(`Jakso ${fmtShort(p.start)}–${fmtShort(p.end)}`, `
    <div class="dl"><div class="dl-row"><dt>Palkkapäivä aikataulun mukaan</dt><dd>${fmtDateLong(p.key)}</dd></div>
    <div class="dl-row"><dt>Jakso alkaa</dt><dd>${fmtDateLong(p.start)}${p.moved ? " (siirretty)" : p.shifted ? " (pyhä/viikonloppu)" : ""}</dd></div>
    <div class="dl-row"><dt>Pituus</dt><dd>${p.days} päivää</dd></div>
    <div class="dl-row"><dt>${esc(st.salaryName)}</dt><dd>${eur(p.salary)}${p.salary !== st.salary ? " (muutettu)" : ""}</dd></div></div>
    ${p.note ? `<p class="notes">${esc(p.note)}</p>` : ""}
    <div class="sheet-btns">
      ${n === curIndex() + 1 || (n === curIndex() && p.start > today()) ? `<button class="btn primary block" data-sheet="today">💶 Palkka tuli tänään</button>` : ""}
      <button class="btn block" data-sheet="salary">Muuta tämän jakson palkkaa</button>
      <button class="btn block" data-sheet="start">Palkka tuli eri päivänä</button>
      <button class="btn block" data-sheet="note">Muistiinpano jaksolle</button>
      ${ov ? '<button class="btn ghost block" data-sheet="reset">Palauta jakso aikataulun mukaiseksi</button>' : ""}
    </div>`, k => {
    const upd = data => save("periods", { ...(ov ? {} : { key: p.key }), ...data }, p.key);
    if (k === "today") { upd({ start: today() }); toast("Uusi jakso alkoi tänään"); S.pOffset = 0; }
    if (k === "salary") {
      const v = prompt(`${st.salaryName} tällä jaksolla (€):`, p.salary.toLocaleString("fi-FI", { minimumFractionDigits: 2 }));
      if (v === null) return false;
      upd({ salary: num(v) }); toast("Jakson palkka päivitetty");
    }
    if (k === "start") {
      const v = prompt("Päivä, jona palkka tuli (pp.kk.vvvv):", fmtDate(p.start));
      if (v === null) return false;
      const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (!m) { alert("Kirjoita päivä muodossa 24.11.2026"); return false; }
      const d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (Math.abs((parseYmd(d) - parseYmd(p.key)) / 864e5) > 10) { alert("Päivän pitää olla enintään 10 päivän päässä aikataulun mukaisesta palkkapäivästä."); return false; }
      upd({ start: d }); toast(`Jakso alkaa ${fmtDate(d)}`);
    }
    if (k === "note") { const v = prompt("Muistiinpano jaksolle:", p.note || ""); if (v === null) return false; upd({ note: v.trim() }); }
    if (k === "reset") { remove("periods", p.key); toast("Jakso palautettu"); }
    render();
  });
  return close;
}

// ---------- Kategoriat ----------
export const CAT_FIELDS = [
  { name: "name", label: "Nimi", required: true, max: 40 },
  { name: "emoji", label: "Kuvake (emoji)", placeholder: "🛒", max: 4 },
  { name: "kind", label: "Laji", type: "segment", options: KIND_OPTS, def: "meno" },
  { name: "color", label: "Väri", type: "color" },
  { name: "budget", label: "Budjetti jaksossa (€)", type: "number", hint: "Valinnainen. Näkyy etusivun Budjetit-kortissa ja varoittaa, kun raja lähestyy." }
];
export function catForm(id) {
  const c = id ? findIn("categories", id) : null;
  openForm({
    title: c ? "Muokkaa kategoriaa" : "Uusi kategoria", fields: CAT_FIELDS, values: c ? { ...c, color: catColor(c) } : { color: "#3e6db5", kind: S.tab.kategoriat || "meno" },
    onSubmit: v => { const data = { ...v, emoji: v.emoji || "•" }; if (c) save("categories", data, c.id); else save("categories", { ...data, order: cats().length * 10 + 10 }); },
    onDelete: c ? () => {
      const used = list("tx").filter(x => x.cat === c.id).length + list("recurring").filter(x => x.cat === c.id).length;
      return confirmDel(`Poistetaanko kategoria "${c.name}"?${used ? ` Se on käytössä ${used} kirjauksessa – ne näkyvät jatkossa "Poistettu kategoria" -nimellä.` : ""}`, "categories", c);
    } : null
  });
}
// ---------- Aloitus ja oletustiedot ----------
export function seedCategories(b) {
  DEFAULT_CATS.forEach(([id, name, emoji, kind], i) => b.set(doc(db, "categories", id), { name, emoji, kind, order: (i + 1) * 10, createdAt: nowIso() }));
}
export function seedRecurring(b, start) {
  SUGGESTED_RECURRING.forEach(([name, catId, kind, rhythm, shift]) => b.set(doc(collection(db, "recurring")), {
    name, cat: catId, kind, rhythm, shift, amount: 0, start, day: parseYmd(start).getDate(), auto: true, active: true, prices: [], occ: {}, needsAmount: true, createdAt: nowIso()
  }));
}

// ---------- Varmuuskopio ----------
const COLS_ALL = ["tx", "recurring", "categories", "goals", "periods", "accounts"];
export async function exportJson() {
  const out = { app: "kukkaro", version: 1, exportedAt: nowIso(), settings: S.settings, theme: S.theme, data: {} };
  for (const c of COLS_ALL) out.data[c] = list(c);
  download(`kukkaro-varmuuskopio-${today()}.json`, JSON.stringify(out, null, 1), "application/json");
  setDoc(doc(db, "app", "meta"), { lastBackupAt: nowIso() }, { merge: true }).catch(() => { });
  S.lastBackupAt = nowIso();
  toast("Varmuuskopio ladattu");
}
export async function importJson(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("Tiedosto ei ole kelvollinen varmuuskopio", true); return; }
  if (data?.app !== "kukkaro" || !data.data) { toast("Tämä ei ole Kukkaron varmuuskopio", true); return; }
  const n = COLS_ALL.reduce((s, c) => s + (data.data[c]?.length || 0), 0);
  if (!confirm(`Palautetaanko varmuuskopio ${fmtDate((data.exportedAt || "").slice(0, 10))} (${n} kirjausta)? Samat kirjaukset korvataan, uudemmat säilyvät.`)) return;
  let b = writeBatch(db), k = 0;
  const flush = async () => { await b.commit(); b = writeBatch(db); k = 0; };
  for (const c of COLS_ALL) for (const { id, ...d } of data.data[c] || []) { b.set(doc(db, c, id), d); if (++k >= 400) await flush(); }
  if (data.settings) b.set(doc(db, "app", "settings"), data.settings);
  if (data.theme) b.set(THEME_DOC(), data.theme);
  await flush().catch(fail);
  toast("Varmuuskopio palautettu");
}
export function exportCsv(year) {
  const P = periods(), rows = [["Päivä", "Laji", "Summa", "Kategoria", "Selite", "Toistuva", "Tila", "Jakso"]];
  const a = periods().indexOf(`${year}-01-01`), b = periods().indexOf(`${year}-12-31`);
  for (let n = a; n <= b; n++) for (const r of [...period(n).rows].reverse()) {
    if (!r.date.startsWith(String(year)) || r.state === "skip") continue;
    const p = P.get(n);
    rows.push([fmtDate(r.date), KINDS[r.kind][0], r.amount.toFixed(2).replace(".", ","), cat(r.cat).name, r.note || "", r.recurring ? "kyllä" : "", { paid: "toteutunut", late: "myöhässä", due: "tulossa" }[r.state] || "", `${fmtDate(p.start)}–${fmtDate(p.end)}`]);
  }
  const csv = "﻿" + rows.map(r => r.map(x => /[;"\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x).join(";")).join("\r\n");
  download(`kukkaro-${year}.csv`, csv, "text/csv");
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// =============================================================
export const ACTIONS = {
  tab: d => { S.tab[d.view] = d.tab; if (location.hash.slice(1) !== d.view) location.hash = d.view; else render(); },
  addTx: d => txForm(d.kind ? { kind: d.kind } : {}),
  editTx: d => { const x = findIn("tx", d.id); if (x) txForm(x, x.id); },
  row: d => {
    if (d.rid) return occSheet(d.rid, d.date);
    if (d.salary) return periodSheet(periods().indexOf(d.date));
    const x = findIn("tx", d.id); if (x) txForm(x, x.id);
  },
  pNav: d => { S.pOffset = d.dir === "0" ? 0 : S.pOffset + Number(d.dir); render(); },
  pMenu: () => periodSheet(curIndex() + S.pOffset),
  pJump: d => { S.pOffset = Number(d.n) - curIndex(); S.keepOffset = true; S.catFilter = null; location.hash = "jakso"; },
  statRange: d => { S.statRange = d.v; render(); },
  statKind: d => { S.statKind = d.v; render(); },
  catFilter: d => {
    if (S.view !== "jakso") { S.pOffset = 0; S.catFilter = d.cat; location.hash = "jakso"; return; }
    S.catFilter = S.catFilter === d.cat ? null : d.cat; render();
  },
  reveal: () => { S.revealed = !S.revealed; render(); },

  addRec: d => recForm({ kind: d.kind || "meno" }),
  editRec: d => recForm({}, d.id),
  toggleRec: d => {
    const r = findIn("recurring", d.id); if (!r) return;
    const on = r.active === false;
    if (!on && !confirm(`Keskeytetäänkö "${r.name}"? Se ei näy tulevissa jaksoissa ennen kuin jatkat sitä. Jos tilaus loppui kokonaan, aseta mieluummin päättymispäivä, jolloin vanhat jaksot pysyvät oikein.`)) return;
    patch("recurring", r.id, { active: on }); toast(on ? "Jatkuu taas" : "Keskeytetty");
  },
  payOcc: d => {
    const r = findIn("recurring", d.rid); if (!r) return;
    const o = r.occ?.[d.date];
    patch("recurring", r.id, { [`occ.${d.date}`]: { ...(o || {}), s: "paid", at: nowIso() } });
    toast(`${r.name} merkitty maksetuksi`, false, () => patch("recurring", r.id, { [`occ.${d.date}`]: o || deleteField() }));
  },
  seedRec: () => {
    const b = writeBatch(db); seedRecurring(b, today()); b.commit().catch(fail);
    toast("Ehdotukset lisätty – täydennä summat ja päivät");
  },

  addCat: () => catForm(),
  editCat: d => catForm(d.id),
  moveCat: d => {
    const k = cats().filter(c => (c.kind || "meno") === d.kind); const i = k.findIndex(x => x.id === d.id), j = i + Number(d.dir);
    if (i < 0 || j < 0 || j >= k.length) return;
    [k[i], k[j]] = [k[j], k[i]];
    const b = writeBatch(db); k.forEach((x, n) => b.update(doc(db, "categories", x.id), { order: (n + 1) * 10 })); b.commit().catch(fail);
  },
  seedCats: () => { const b = writeBatch(db); seedCategories(b); b.commit().catch(fail); toast("Oletuskategoriat lisätty"); },

  // Asetukset
  exportJson: () => exportJson(),
  exportCsv: d => exportCsv(Number(d.year)),
  logout: () => { if (confirm("Kirjaudutaanko ulos tältä laitteelta?")) signOut(auth); },
  resetPw: async () => { try { await sendPasswordResetEmail(auth, S.user?.email || LOGIN_EMAIL); toast("Salasanan vaihtolinkki lähetetty: " + (S.user?.email || LOGIN_EMAIL)); } catch (e) { toast("Virhe: " + e.message, true); } },
  copy: async d => { try { await navigator.clipboard.writeText(d.text); toast("Kopioitu"); } catch { prompt("Kopioi:", d.text); } },
  lockSet: d => askNewPin(Number(d.len) || 4, 1, render),
  lockOff: () => { if (confirm("Poistetaanko sovelluslukko tältä laitteelta?")) { clearLock(); toast("Sovelluslukko poistettu"); render(); } },
  toggleHide: () => {
    const t = mergeTheme(S.theme); t.features.hideAmounts = !t.features.hideAmounts;
    S.theme = t; cacheTheme(); setDoc(THEME_DOC(), { ...t, updatedAt: nowIso() }).catch(fail);
    toast(t.features.hideAmounts ? "Summat piilotetaan etusivulla" : "Summat näytetään"); render();
  },
  wipeAll: async () => {
    if (prompt('Tämä poistaa KAIKKI tapahtumat, toistuvat, kategoriat, tilit ja jaksojen muutokset. Ota ensin varmuuskopio. Kirjoita POISTA vahvistaaksesi:') !== "POISTA") return;
    let b = writeBatch(db), k = 0;
    for (const c of COLS_ALL) for (const x of list(c)) { b.delete(doc(db, c, x.id)); if (++k >= 400) { await b.commit(); b = writeBatch(db); k = 0; } }
    b.delete(doc(db, "app", "settings"));
    await b.commit().catch(fail); toast("Kaikki tiedot poistettu");
  },

  // Ulkoasu
  themePal: d => { S.themePal = d.pal; previewTheme(); render(); },
  themePreset: d => {
    const p = THEME_PRESETS[d.preset]; if (!p || !S.themeDraft) return;
    S.themeDraft.light = { ...p.light }; S.themeDraft.dark = { ...p.dark };
    previewTheme(); render(); toast(`Teema ${p.name} valittu – muista tallentaa`);
  },
  themeDarkStyle: d => {
    const st = DARK_STYLES[d.v]; if (!st || !S.themeDraft) return;
    Object.assign(S.themeDraft.dark, { bg: st.bg, card: st.card, line: st.line });
    S.themePal = "dark"; previewTheme(); render(); toast(`${st.name} valittu – muista tallentaa`);
  },
  homeEdit: () => {
    if (S.view === "ulkoasu" && themeDirty()) { toast("Tallenna tai peru ensin ulkoasun muutokset", true); return; }
    S.themeDraft = structuredClone(S.theme); S.homeEdit = true;
    if (S.view !== "koti") location.hash = "koti"; else { previewTheme(); render(); }
  },
  homeMove: d => {
    if (!S.themeDraft) return;
    const D = S.themeDraft.home, o = D.order;
    const vis = o.filter(k => !D.hidden[k]); const i = vis.indexOf(d.key), j = i + Number(d.dir);
    if (i < 0 || j < 0 || j >= vis.length) return;
    const a = o.indexOf(vis[i]), b = o.indexOf(vis[j]);
    [o[a], o[b]] = [o[b], o[a]]; render();
  },
  navMove: d => {
    if (!S.themeDraft) return;
    const o = S.themeDraft.navItems; const i = o.indexOf(d.key), j = i + Number(d.dir);
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; renderNav(); render();
  },
  menuMove: d => {
    if (!S.themeDraft) return;
    const o = S.themeDraft.menu.order; const i = o.indexOf(d.key), j = i + Number(d.dir);
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; render();
  },
  navRemove: d => { if (!S.themeDraft) return; S.themeDraft.navItems = S.themeDraft.navItems.filter(k => k !== d.key); render(); },
  navAdd: d => {
    if (!S.themeDraft || S.themeDraft.navItems.includes(d.key)) return;
    if (S.themeDraft.navItems.length >= NAV_MAX) { toast(`Alavalikkoon mahtuu ${NAV_MAX} osiota`, true); return; }
    S.themeDraft.navItems.push(d.key); render();
  },
  homeSize: d => { if (!S.themeDraft) return; S.themeDraft.home.size[d.key] = d.size; render(); },
  homeHide: d => { if (!S.themeDraft) return; S.themeDraft.home.hidden[d.key] = true; render(); },
  homeShow: d => { if (!S.themeDraft) return; delete S.themeDraft.home.hidden[d.key]; render(); },
  homeDefaults: () => {
    if (!S.themeDraft || !confirm("Palautetaanko etusivun oletusasettelu (järjestys, koot, otsikot)?")) return;
    S.themeDraft.home = structuredClone(DEFAULT_THEME.home); render();
  },
  homeCancel: () => { if (themeDirty() && !confirm("Hylätäänkö etusivun muutokset?")) return; discardThemeDraft(); render(); },
  themeReset: () => {
    if (!S.themeDraft || !confirm("Palautetaanko oletusulkoasu? Muutos tulee voimaan, kun painat Tallenna.")) return;
    S.themeDraft = structuredClone(DEFAULT_THEME); previewTheme(); render();
  },
  themeUndo: () => { if (!S.themeDraft) return; S.themeDraft = structuredClone(S.theme); previewTheme(); render(); },
  themeSave: () => {
    if (!S.themeDraft) return;
    const data = mergeTheme(S.themeDraft), at = nowIso();
    if (JSON.stringify(S.theme) !== JSON.stringify(data)) pushThemeHistory(S.theme, S.themeMeta);
    setDoc(THEME_DOC(), { ...data, updatedAt: at }).catch(fail);
    S.theme = data; S.themeMeta = { at };
    if (S.homeEdit) { S.homeEdit = false; S.themeDraft = null; } else S.themeDraft = structuredClone(data);
    cacheTheme(); previewTheme(); render();
    toast("Ulkoasu tallennettu");
  },
  ...THEMEVER_ACTIONS
};

// ---------- Tapahtumat ----------
document.addEventListener("click", e => {
  if (e.target.closest("#modal")) return;
  if (e.target.closest(".hide-amts .amt-v, .hide-amts .huge")) { e.preventDefault(); S.revealed = true; render(); return; }
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener("toggle", e => {
  if (e.target.tagName === "DETAILS" && e.target.id) e.target.open ? S.openDetails.add(e.target.id) : S.openDetails.delete(e.target.id);
}, true);
document.addEventListener("change", e => { if (e.target.id === "import-file" && e.target.files[0]) { importJson(e.target.files[0]); e.target.value = ""; } });

// Verkkotila ja lähetystä odottavat muutokset
let lastPending = 0;
export function updateNet() {
  const n = $("#netstatus"); if (!n) return;
  const pending = Object.values(S.pending || {}).reduce((a, b) => a + b, 0);
  const off = !navigator.onLine;
  const many = pending === 1 ? "1 muutos" : `${pending} muutosta`;
  n.hidden = !off && !pending;
  n.classList.toggle("sending", !off && pending > 0);
  n.textContent = off ? (pending ? `Ei yhteyttä – ${many} odottaa ja lähtee, kun yhteys palaa` : "Ei yhteyttä – voit jatkaa, muutokset tallentuvat laitteelle") : `Lähetetään ${many}…`;
  if (lastPending > 0 && pending === 0 && !off) toast("✓ Kaikki muutokset tallennettu");
  lastPending = pending;
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);

// =============================================================
//  TILIT
// =============================================================

const accFields = (type, isNew) => [
  { name: "name", label: "Tilin nimi", required: true, def: type === "kaytto" ? "Käyttötili" : "" , placeholder: type === "kaytto" ? "Käyttötili" : "esim. ASP-tili" },
  { name: "emoji", label: "Kuvake (emoji)", def: type === "kaytto" ? "💳" : "🏦", max: 4 },
  { name: "balance", label: isNew ? "Saldo nyt (€)" : "Saldo nyt (€) – korjaa, jos pankki näyttää muuta", type: "number", required: true, hint: type === "kaytto" ? "Katso verkkopankista tilin saldo juuri nyt. Tästä eteenpäin Kukkaro laskee saldon itse kirjauksistasi." : "Säästötilin saldo tänään. Toistuvat säästöt ja tämän kategorian säästökirjaukset lisätään siihen automaattisesti." },
  ...(type === "kaytto" ? [] : [
    { name: "cat", label: "Säästökategoria", type: "select", options: () => [...cats("saasto").map(c => [c.id, `${c.emoji} ${c.name}`]), ["__new", "+ Luo uusi kategoria tilin nimellä"]], hint: "Säästöt tähän kategoriaan siirtyvät käyttötililtä tälle tilille." },
    { name: "target", label: "Säästötavoite (€, valinnainen)", type: "number" },
    { name: "deadline", label: "Tavoitepäivä (valinnainen)", type: "date" }
  ])
];
export function accForm(id, type = "saasto") {
  const a = id ? findIn("accounts", id) : null; type = a?.type || type;
  const cur = a ? accBalance(a) : null;
  openForm({
    title: a ? "Muokkaa: " + a.name : type === "kaytto" ? "Käyttötilin saldo" : "Uusi säästötili",
    fields: accFields(type, !a), values: a ? { ...a, balance: cur } : {},
    onSubmit: v => {
      const data = { ...v, type };
      if (v.cat === "__new") {
        const cid = save("categories", { name: v.name, emoji: v.emoji || "🏦", kind: "saasto", order: cats().length * 10 + 10 });
        data.cat = cid;
      }
      // Saldo asetetaan uudelleen vain, jos se muuttui
      if (!a || round2(cur) !== round2(v.balance)) Object.assign(data, { balance: v.balance, balanceDate: today(), balanceAt: nowIso(), entries: [], checkedAt: nowIso() });
      else delete data.balance;
      save("accounts", data, a?.id);
      toast(a ? "Tallennettu" : `${v.name} lisätty`);
    },
    onDelete: a ? () => confirmDel(`Poistetaanko tili "${a.name}"? Kirjaukset säilyvät, mutta tilin saldoa ei enää seurata.`, "accounts", a) : null
  });
}
// Saldon tarkistus: pankin saldo vs. Kukkaron laskema
export function checkSheet(id) {
  const a = findIn("accounts", id); if (!a) return;
  const calc = accBalance(a);
  const close = openSheet("Tarkista saldo: " + a.name, `<p>Kukkaron laskema saldo: <b>${eur(calc)}</b></p>
    <label class="fld fld-big"><span>Paljonko pankki näyttää nyt?</span><span class="money"><input id="bank-bal" type="text" inputmode="decimal" placeholder="0,00" data-money="1"><i>€</i></span></label>
    <div id="check-res"></div>`, () => false);
  const inp = $("#bank-bal"), res = $("#check-res");
  setTimeout(() => inp.focus(), 60);
  const draw = () => {
    if (!inp.value.trim()) { res.innerHTML = ""; return; }
    const diff = round2(num(inp.value) - calc);
    res.innerHTML = Math.abs(diff) < 0.005
      ? `<div class="done-msg">✓ Täsmää! Kaikki on kirjattu.</div><div class="sheet-btns"><button class="btn primary block" data-chk="ok">Valmis</button></div>`
      : `<p class="${diff < 0 ? "bad" : "ok"}"><b>Ero ${eur(diff, true)}</b> – ${diff < 0 ? "tililtä on lähtenyt enemmän kuin Kukkaroon on kirjattu." : "tilillä on enemmän kuin Kukkaro laskee."}</p>
        <div class="sheet-btns">
          ${diff < 0 && a.type === "kaytto" ? `<button class="btn primary block" data-chk="add">Kirjaa puuttuva meno (${eur(-diff)})</button>` : ""}
          ${diff > 0 && a.type !== "kaytto" ? `<button class="btn primary block" data-chk="korko">Kirjaa korkona / tuottona (${eur(diff)})</button>` : ""}
          <button class="btn block" data-chk="tasaus">Tasaa saldo (kirjataan "Saldon tasaus")</button>
        </div><p class="form-note">Tasaus korjaa vain tilin saldon. Se ei vaikuta palkkakauden laskelmiin eikä tilastoihin.</p>`;
  };
  inp.addEventListener("input", draw);
  res.addEventListener("click", e => {
    const b = e.target.closest("[data-chk]"); if (!b) return;
    const diff = round2(num(inp.value) - calc), k = b.dataset.chk;
    if (k === "add") { close(); setTimeout(() => txForm({ amount: -diff, kind: "meno", date: today() }), 30); return; }
    if (k === "tasaus" || k === "korko") addEntry(a, { type: k, amount: diff });
    patch("accounts", a.id, { checkedAt: nowIso() });
    close(); toast(k === "ok" ? "Saldo täsmää ✓" : "Saldo päivitetty");
  });
}
function addEntry(a, e) {
  const entry = { date: today(), at: nowIso(), note: "", ...e };
  patch("accounts", a.id, { entries: [...(a.entries || []), entry] });
}
// Korko, talletus tai nosto säästötililtä
export function entryForm(id, type) {
  const a = findIn("accounts", id); if (!a) return;
  const main = mainAcc();
  openForm({
    title: `${ENTRY_TYPES[type]}: ${a.name}`,
    fields: [
      { name: "amount", label: "Summa (€)", type: "number", required: true, big: true, autofocus: true },
      { name: "date", label: "Päivä", type: "date", def: today, required: true },
      { name: "note", label: "Selite", placeholder: type === "korko" ? "esim. Vuoden korko, ASP-korkotuki" : "" },
      ...(type === "nosto" && main ? [{ name: "toMain", label: `Siirto ${main.name}lle`, type: "checkbox", def: true }, { name: "asIncome", label: "Lisää tämän palkkakauden käytettävään rahaan", type: "checkbox", def: false, hint: "Päällä: nosto näkyy palkkakauden tulona (Muu tulo). Pois: vain tilien saldot muuttuvat." }] : [])
    ],
    onSubmit: v => {
      if (!v.amount || v.amount <= 0) { alert("Anna summa."); return false; }
      const amt = type === "nosto" ? -v.amount : v.amount;
      const e = { type, amount: amt, date: v.date, note: v.note, at: nowIso() };
      if (type === "nosto" && v.toMain) {
        e.toMain = true;
        if (v.asIncome) e.txId = save("tx", { date: v.date, amount: v.amount, kind: "tulo", cat: cats("tulo").find(c => c.id === "muutulo")?.id || cats("tulo")[0]?.id || "", note: `Nosto: ${a.name}` });
      }
      patch("accounts", a.id, { entries: [...(a.entries || []), e] });
      toast(`${ENTRY_TYPES[type]} kirjattu`);
    }
  });
}
export function accSheet(id) {
  const a = findIn("accounts", id); if (!a) return;
  const mv = accMovements(a);
  openSheet(`${a.emoji || ""} ${a.name}`, `<div class="occ-head"><div class="huge">${eur(accBalance(a))}</div><div class="muted small">${a.checkedAt ? "Tarkistettu " + fmtDate(a.checkedAt.slice(0, 10)) : ""}</div></div>
    <div class="sheet-btns two">
      <button class="btn primary" data-sheet="check">Tarkista saldo</button>
      ${a.type !== "kaytto" ? `<button class="btn" data-sheet="korko">+ Korko</button><button class="btn" data-sheet="talletus">+ Talletus</button><button class="btn" data-sheet="nosto">− Nosto</button>` : ""}
      <button class="btn ghost" data-sheet="edit">Muokkaa</button>
    </div>
    <h3 class="form-h">Viimeisimmät</h3>
    ${mv.length ? `<div class="txlist">${mv.map(r => r.entry ? `<div class="txrow"><div class="txrow-main" data-sheet="entry:${esc(r.entry.at)}"><span class="cat-dot" style="--cc:#888">${r.entry.type === "korko" ? "📈" : r.entry.type === "nosto" ? "↩" : r.entry.type === "tasaus" ? "⚖️" : "➕"}</span><div class="tx-t"><div class="tx-title">${esc(r.note)}</div><div class="tx-sub">${fmtShort(r.date)}</div></div><span class="amt-v ${r.entry.amount >= 0 ? "pos" : "neg"}">${eur(r.entry.amount, true)}</span></div></div>` : rowHtml(r)).join("")}</div>` : '<p class="muted small">Ei tapahtumia saldon asettamisen jälkeen.</p>'}`, k => {
    if (k === "check") { setTimeout(() => checkSheet(a.id), 30); return; }
    if (k === "edit") { setTimeout(() => accForm(a.id), 30); return; }
    if (ENTRY_TYPES[k]) { setTimeout(() => entryForm(a.id, k), 30); return; }
    if (k.startsWith("entry:")) {
      const at = k.slice(6), e = (a.entries || []).find(x => x.at === at); if (!e) return false;
      if (!confirm(`Poistetaanko kirjaus "${ENTRY_TYPES[e.type]} ${eur(e.amount, true)}"?`)) return false;
      if (e.txId) remove("tx", e.txId);
      patch("accounts", a.id, { entries: (a.entries || []).filter(x => x.at !== at) });
      toast("Kirjaus poistettu");
    }
  });
}
// Vanhat säästötavoitteet → säästötilit (kerran)
let migrating = false;
export function migrateGoals() {
  if (migrating || !S.d.goals || !S.d.accounts || !list("goals").length) return;
  migrating = true;
  const b = writeBatch(db);
  for (const g of list("goals")) {
    b.set(doc(collection(db, "accounts")), { type: "saasto", name: g.name, emoji: g.emoji || "🏦", cat: g.cat || "", target: g.target || null, deadline: g.deadline || null,
      balance: Number(g.base) || 0, balanceDate: g.baseDate || today(), balanceAt: g.baseDate ? g.baseDate + "T23:59:59Z" : nowIso(), entries: [], createdAt: nowIso() });
    b.delete(doc(db, "goals", g.id));
  }
  b.commit().then(() => { migrating = false; toast("Säästötavoitteet siirretty säästötileiksi"); }).catch(e => { migrating = false; fail(e); });
}
Object.assign(ACTIONS, {
  accNew: d => accForm(null, d.type || "saasto"),
  accOpen: d => accSheet(d.id),
  accCheck: d => checkSheet(d.id),
  accSetup: () => accForm(null, "kaytto")
});
