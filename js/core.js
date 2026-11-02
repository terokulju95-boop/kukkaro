// =============================================================
//  Kukkaro – oma tulo- ja menoseuranta palkkajaksoittain
//  Pelkkä HTML/JS + Firebase (Auth + Firestore, offline-tuki)
// =============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc, getDocs, writeBatch, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, LOGIN_EMAIL, APP_NAME } from "../firebase-config.js";
import { Periods, mergeSettings, parseYmd, pad, ymd, today, daysBetween, addDays, addMonths } from "./money.js";
export { parseYmd, pad, ymd, today, daysBetween, addDays, addMonths };

// ---------- Firebase ----------
export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export let db;
try {
  db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  console.warn("Offline-välimuisti ei käytössä", e);
  db = getFirestore(fbApp);
}

// ---------- Vakiot ----------
export const COLS = ["tx", "recurring", "categories", "goals", "periods", "accounts"];
export const SETTINGS_DOC = () => doc(db, "app", "settings");
export const KINDS = { meno: ["Meno", "−"], tulo: ["Tulo", "+"], saasto: ["Säästö", "→"] };

export const ICONS = {
  koti: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  jakso: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
  toistuvat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  tilastot: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  kategoriat: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tilit: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  lisaa: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
// Osiot, joita voi sijoittaa alavalikkoon: [avain, lyhyt nimi, emoji, nimi Lisää-valikossa, kuvaus]
export const SECTIONS = [
  ["jakso", "Jakso", "📅", "Jakson tapahtumat", "Kaikki tulot ja menot palkkajaksoittain"],
  ["toistuvat", "Toistuvat", "🔁", "Toistuvat", "Netflix, puhelinlasku, ASP – kirjautuvat itsestään"],
  ["tilastot", "Tilastot", "📊", "Tilastot", "Jaksot, kategoriat ja ennuste"],
  ["kategoriat", "Kategoriat", "🏷️", "Kategoriat ja budjetit", "Ruoka, tilaukset, liikenne…"],
  ["tilit", "Tilit", "🏦", "Tilit ja säästöt", "Käyttötilin saldo, ASP-tili ja muut säästötilit"]
];
export const NAV = [["koti", "Koti"], ...SECTIONS.map(x => [x[0], x[1]]), ["lisaa", "Lisää"]];
export const NAV_MAX = 5;
export const DEFAULT_NAV_ITEMS = ["jakso", "toistuvat", "tilastot"];
export const MONTHS = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"];
export const PALETTE = ["#2f7d5b", "#b8622f", "#3e6db5", "#9b4f96", "#b0892a", "#c0473f", "#2b8a8a", "#6b6b2f", "#5a6fa8", "#a0522d", "#4f8a3a", "#8a3f6a"];

// Oletuskategoriat: [id, nimi, emoji, laji]
export const DEFAULT_CATS = [
  ["ruoka", "Ruoka ja kauppa", "🛒", "meno"], ["ravintola", "Ravintolat ja kahvilat", "☕", "meno"],
  ["liikenne", "Liikenne ja polttoaine", "⛽", "meno"], ["asuminen", "Asuminen", "🏠", "meno"],
  ["laskut", "Laskut ja maksut", "📄", "meno"], ["tilaukset", "Tilaukset", "📺", "meno"],
  ["terveys", "Terveys", "💊", "meno"], ["vaatteet", "Vaatteet", "👕", "meno"],
  ["harrastus", "Harrastukset ja viihde", "🎬", "meno"], ["koti", "Kodin tavarat", "🧺", "meno"],
  ["lahjat", "Lahjat", "🎁", "meno"], ["muu", "Muu meno", "📦", "meno"],
  ["palkka", "Palkka", "💶", "tulo"], ["muutulo", "Muu tulo", "➕", "tulo"],
  ["asp", "ASP-tili", "🏡", "saasto"], ["saastot", "Säästöt", "🐷", "saasto"]
];
// Ehdotetut toistuvat (summa täytetään itse): [nimi, kategoria, laji, rytmi, pankkipäiväsiirto]
// Suoratoistot veloitetaan yleensä kortilta samana päivänä, laskut ja tilisiirrot seuraavana pankkipäivänä.
export const SUGGESTED_RECURRING = [
  ["Netflix", "tilaukset", "meno", "kk", "ei"], ["Rakennusliitto, jäsenmaksu", "laskut", "meno", "kk", "seur"],
  ["Puhelinlasku", "laskut", "meno", "kk", "seur"], ["Finnkino+", "tilaukset", "meno", "kk", "ei"],
  ["Storytel", "tilaukset", "meno", "kk", "ei"], ["ASP-tili", "asp", "saasto", "kk", "seur"]
];

// ---------- Tila ----------
export const S = {
  user: null, d: {}, settings: null, view: "koti", tab: {}, unsubs: [], started: false,
  openDetails: new Set(), pOffset: 0, catFilter: null, search: "",
  theme: null, themeDraft: null, themePal: "light", themeMeta: null, homeEdit: false
};

// ---------- Apurit ----------
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const nl2br = s => esc(s).replace(/\n/g, "<br>");
export const nowIso = () => new Date().toISOString();
const WD = ["su", "ma", "ti", "ke", "to", "pe", "la"];
export const fmtDate = s => { if (!s) return ""; const d = parseYmd(s); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
export const fmtShort = s => { if (!s) return ""; const d = parseYmd(s); return `${d.getDate()}.${d.getMonth() + 1}.`; };
export const fmtWd = s => s ? `${WD[parseYmd(s).getDay()]} ${fmtShort(s)}` : "";
export const fmtDateLong = s => s ? `${WD[parseYmd(s).getDay()]} ${fmtDate(s)}` : "";
export const fmtDT = iso => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} klo ${d.getHours()}.${pad(d.getMinutes())}`; };
export const fmtRange = (a, b) => `${fmtShort(a)}–${fmtShort(b)}${parseYmd(b).getFullYear() !== new Date().getFullYear() ? parseYmd(b).getFullYear() : ""}`;
// Rahasummat. Ulkoasu-asetus "Näytä sentit" (oletuksena päällä).
export const centsOn = { v: true };
export const eur = (n, sign = false) => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString("fi-FI", { minimumFractionDigits: centsOn.v ? 2 : 0, maximumFractionDigits: centsOn.v ? 2 : 0 }) + " €";
  return (v < 0 ? "−" : sign && v > 0 ? "+" : "") + s;
};
export const money = (n, cls = "", sign = false) => `<span class="amt-v ${cls}">${eur(n, sign)}</span>`;
export const fmtNum = n => Number(n || 0).toLocaleString("fi-FI", { maximumFractionDigits: 2 });
export const fmtMoney = v => (Number(v) || 0).toLocaleString("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = v => { const n = parseFloat(String(v ?? "").replace(/\s| |€/g, "").replace("−", "-").replace(",", ".")); return isFinite(n) ? n : 0; };
export const list = c => S.d[c] || [];
export const curTab = (view, def) => S.tab[view] || def;
export const findIn = (col, id) => list(col).find(x => x.id === id);
export function colorFor(name) { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
export function clean(o) { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = v === undefined ? null : v; return r; }
export function ago(s) {
  if (!s) return "";
  const d = daysBetween(s, today());
  if (d === 0) return "tänään"; if (d === 1) return "eilen"; if (d === -1) return "huomenna";
  if (d < 0) return `${-d} pv päästä`;
  if (d < 60) return `${d} pv sitten`;
  return `${Math.round(d / 30.44)} kk sitten`;
}

// ---------- Asetukset, jaksot ja kategoriat ----------
export const settings = () => S.settings || mergeSettings({});
let pCache = null, pKey = "";
export function periods() {
  const k = JSON.stringify([settings(), list("periods")]);
  if (k !== pKey) { pKey = k; pCache = new Periods(settings(), Object.fromEntries(list("periods").map(p => [p.id, p]))); }
  return pCache;
}
export const cats = (kind) => list("categories").filter(c => !kind || (c.kind || "meno") === kind).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name || "").localeCompare(b.name || "", "fi"));
export const cat = id => findIn("categories", id) || (id === "palkka" ? { id, name: settings().salaryName, emoji: "💶", kind: "tulo" } : { id, name: id ? "Poistettu kategoria" : "Ei kategoriaa", emoji: "•", kind: "meno" });
export const catColor = c => c.color || colorFor(c.id + c.name);

// ---------- Tallennus (ei odoteta palvelinta → toimii offline) ----------
export function fail(e) { console.error(e); toast("Tallennus epäonnistui: " + (e.code || e.message), true); }
export function save(col, data, id) {
  const ref = id ? doc(db, col, id) : doc(collection(db, col));
  const payload = id ? { ...clean(data), updatedAt: nowIso() } : { ...clean(data), createdAt: nowIso() };
  (id ? setDoc(ref, payload, { merge: true }) : setDoc(ref, payload)).catch(fail);
  return ref.id;
}
export function patch(col, id, data) { updateDoc(doc(db, col, id), data).catch(fail); }
export function remove(col, id) { deleteDoc(doc(db, col, id)).catch(fail); }
export function saveSettings(data) {
  S.settings = mergeSettings({ ...settings(), ...data });
  S.dataVer = (S.dataVer || 0) + 1;
  setDoc(SETTINGS_DOC(), { ...S.settings, updatedAt: nowIso() }, { merge: true }).catch(fail);
}

// ---------- Toast ----------
let toastTimer;
export function toast(msg, isErr = false, undo = null) {
  const t = $("#toast");
  t.innerHTML = esc(msg) + (undo ? ` <button class="toast-undo" type="button">Kumoa</button>` : "");
  t.className = "toast show" + (isErr ? " err" : "");
  if (undo) t.querySelector(".toast-undo").onclick = () => { undo(); t.className = "toast"; };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = "toast", undo ? 5000 : isErr ? 5000 : 2500);
}

// ---------- Lomake-ikkuna ----------
export function fieldHtml(f, v) {
  const req = f.required ? "required" : "";
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : "";
  const hint = f.hint ? `<small class="muted">${esc(f.hint)}</small>` : "";
  switch (f.type) {
    case "heading": return `<h3 class="form-h">${esc(f.label)}</h3>`;
    case "note": return `<p class="form-note">${esc(f.label)}</p>`;
    case "textarea": return `<label class="fld"><span>${esc(f.label)}</span><textarea name="${f.name}" rows="${f.rows || 3}" ${req} ${ph}>${esc(v ?? "")}</textarea>${hint}</label>`;
    case "select": {
      const opts = (typeof f.options === "function" ? f.options() : f.options).map(o => Array.isArray(o) ? o : [o, o]);
      return `<label class="fld"><span>${esc(f.label)}</span><select name="${f.name}" ${req}>${opts.map(([val, l]) => `<option value="${esc(val)}" ${String(v ?? "") === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${hint}</label>`;
    }
    case "checkbox": return `<label class="fld-check"><input type="checkbox" name="${f.name}" ${v ? "checked" : ""}><span>${esc(f.label)}${f.hint ? `<small class="muted block">${esc(f.hint)}</small>` : ""}</span></label>`;
    case "segment": {
      const opts = typeof f.options === "function" ? f.options() : f.options;
      return `<div class="fld"><span>${esc(f.label)}</span><div class="seg" data-segfield="${f.name}">${opts.map(([val, l]) => `<button type="button" data-val="${esc(val)}" class="${String(v) === String(val) ? "on" : ""}">${esc(l)}</button>`).join("")}</div><input type="hidden" name="${f.name}" value="${esc(v ?? "")}">${hint}</div>`;
    }
    case "catpick": return `<div class="fld"><span>${esc(f.label)}</span><div class="catpick" data-catpick="${f.name}" data-kindfrom="${f.kindFrom || ""}"></div><input type="hidden" name="${f.name}" value="${esc(v ?? "")}"></div>`;
    case "number": {
      const isMoney = f.money || /€/.test(f.label);
      const empty = v === null || v === undefined || v === "";
      const val = empty ? "" : isMoney ? fmtMoney(v) : esc(String(v).replace(".", ","));
      const input = `<input name="${f.name}" type="text" inputmode="decimal" value="${val}" ${req} ${f.autofocus ? "autofocus" : ""} ${isMoney ? 'data-money="1" placeholder="0,00"' : ph}>`;
      return `<label class="fld ${f.big ? "fld-big" : ""}"><span>${esc(isMoney ? f.label.replace(/\s*\(€\)/, "") : f.label)}</span>${isMoney ? `<span class="money">${input}<i>€</i></span>` : input}${hint}</label>`;
    }
    case "date": return `<label class="fld"><span>${esc(f.label)}</span>${dateInput(f.name, v, req)}${hint}</label>`;
    default: {
      const listId = f.list ? `dl_${f.name}` : "";
      return `<label class="fld"><span>${esc(f.label)}</span><input name="${f.name}" type="${f.type || "text"}" value="${esc(v ?? "")}" ${req} ${ph} ${f.list ? `list="${listId}"` : ""} ${f.max ? `maxlength="${f.max}"` : ""} autocomplete="off">${f.list ? `<datalist id="${listId}">${(typeof f.list === "function" ? f.list() : f.list).map(o => `<option value="${esc(o)}">`).join("")}</datalist>` : ""}${hint}</label>`;
    }
  }
}

function drawCatPick(box, kind, val) {
  const all = cats(kind);
  box.innerHTML = all.map(c => `<button type="button" class="catbtn ${c.id === val ? "on" : ""}" data-cid="${esc(c.id)}" style="--cc:${catColor(c)}"><span>${esc(c.emoji || "•")}</span><small>${esc(c.name)}</small></button>`).join("")
    || `<p class="form-note">Ei kategorioita tälle lajille. Lisää niitä kohdassa Kategoriat.</p>`;
}

export function openForm({ title, fields, values = {}, onSubmit, onDelete, submitLabel = "Tallenna", extraHtml = "", topHtml = "", deleteLabel = "Poista" }) {
  const m = $("#modal");
  const initial = f => values[f.name] !== undefined && values[f.name] !== null ? values[f.name] : (typeof f.def === "function" ? f.def() : f.def);
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-mclose aria-label="Sulje">✕</button></div>
    <form class="form">${topHtml}${fields.map(f => fieldHtml(f, initial(f))).join("")}${extraHtml}
      <div class="form-actions">${onDelete ? `<button type="button" class="btn danger ghost" data-mdel>${esc(deleteLabel)}</button>` : "<span></span>"}<button type="submit" class="btn primary">${esc(submitLabel)}</button></div>
    </form></div>`;
  const form = m.querySelector("form");
  // Segmenttivalinnat ja kategoriapainikkeet
  const refreshCats = () => form.querySelectorAll("[data-catpick]").forEach(box => {
    const inp = form.elements[box.dataset.catpick];
    const kind = box.dataset.kindfrom ? form.elements[box.dataset.kindfrom].value : null;
    const valid = cats(kind).some(c => c.id === inp.value);
    if (!valid) inp.value = cats(kind)[0]?.id || "";
    drawCatPick(box, kind, inp.value);
  });
  form.addEventListener("click", e => {
    const sb = e.target.closest("[data-segfield] button");
    if (sb) { const box = sb.parentElement; form.elements[box.dataset.segfield].value = sb.dataset.val; box.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === sb)); refreshCats(); form.dispatchEvent(new Event("segchange")); return; }
    const cb = e.target.closest(".catbtn");
    if (cb) { const box = cb.parentElement; form.elements[box.dataset.catpick].value = cb.dataset.cid; box.querySelectorAll(".catbtn").forEach(b => b.classList.toggle("on", b === cb)); }
  });
  refreshCats();
  const close = () => { m.classList.remove("open"); m.innerHTML = ""; m.onclick = null; document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  m.onclick = e => {
    if (e.target === m || e.target.closest("[data-mclose]")) return close();
    if (e.target.closest("[data-mdel]")) { if (onDelete() === false) return; close(); }
  };
  form.onsubmit = e => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === "heading" || f.type === "note") continue;
      const el = form.elements[f.name];
      if (f.type === "checkbox") out[f.name] = el.checked;
      else if (f.type === "number") out[f.name] = el.value.trim() === "" ? null : num(el.value);
      else out[f.name] = el.value.trim();
    }
    if (onSubmit(out, form) === false) return;
    close();
  };
  m.classList.add("open");
  m.scrollTop = 0;
  const af = form.querySelector("[autofocus]"); if (af) setTimeout(() => af.focus(), 60);
  return form;
}

export function openSheet(title, html, onClick) {
  const m = $("#modal");
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-mclose aria-label="Sulje">✕</button></div><div class="sheet-body">${html}</div></div>`;
  m.classList.add("open");
  const close = () => { m.classList.remove("open"); m.innerHTML = ""; m.onclick = null; };
  m.onclick = e => {
    if (e.target === m || e.target.closest("[data-mclose]")) return close();
    const b = e.target.closest("[data-sheet]");
    if (b && onClick) { if (onClick(b.dataset.sheet, b) !== false) close(); }
  };
  return close;
}
export const closeModal = () => { const m = $("#modal"); m.classList.remove("open"); m.innerHTML = ""; m.onclick = null; };

// ---------- Yleiset palaset ----------
export const seg = (view, tabs, def) => {
  const cur = curTab(view, def ?? tabs[0][0]);
  return `<div class="seg" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-action="tab" data-view="${view}" data-tab="${k}" class="${k === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
};
export const empty = t => `<div class="empty">${t}</div>`;
export const secH = (t, extra = "") => `<div class="sec-h"><h2>${t}</h2>${extra}</div>`;
export const details = (id, summary, inner) => `<details id="${id}" class="more" ${S.openDetails.has(id) ? "open" : ""}><summary>${summary}</summary>${inner}</details>`;
export const chip = (t, cls = "") => `<span class="chip ${cls}">${t}</span>`;
export const bar = (pct, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

// Rahakenttä muotoillaan, kun siitä poistutaan: "1250" → "1 250,00"
document.addEventListener("focusout", e => {
  const el = e.target;
  if (!el?.dataset?.money || !el.value.trim()) return;
  el.value = fmtMoney(num(el.value));
});

// ---------- Päivämääräkenttä suomalaisella näytöllä ----------
export function dateInput(name, v, req = "") {
  return `<span class="datefld"><input name="${name}" type="date" value="${esc(v || "")}" ${req}><span class="date-show ${v ? "" : "empty"}">${v ? fmtDateLong(v) : "Valitse päivä"}</span></span>`;
}
function syncDateShow(inp) {
  const show = inp.parentElement?.querySelector(".date-show"); if (!show) return;
  show.textContent = inp.value ? fmtDateLong(inp.value) : "Valitse päivä";
  show.classList.toggle("empty", !inp.value);
}
document.addEventListener("input", e => { if (e.target.type === "date") syncDateShow(e.target); });
document.addEventListener("change", e => { if (e.target.type === "date") syncDateShow(e.target); });

export { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc, getDocs, writeBatch, deleteField, LOGIN_EMAIL, APP_NAME };
