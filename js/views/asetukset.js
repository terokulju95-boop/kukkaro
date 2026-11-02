// =============================================================
//  Lisää-valikko, asetukset, ulkoasu, yksityisyys, ylläpito, tili, aloitus
// =============================================================
import { $, APP_NAME, ICONS, NAV_MAX, S, SECTIONS, SETTINGS_DOC, chip, collection, db, doc, esc, eur, fmtDT, fmtDate, fmtDateLong, fmtNum, list, num, periods, saveSettings, secH, setDoc, settings, toast, today, writeBatch, nowIso, getDoc, fail } from "../core.js";
import { COLOR_FIELDS, DARK_STYLES, DEFAULT_THEME, DENSITY, FEATURES, FONTS, HEAD_WEIGHTS, SETTINGS_PAGES, SHADOWS, T, THEME_PRESETS, backLink, contrast, previewTheme, themeDirty } from "../theme.js";
import { versionsSection, iconSection, loadThemeVersions } from "./teemat.js";
import { render, renderNav } from "../main.js";
import { mergeSettings, Periods, holidayName } from "../money.js";
import { lockCfg, AFTER_OPTS, setLockAfter } from "../lock.js";
import { seedCategories, seedRecurring } from "../actions.js";
import { curIndex } from "../calc.js";

const PAGE_INFO = () => {
  const lc = lockCfg();
  return {
    rahaasetukset: ["💶", "Palkka ja jaksot", `${eur(settings().salary)} · ${settings().cycle} pv jakso`],
    ulkoasu: ["🎨", "Ulkoasu ja ominaisuudet", "Teemat, värit, fontit, valikot, etusivu"],
    yksityisyys: ["🔒", "Lukitus ja yksityisyys", lc ? "PIN-lukko käytössä" : "PIN-lukko ei käytössä"],
    yllapito: ["🗄️", "Varmuuskopio ja tiedot", S.lastBackupAt ? "Viimeisin varmuuskopio " + fmtDT(S.lastBackupAt) : "Vie tiedot JSON- tai CSV-tiedostoon"],
    tili: ["👤", "Tili", S.user?.email || ""]
  };
};

// ---------- Lisää ----------
export function vLisaa() {
  const th = T(), inNav = th.navItems;
  const info = { ...Object.fromEntries(SECTIONS.map(([k, , ic, t, d]) => [k, [ic, t, d]])), asetukset: ["⚙️", "Asetukset", "Palkka, jaksot, ulkoasu, lukitus, varmuuskopio"] };
  const keys = th.menu.order.filter(k => info[k] && !inNav.includes(k));
  const groups = [];
  keys.forEach(k => { const g = th.menu.groups[k] || ""; if (!groups.length || groups.at(-1).g !== g) groups.push({ g, keys: [] }); groups.at(-1).keys.push(k); });
  const item = k => { const [ic, t, d] = info[k]; return `<a class="menu-item" href="#${k}"><span class="menu-ic">${ic}</span><span class="menu-t"><b>${esc(t)}</b><small>${esc(d)}</small></span><span class="chev">›</span></a>`; };
  return groups.map(({ g, keys }) => `${g ? `<div class="menu-group">${esc(g)}</div>` : ""}<div class="menu">${keys.map(item).join("")}</div>`).join("");
}
export function vAsetukset() {
  const info = PAGE_INFO();
  return `<a class="back" href="#lisaa">‹ Lisää</a><div class="menu">${SETTINGS_PAGES.map(k => { const [ic, t, d] = info[k]; return `<a class="menu-item" href="#${k}"><span class="menu-ic">${ic}</span><span class="menu-t"><b>${esc(t)}</b><small>${esc(d)}</small></span><span class="chev">›</span></a>`; }).join("")}</div>`;
}

// ---------- Palkka ja jaksot ----------
const cb = (name, label, v, hint) => `<label class="fld-check"><input type="checkbox" name="${name}" ${v ? "checked" : ""}><span>${esc(label)}${hint ? `<small class="muted block">${esc(hint)}</small>` : ""}</span></label>`;
const moneyFld = (name, label, v, hint = "") => `<label class="fld"><span>${esc(label)}</span><span class="money"><input name="${name}" type="text" inputmode="decimal" data-money="1" value="${(Number(v) || 0).toLocaleString("fi-FI", { minimumFractionDigits: 2 })}"><i>€</i></span>${hint ? `<small class="muted">${esc(hint)}</small>` : ""}</label>`;
const dateFld = (name, label, v, hint = "") => `<label class="fld"><span>${esc(label)}</span><span class="datefld"><input name="${name}" type="date" value="${esc(v)}" required><span class="date-show">${fmtDateLong(v)}</span></span>${hint ? `<small class="muted">${esc(hint)}</small>` : ""}</label>`;
export function vRahaAsetukset() {
  const st = settings(), P = periods(), n0 = curIndex();
  const nextPays = []; for (let n = n0; n < n0 + 7; n++) nextPays.push(P.get(n));
  return backLink() + `<form class="card form" data-form="settings">
    <div class="card-label">Palkka</div>
    ${moneyFld("salary", "Nettopalkka jaksossa", st.salary, "Oletus jokaiselle jaksolle. Yksittäisen jakson palkkaa voi muuttaa Jakso-sivulta (⋯).")}
    <label class="fld"><span>Palkan nimi</span><input name="salaryName" value="${esc(st.salaryName)}" maxlength="40"></label>
    ${dateFld("payday", "Palkkapäivä", P.get(n0 + 1).key, "Mikä tahansa tiedossa oleva palkkapäivä. Muut lasketaan siitä jakson pituuden välein.")}
    <label class="fld"><span>Jakson pituus</span><select name="cycle">${[[28, "4 viikkoa (28 pv)"], [14, "2 viikkoa (14 pv)"], [7, "Viikko (7 pv)"]].map(([v, l]) => `<option value="${v}" ${v === st.cycle ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    ${cb("holidayShift", "Siirrä palkkapäivä pyhien ja viikonlopun yli", st.holidayShift, "Jos palkkapäivä osuu lauantaille, sunnuntaille tai pankkipyhälle, jakso alkaa edellisenä pankkipäivänä.")}
    <div class="card-label">Laskenta</div>
    ${cb("forecast", "Vähennä tulossa olevat toistuvat jo nyt", st.forecast, "Päällä: \"Jäljellä\" kertoo, paljonko rahaa on vapaasti käytettävissä, kun jakson loput laskut on maksettu.")}
    ${cb("carry", "Siirrä ylijäämä (tai alijäämä) seuraavalle jaksolle", st.carry, "Edellisen jakson jäljelle jäänyt raha lisätään seuraavan jakson tuloihin. Siirto alkaa jaksosta, jolloin otat asetuksen käyttöön.")}
    ${moneyFld("lowPerDay", "Varoitusraja: €/päivä", st.lowPerDay, "Päivässä-kortti muuttuu keltaiseksi, kun käytettävissä on tätä vähemmän.")}
    <button class="btn primary block">Tallenna</button>
  </form>
  <div class="card"><div class="card-label">Seuraavat palkkapäivät</div>${nextPays.map(p => `<div class="line"><span>${fmtDateLong(p.start)}${p.n === n0 ? ' <span class="muted">(nykyinen jakso)</span>' : ""}</span><span class="muted small">${p.moved ? "siirretty" : p.shifted ? (holidayName(p.key) || "viikonloppu") + " → aiemmin" : ""}</span></div>`).join("")}</div>`;
}

// ---------- Ulkoasu ----------
export const tPath = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
export function tSet(o, path, v) {
  const ks = path.split("."); const last = ks.pop(); let a = o;
  for (const k of ks) a = (a[k] ??= {});
  if (path.startsWith("home.") && (v === "" || v === false)) delete a[last]; else a[last] = v;
}
export const tId = p => "tk-" + p.replace(/\./g, "-");
export const tColor = (p, label) => {
  const v = tPath(S.themeDraft, p), pal = p.split(".")[0], key = p.split(".").pop();
  const others = COLOR_FIELDS.filter(([k]) => k !== key);
  return `<div class="t-row t-colorrow"><label for="${tId(p)}-hex">${esc(label)}</label><span class="t-color">
    <input type="color" id="${tId(p)}" data-tk="${p}" value="${esc(v)}" aria-label="${esc(label)}: valitse väri">
    <input class="t-hex" id="${tId(p)}-hex" data-hex="${p}" data-tv="${p}" value="${esc(v)}" maxlength="25" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="#000000" aria-label="${esc(label)}: värikoodi">
    <select class="t-same" data-same="${p}" aria-label="${esc(label)}: käytä samaa väriä kuin"><option value="">Sama kuin…</option>${others.map(([k, l]) => `<option value="${pal}.${k}">${esc(l)}</option>`).join("")}</select>
  </span></div>`;
};
export function parseColor(s) {
  s = String(s || "").trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) { const h = m[1]; return "#" + (h.length === 3 ? [...h].map(c => c + c).join("") : h); }
  m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m && m.slice(1, 4).every(n => Number(n) <= 255)) return "#" + m.slice(1, 4).map(n => Number(n).toString(16).padStart(2, "0")).join("");
  return null;
}
function applyColor(p, hex) { const el = document.getElementById(tId(p)); if (!el) return; el.value = hex; onThemeInput({ target: el }); }
document.addEventListener("input", e => {
  const h = e.target?.dataset?.hex; if (!h) return;
  const c = parseColor(e.target.value);
  e.target.classList.toggle("bad", !c && e.target.value.trim() !== "");
  if (c) applyColor(h, c);
});
document.addEventListener("focusout", e => { const h = e.target?.dataset?.hex; if (!h || !S.themeDraft) return; e.target.value = tPath(S.themeDraft, h); e.target.classList.remove("bad"); });
document.addEventListener("focusin", e => { if (e.target?.dataset?.hex) e.target.select(); });
document.addEventListener("change", e => { const p = e.target?.dataset?.same; if (!p || !e.target.value || !S.themeDraft) return; applyColor(p, tPath(S.themeDraft, e.target.value)); e.target.value = ""; });
export const tRange = (p, label, min, max, step, unit = "") => { const v = tPath(S.themeDraft, p); return `<label class="t-row t-range"><span>${esc(label)} <b data-tv="${p}" data-unit="${unit}">${fmtNum(v)}${unit}</b></span><input type="range" id="${tId(p)}" data-tk="${p}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`; };
export const tSelect = (p, label, opts, isNum = false) => { const v = tPath(S.themeDraft, p); return `<label class="fld"><span>${esc(label)}</span><select id="${tId(p)}" data-tk="${p}" ${isNum ? 'data-num="1"' : ""}>${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`; };
export const tCheck = (p, label) => { const v = tPath(S.themeDraft, p); return `<label class="fld-check"><input type="checkbox" id="${tId(p)}" data-tk="${p}" ${v ? "checked" : ""}><span>${esc(label)}</span></label>`; };
export const tText = (p, label, ph = "", rows = 0) => { const v = tPath(S.themeDraft, p) ?? ""; return `<label class="fld"><span>${esc(label)}</span>${rows ? `<textarea id="${tId(p)}" data-tk="${p}" rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea>` : `<input id="${tId(p)}" data-tk="${p}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off">`}</label>`; };
export function contrastHtml(p) {
  const pairs = [["ink", "bg", "Teksti / tausta", 4.5], ["ink", "card", "Teksti / kortti", 4.5], ["head", "card", "Otsikot / kortti", 3],
    ["muted", "card", "Himmeä teksti / kortti", 3], ["label", "card", "Pienet otsikot / kortti", 3], ["primary", "card", "Pääväri / kortti", 3], ["ok", "card", "Tulot / kortti", 3], ["bad", "card", "Miinus / kortti", 3]];
  const bad = pairs.map(([a, b, l, min]) => [l, contrast(p[a], p[b]), min]).filter(([, c, min]) => c < min);
  return bad.length ? `<div class="t-warn">⚠️ Huono luettavuus: ${bad.map(([l, c]) => `${esc(l)} (${c.toFixed(1).replace(".", ",")}:1)`).join(", ")}. Valitse kontrastisempi väri.</div>` : `<div class="form-note ok">✓ Värit ovat hyvin luettavissa.</div>`;
}
export function saveBarState() { const d = themeDirty(); return [d, d ? "Tallentamattomia muutoksia – näkyvät esikatseluna" : "Ei tallentamattomia muutoksia"]; }
export function updateSaveBar() {
  const bar = $("#t-savebar"); if (!bar) return;
  const [d, txt] = saveBarState();
  bar.classList.toggle("dirty", d); bar.querySelector(".savebar-t").textContent = txt;
  bar.querySelectorAll('[data-action="themeSave"],[data-action="themeUndo"]').forEach(b => b.disabled = !d);
  const c = bar.querySelector('[data-action="homeCancel"]'); if (c) c.textContent = d ? "Peru" : "Sulje";
}

export function vUlkoasu() {
  if (!S.themeDraft) return backLink();
  const D = S.themeDraft, pal = S.themePal;
  let h = backLink() + `<p class="form-note">Muutokset näkyvät heti esikatseluna. Paina <b>Tallenna</b>, niin ne tallentuvat ja näkyvät kaikilla laitteillasi.${S.themeMeta?.at ? ` Viimeksi tallennettu ${fmtDT(S.themeMeta.at)}.` : ""}</p>`;
  if (!S.themeVersions && !S.tvLoading) { S.tvLoading = true; loadThemeVersions(); }
  h += secH("Valmiit teemat") + `<div class="presets">${Object.entries(THEME_PRESETS).map(([k, p]) => `<button class="preset" data-action="themePreset" data-preset="${k}"><span class="sw">${["bg", "card", "primary", "accent"].map(c => `<i style="background:${p[pal][c]}"></i>`).join("")}</span>${esc(p.name)}</button>`).join("")}</div>`;
  h += versionsSection();
  h += secH("Värit") + `<div class="card t-card">
    ${tSelect("mode", "Väritila", [["auto", "Automaattinen (puhelimen mukaan)"], ["light", "Aina vaalea"], ["dark", "Aina tumma"]])}
    <div class="seg">${[["light", "☀️ Vaalea paletti"], ["dark", "🌙 Tumma paletti"]].map(([k, l]) => `<button data-action="themePal" data-pal="${k}" class="${k === pal ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="dark-styles"><span class="form-note">Tumman tilan tausta:</span>${Object.entries(DARK_STYLES).map(([k, st]) => `<button class="preset dark-preset" data-action="themeDarkStyle" data-v="${k}"><span class="sw"><i style="background:${st.bg}"></i><i style="background:${st.card}"></i><i style="background:${st.line}"></i></span>${esc(st.name)}</button>`).join("")}</div>
    <p class="form-note">Muokkaat nyt ${pal === "light" ? "vaaleaa" : "tummaa"} palettia, ja esikatselu näyttää sen.</p>
    <div class="card t-preview"><div class="card-label">Esikatselu</div><div class="huge">1 234,56 €</div><p>Tavallista tekstiä ja <span class="muted">himmeää tekstiä</span>.</p>
      <div class="sumgrid"><div><span class="muted">Tulot</span><b class="amt-v pos">+595,36 €</b></div><div><span class="muted">Menot</span><b class="amt-v neg">−120,00 €</b></div><div><span class="muted">Säästöt</span><b class="amt-v sav">50,00 €</b></div></div>
      <div class="chips">${chip("Merkki")}${chip("✓ Maksettu", "ok-chip")}${chip("Varoitus", "warn")}${chip("Myöhässä", "bad")}</div>
      <div class="bar t-bar"><i style="width:60%"></i></div>
      <div class="row-btns"><button class="btn primary" type="button">Pääpainike</button><button class="btn" type="button">Painike</button></div></div>
    <div class="t-colors">${COLOR_FIELDS.map(([k, l]) => tColor(`${pal}.${k}`, l)).join("")}</div>
    <div id="t-contrast">${contrastHtml(D[pal])}</div>
    ${tSelect("topbar", "Yläpalkin tyyli", [["plain", "Taustan värinen"], ["color", "Pääväri"]])}
  </div>`;
  h += secH("Muodot ja tilat") + `<div class="card t-card">
    ${tRange("shape.radius", "Korttien pyöristys", 0, 32, 1, " px")}
    ${tRange("shape.btnRadius", "Painikkeiden pyöristys", 0, 24, 1, " px")}
    ${tRange("shape.inputRadius", "Kenttien pyöristys", 0, 24, 1, " px")}
    ${tRange("shape.border", "Reunaviivan paksuus", 0, 3, 1, " px")}
    ${tSelect("shape.shadow", "Varjot", Object.entries(SHADOWS))}
    ${tSelect("shape.density", "Väljyys", Object.entries(DENSITY).map(([k, v]) => [k, v[0]]))}
  </div>`;
  h += secH("Teksti ja fontit") + `<div class="card t-card">
    ${tRange("type.scale", "Tekstin koko", 85, 130, 5, " %")}
    ${tSelect("type.font", "Leipätekstin fontti", Object.entries(FONTS).map(([k, v]) => [k, v[0]]))}
    ${tSelect("type.headFont", "Otsikoiden fontti", Object.entries(FONTS).map(([k, v]) => [k, v[0]]))}
    ${tSelect("type.headWeight", "Otsikoiden paksuus", HEAD_WEIGHTS, true)}
    ${tRange("type.titleSize", "Sivun otsikon koko", 1, 2, 0.05, " rem")}
    ${tCheck("type.labelCaps", "Korttien pienet otsikot ISOILLA KIRJAIMILLA")}
  </div>`;
  h += secH("Tekstisisältö") + `<div class="card t-card">
    ${tText("text.appName", "Sovelluksen nimi", APP_NAME)}
    ${tText("text.tagline", "Alaotsikko kirjautumissivulla", DEFAULT_THEME.text.tagline)}
    ${tText("text.name", "Nimesi (tervehdyksessä)", "Tero")}
    ${tText("text.greeting", "Tervehdys ({tervehdys}, {nimi})", DEFAULT_THEME.text.greeting)}
  </div>`;
  h += iconSection();
  h += secH("Ominaisuudet") + `<div class="card t-card">${FEATURES.map(([k, l, d]) => `${tCheck("features." + k, l)}<p class="form-note t-feat">${esc(d)}</p>`).join("")}</div>`;

  // Alavalikko
  const inNav = D.navItems, rest = SECTIONS.filter(x => !inNav.includes(x[0]));
  const sec = k => SECTIONS.find(x => x[0] === k);
  h += secH("Alavalikko") + `<p class="form-note">Valitse mitkä osiot näkyvät alavalikossa (enintään ${NAV_MAX}). Koti ja Lisää ovat aina mukana. Voit myös nimetä painikkeet.</p>
    <div class="list">
      <div class="item"><div class="item-row t-navrow"><span class="t-navic"><svg viewBox="0 0 24 24">${ICONS.koti}</svg></span><div class="item-main">${tText("text.nav.koti", "Koti (aina ensimmäisenä)", "Koti")}</div></div></div>
      ${inNav.map((k, i) => `<div class="item"><div class="item-row t-navrow"><span class="t-navic"><svg viewBox="0 0 24 24">${ICONS[k]}</svg></span>
        <div class="item-main">${tText(`text.nav.${k}`, sec(k)[3], sec(k)[1])}</div>
        <span class="order-btns"><button class="icon-btn" data-action="navMove" data-key="${k}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Ylös">↑</button><button class="icon-btn" data-action="navMove" data-key="${k}" data-dir="1" ${i === inNav.length - 1 ? "disabled" : ""} aria-label="Alas">↓</button></span>
        <button class="icon-btn" data-action="navRemove" data-key="${k}" aria-label="Siirrä Lisää-valikkoon" title="Siirrä Lisää-valikkoon">✕</button></div></div>`).join("")}
      <div class="item"><div class="item-row t-navrow"><span class="t-navic"><svg viewBox="0 0 24 24">${ICONS.lisaa}</svg></span><div class="item-main">${tText("text.nav.lisaa", "Lisää (aina viimeisenä)", "Lisää")}</div></div></div>
    </div>
    ${rest.length ? `<div class="form-note">Lisää-valikossa nyt – napauta siirtääksesi alavalikkoon:</div><div class="chips">${rest.map(x => `<button class="chip-btn" data-action="navAdd" data-key="${x[0]}" ${inNav.length >= NAV_MAX ? "disabled" : ""}>+ ${esc(x[3])}</button>`).join("")}</div>` : ""}`;

  // Lisää-valikko
  const mk = k => SECTIONS.find(x => x[0] === k)?.[3] || "Asetukset";
  const mOrder = D.menu.order;
  const groupNames = [...new Set(Object.values(D.menu.groups).filter(Boolean))];
  h += secH("Lisää-valikko") + `<p class="form-note">Järjestä Lisää-valikon kohdat ja jaa ne ryhmiin kirjoittamalla ryhmän nimi. Himmeät kohdat ovat nyt alavalikossa.</p>
    <datalist id="menu-groups">${groupNames.map(g => `<option value="${esc(g)}">`).join("")}</datalist>
    <div class="list">${mOrder.map((k, i) => `<div class="item ${D.navItems.includes(k) ? "t-dim" : ""}"><div class="item-row">
      <div class="item-main"><div class="item-title">${esc(mk(k))}</div><input class="t-title t-group" id="${tId("menu.groups." + k)}" data-tk="menu.groups.${k}" value="${esc(D.menu.groups[k] || "")}" placeholder="Ryhmä (tyhjä = ei otsikkoa)" list="menu-groups" autocomplete="off"></div>
      <span class="order-btns"><button class="icon-btn" data-action="menuMove" data-key="${k}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Ylös">↑</button><button class="icon-btn" data-action="menuMove" data-key="${k}" data-dir="1" ${i === mOrder.length - 1 ? "disabled" : ""} aria-label="Alas">↓</button></span>
    </div></div>`).join("")}</div>`;
  h += secH("Etusivu") + `<div class="card"><p>Etusivun korttien järjestys, koko, otsikot, tervehdys ja muistio muokataan suoraan etusivulla, jotta näet heti miltä se näyttää.</p>
    <div class="row-btns"><button class="btn" data-action="homeEdit">✎ Muokkaa etusivua</button></div></div>`;
  h += `<button class="btn danger ghost block" data-action="themeReset">Palauta oletusulkoasu</button>`;
  const [d, txt] = saveBarState();
  h += `<div id="t-savebar" class="savebar ${d ? "dirty" : ""}"><span class="savebar-t">${txt}</span><button class="btn ghost small" data-action="themeUndo" ${d ? "" : "disabled"}>Peru</button><button class="btn primary small" data-action="themeSave" ${d ? "" : "disabled"}>Tallenna</button></div>`;
  return h;
}
export function onThemeInput(e) {
  const el = e.target;
  if (!el?.dataset?.tk || !S.themeDraft) return;
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.num || el.type === "range") v = Number(v);
  const p = el.dataset.tk;
  tSet(S.themeDraft, p, v);
  document.querySelectorAll(`[data-tv="${p}"]`).forEach(x => {
    if (x.tagName === "INPUT") { if (x !== document.activeElement) { x.value = v; x.classList.remove("bad"); } }
    else x.textContent = (el.type === "color" ? v : fmtNum(v)) + (x.dataset.unit || "");
  });
  if (p === "mode" && v !== "auto" && v !== S.themePal) { S.themePal = v; previewTheme(); render(); return; }
  previewTheme();
  if (/^(light|dark)\./.test(p)) { const c = $("#t-contrast"); if (c) c.innerHTML = contrastHtml(S.themeDraft[S.themePal]); }
  if (p.startsWith("text.nav.")) renderNav();
  if (p.startsWith("features.") || p.startsWith("text.name") || p.startsWith("text.greeting")) { if (S.view === "koti") render(); }
  updateSaveBar();
}
document.addEventListener("input", onThemeInput);
document.addEventListener("change", onThemeInput);

// ---------- Lukitus ja yksityisyys ----------
export function vYksityisyys() {
  const lc = lockCfg();
  return backLink() + `<div class="card"><div class="card-label">Sovelluslukko tällä laitteella</div>
    ${lc ? `<p>🔒 PIN-lukko on käytössä (${lc.len} numeroa).</p>
      <label class="fld"><span>Lukitse uudelleen</span><select id="lock-after">${AFTER_OPTS.map(([v, l]) => `<option value="${v}" ${v === lc.after ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <div class="row-btns"><button class="btn" data-action="lockSet" data-len="${lc.len}">Vaihda PIN</button><button class="btn ghost" data-action="lockOff">Poista lukko</button></div>`
    : `<p>Kun lukko on päällä, sovellus kysyy PIN-koodin aina avattaessa. Firebase-kirjautuminen säilyy, joten salasanaa ei tarvitse syöttää uudelleen.</p>
      <div class="row-btns"><button class="btn primary" data-action="lockSet" data-len="4">Ota käyttöön (4 numeroa)</button><button class="btn" data-action="lockSet" data-len="6">6 numeroa</button></div>`}
    <p class="form-note">PIN tallentuu vain tälle puhelimelle salattuna tiivisteenä. Jos unohdat sen, kirjaudu ulos selaimen asetuksista (tyhjennä sivuston tiedot) ja kirjaudu uudelleen sähköpostilla – tiedot ovat tallessa Firebasessa.</p></div>
  <div class="card"><div class="card-label">Summat etusivulla</div>
    <p>${T().features.hideAmounts ? "Summat ovat piilossa, kunnes napautat niitä." : "Summat näkyvät suoraan."}</p>
    <div class="row-btns"><button class="btn" data-action="toggleHide">${T().features.hideAmounts ? "Näytä summat aina" : "Piilota summat"}</button></div></div>
  <div class="card"><div class="card-label">Tietojen suojaus</div>
    <p class="small">Tiedot ovat Firebasessa, ja tietokannan säännöt sallivat lukemisen ja kirjoittamisen vain sinun käyttäjätunnuksellesi (UID). Sovelluksen osoitteen tietäminen ei riitä tietojen näkemiseen.</p></div>`;
}
document.addEventListener("change", e => {
  if (e.target.id === "lock-after") { setLockAfter(Number(e.target.value)); toast("Tallennettu"); }
});

// ---------- Varmuuskopio ja tiedot ----------
export function vYllapito() {
  if (S.lastBackupAt === undefined) { S.lastBackupAt = null; getDoc(doc(db, "app", "meta")).then(s => { S.lastBackupAt = s.exists() ? s.data().lastBackupAt : null; render(); }).catch(() => { }); }
  const y = Number(today().slice(0, 4));
  const counts = [["tx", "tapahtumaa"], ["recurring", "toistuvaa"], ["categories", "kategoriaa"], ["goals", "säästötavoitetta"], ["periods", "muokattua jaksoa"]].map(([c, l]) => `${list(c).length} ${l}`).join(" · ");
  return backLink() + `<div class="card"><div class="card-label">Varmuuskopio</div>
    <p>${S.lastBackupAt ? "Viimeisin varmuuskopio " + fmtDT(S.lastBackupAt) + "." : "Varmuuskopiota ei ole vielä otettu."}</p>
    <p class="small muted">${counts}</p>
    <div class="row-btns"><button class="btn primary" data-action="exportJson">⬇ Lataa varmuuskopio (JSON)</button><label class="btn file-btn">⬆ Palauta varmuuskopio<input type="file" id="import-file" accept="application/json,.json" hidden></label></div>
    <p class="form-note">Firebase säilyttää tiedot pilvessä, mutta oma varmuuskopio silloin tällöin on hyvä tapa. Palautus ei poista uudempia kirjauksia.</p></div>
  <div class="card"><div class="card-label">Taulukko (CSV, avautuu Excelissä)</div>
    <div class="row-btns">${[y, y - 1].map(v => `<button class="btn" data-action="exportCsv" data-year="${v}">⬇ Vuosi ${v}</button>`).join("")}</div>
    <p class="form-note">Kaikki rivit vuodelta: tapahtumat, palkat ja toistuvat erät.</p></div>
  <div class="card"><div class="card-label">Vaarallinen alue</div><button class="btn danger ghost" data-action="wipeAll">Poista kaikki tiedot…</button></div>`;
}

// ---------- Tili ----------
export function vTili() {
  const uid = S.user?.uid || "";
  return backLink() + `<div class="card"><div class="card-label">Kirjautunut</div><div class="big">${esc(S.user?.email || "")}</div>
    <div class="dl-row"><dt>Käyttäjätunnus (UID)</dt><dd><code class="uid">${esc(uid)}</code></dd></div>
    <div class="row-btns"><button class="btn small" data-action="copy" data-text="${esc(uid)}">Kopioi UID</button></div>
    <p class="form-note">UID tarvitaan Firestoren säännöissä. Katso README-ohje.</p>
    <div class="row-btns"><button class="btn" data-action="resetPw">Vaihda salasana (sähköpostilla)</button><button class="btn ghost" data-action="logout">Kirjaudu ulos</button></div></div>
  <div class="card"><div class="card-label">Asenna puhelimeen</div>
    <p><b>Android:</b> avaa sovellus Chromessa → ⋮-valikko → <i>Asenna sovellus</i> tai <i>Lisää aloitusnäytölle</i>.</p>
    <p class="form-note">Asennettuna sovellus aukeaa omaan ikkunaansa ja toimii myös ilman verkkoa. Kirjaukset lähtevät Firebaseen, kun yhteys palaa.</p></div>`;
}

// ---------- Aloitus (ensimmäinen käynnistys) ----------
export function vAloitus() {
  const st = settings();
  return `<div class="card"><div class="big">Tervetuloa Kukkaroon 👋</div><p>Asetetaan palkka ja palkkajakso. Kaiken voi muuttaa myöhemmin asetuksista.</p></div>
  <form class="card form" data-form="setup">
    <label class="fld"><span>Nimesi</span><input name="name" value="${esc(T().text.name)}" maxlength="40"></label>
    ${moneyFld("salary", "Nettopalkka", st.salary)}
    ${dateFld("payday", "Seuraava palkkapäivä", st.payday)}
    <label class="fld"><span>Palkka tulee</span><select name="cycle"><option value="28">4 viikon välein</option><option value="14">2 viikon välein</option><option value="7">viikoittain</option></select></label>
    ${cb("cats", "Lisää valmiit kategoriat", true, "Ruoka, liikenne, tilaukset, laskut, ASP-tili… Voit muokata ja poistaa niitä.")}
    ${cb("rec", "Lisää ehdotetut toistuvat", true, "Netflix, Rakennusliiton jäsenmaksu, puhelinlasku, Finnkino+, Storytel ja ASP-tili. Täydennät summat ja veloituspäivät itse.")}
    <button class="btn primary block">Aloita</button>
  </form>`;
}

// ---------- Lomakkeiden tallennus ----------
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const v = n => f.elements[n]?.value, c = n => !!f.elements[n]?.checked;
  if (f.dataset.form === "settings") {
    const st = settings();
    const data = { salary: num(v("salary")), salaryName: v("salaryName").trim() || "Palkka", payday: v("payday"), cycle: Number(v("cycle")), holidayShift: c("holidayShift"), forecast: c("forecast"), carry: c("carry"), lowPerDay: num(v("lowPerDay")) };
    if (data.carry && !st.carry) data.carryFrom = new Periods(mergeSettings({ ...st, ...data }), {}).at(today()).key;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.payday)) { alert("Valitse palkkapäivä."); return; }
    saveSettings(data); toast("Asetukset tallennettu"); render();
  }
  if (f.dataset.form === "setup") {
    const payday = v("payday");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payday)) { alert("Valitse palkkapäivä."); return; }
    const b = writeBatch(db);
    if (c("cats") && !list("categories").length) seedCategories(b);
    if (c("rec") && !list("recurring").length) seedRecurring(b, payday);
    b.commit().catch(fail);
    const name = v("name").trim();
    if (name && name !== T().text.name) { const t = structuredClone(S.theme); t.text.name = name; S.theme = t; setDoc(doc(db, "app", "theme"), { ...t, updatedAt: nowIso() }).catch(fail); }
    saveSettings({ salary: num(v("salary")), payday, cycle: Number(v("cycle")), since: today(), done: true });
    S.view = "koti"; location.hash = "koti"; render();
    toast("Valmista! Täydennä seuraavaksi toistuvien summat.");
  }
});
