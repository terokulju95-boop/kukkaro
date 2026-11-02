import { APP_NAME, DEFAULT_NAV_ITEMS, NAV, NAV_MAX, S, SECTIONS, centsOn, db, doc } from "./core.js";

// =============================================================
//  ULKOASU (teema)
//  Tallennetaan Firestoreen app/theme. Laite muistaa viimeisimmän
//  teeman, jotta se näkyy heti käynnistyksessä ja ilman verkkoa.
// =============================================================
export const THEME_DOC = () => doc(db, "app", "theme");
export const THEME_KEY = "kukkaro_theme";
// [avain, oletusotsikko, oletuskoko]
export const HOME_CARDS = [
  ["notice", "Muistio", "full"], ["saldo", "Jaksossa jäljellä", "full"], ["paiva", "Päivässä", "half"], ["palkka", "Seuraava palkka", "half"],
  ["tulevat", "Tulossa tällä jaksolla", "full"], ["kevyt", "Kevyt jakso", "full"], ["budjetit", "Budjetit", "full"],
  ["viimeisimmat", "Viimeisimmät", "full"], ["tavoitteet", "Säästötavoitteet", "full"], ["tilaukset", "Toistuvat menot", "compact"]
];
export const HOME_SIZES = [["full", "Iso"], ["compact", "Pieni"], ["half", "Puolikas"]];
export const NAV_DEFAULTS = Object.fromEntries(NAV);
export const COLOR_FIELDS = [
  ["bg", "Taustaväri"], ["card", "Korttien väri"], ["ink", "Tekstin väri"], ["head", "Otsikoiden väri"],
  ["muted", "Himmeä teksti"], ["label", "Korttien pienet otsikot"], ["line", "Reunaviivat"],
  ["primary", "Pääväri (painikkeet, valinnat)"], ["accent", "Korostusväri (säästöt, pylväät)"],
  ["ok", "Tulot / plussalla"], ["warn", "Varoitus"], ["bad", "Miinuksella / myöhässä"]
];
export const FONTS = {
  system: ["Järjestelmän oletus", 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  rounded: ["Pyöreä", 'ui-rounded, "SF Pro Rounded", Nunito, "Varela Round", system-ui, sans-serif'],
  modern: ["Moderni", '"Avenir Next", Avenir, "Segoe UI Variable", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif'],
  serif: ["Klassinen (serif)", '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif']
};
export const DENSITY = { compact: ["Tiivis", 10, 12, 8], normal: ["Normaali", 14, 16, 12], roomy: ["Väljä", 18, 20, 16] };
export const SHADOWS = { none: "Ei varjoa", soft: "Pehmeä", strong: "Voimakas" };
export const HEAD_WEIGHTS = [[500, "Kevyt"], [600, "Puolilihava"], [700, "Lihava"], [800, "Erittäin lihava"]];
export const STATUS_COLORS = { light: { ok: "#2f7d4f", warn: "#8f620f", bad: "#b3402e" }, dark: { ok: "#82d1a1", warn: "#e6b95e", bad: "#f08c7a" } };
export const mkPal = (m, bg, card, ink, muted, line, primary, accent) => ({ bg, card, ink, head: ink, muted, label: muted, line, primary, accent, ...STATUS_COLORS[m] });
export const THEME_PRESETS = {
  kukkaro: { name: "Kukkaro", light: mkPal("light", "#f4f2ec", "#fffdf8", "#1c2420", "#67706a", "#e2ddd1", "#1f6f5c", "#c08a2b"), dark: mkPal("dark", "#101614", "#18201d", "#e6ece8", "#97a39c", "#28332f", "#6cc3a8", "#e5b25c") },
  metsa: { name: "Metsä", light: mkPal("light", "#f3f0e8", "#fffdf8", "#1d2721", "#6a736c", "#e3ddd0", "#2f5d46", "#b8622f"), dark: mkPal("dark", "#121814", "#1b231e", "#e8ece6", "#9aa59c", "#2b3530", "#74b391", "#e09463") },
  jarvi: { name: "Järvi", light: mkPal("light", "#eef2f5", "#fbfdff", "#1a2530", "#5f6d7a", "#d9e1e8", "#2d5f8a", "#c27a2c"), dark: mkPal("dark", "#10161c", "#18212a", "#e6edf3", "#93a2b0", "#273340", "#7fb2de", "#e3a35f") },
  sauna: { name: "Sauna", light: mkPal("light", "#f6efe6", "#fffaf3", "#2a1f18", "#76675a", "#e8dccd", "#8a4b2a", "#3f6b4f"), dark: mkPal("dark", "#1a1410", "#241c16", "#f1e8de", "#b0a191", "#3a2e25", "#e0a17a", "#8fc3a1") },
  graniitti: { name: "Graniitti", light: mkPal("light", "#f2f2f0", "#ffffff", "#1c1d1f", "#686b70", "#e0e0dc", "#3b4a5a", "#a87f1e"), dark: mkPal("dark", "#121314", "#1c1d1f", "#ececea", "#9a9da1", "#2c2e31", "#a9b8c8", "#e0bd62") },
  ruska: { name: "Ruska", light: mkPal("light", "#f7f0e6", "#fffaf2", "#2b1d14", "#76604e", "#ead9c4", "#a33f1f", "#b8841f"), dark: mkPal("dark", "#1a120d", "#251a13", "#f3e7da", "#b49f8a", "#3b2b20", "#e8875f", "#e3b35c") },
  kaamos: { name: "Kaamos", light: mkPal("light", "#eceff4", "#f9fafc", "#1b2230", "#5b6576", "#d7dce5", "#3b4f7a", "#7a5fb0"), dark: mkPal("dark", "#0d1118", "#151b26", "#e3e8f2", "#8e99ad", "#242d3d", "#8fa8db", "#b9a1e6") },
  kesayo: { name: "Kesäyö", light: mkPal("light", "#f4f1f7", "#fffdff", "#22192b", "#6b5f76", "#e4dcea", "#5b3f8c", "#c8603f"), dark: mkPal("dark", "#15111c", "#1e1828", "#ece6f3", "#a497b2", "#312842", "#b49ce0", "#f0a088") },
  saaristo: { name: "Saaristo", light: mkPal("light", "#eef4f3", "#fbfefd", "#142624", "#566b68", "#d5e3e1", "#1f6f6a", "#b8741a"), dark: mkPal("dark", "#0d1716", "#142120", "#e1efed", "#8fa9a5", "#223634", "#6cc3ba", "#eab066") },
  kanerva: { name: "Kanerva", light: mkPal("light", "#f5f1f4", "#fffcfe", "#261c24", "#715f6c", "#e7dce4", "#7a3f6e", "#2f7d74"), dark: mkPal("dark", "#161115", "#20181f", "#efe6ed", "#a898a4", "#352a33", "#d39bc6", "#78c8bd") }
};
// Lisää-valikon kohdat ja oletusryhmät (idea 43). Alavalikossa olevat osiot eivät näy Lisää-valikossa.
export const MENU_KEYS = [
  ...SECTIONS.map(x => [x[0], "Raha"]),
  ["asetukset", "Asetukset"]
];
// Asetukset-keskuksen alasivut (idea 17)
export const SETTINGS_PAGES = ["rahaasetukset", "ulkoasu", "yksityisyys", "yllapito", "tili"];
export const DEFAULT_THEME = {
  mode: "auto", topbar: "plain",
  light: { ...THEME_PRESETS.kukkaro.light }, dark: { ...THEME_PRESETS.kukkaro.dark },
  shape: { radius: 16, btnRadius: 12, inputRadius: 11, border: 1, shadow: "soft", density: "normal" },
  type: { scale: 100, font: "system", headFont: "system", titleSize: 1.25, headWeight: 700, labelCaps: true },
  text: { appName: APP_NAME, tagline: "Oma talous palkkajaksoittain", name: "Tero", greeting: "{tervehdys}, {nimi}!", notice: "", nav: { ...NAV_DEFAULTS } },
  home: { order: HOME_CARDS.map(c => c[0]), hidden: {}, titles: {}, size: Object.fromEntries(HOME_CARDS.map(c => [c[0], c[2]])) },
  features: { showCents: true, fab: true, hideAmounts: false, quickRecent: true, signColors: true, confirmDelete: true, perDayCard: true },
  menu: { order: MENU_KEYS.map(m => m[0]), groups: Object.fromEntries(MENU_KEYS.map(m => [m[0], m[1]])) },
  navItems: [...DEFAULT_NAV_ITEMS]
};
// Vuorokaudenajan tervehdys (idea 9): {tervehdys} tekstissä
export function timeGreeting(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 10 ? "Huomenta" : h >= 10 && h < 17 ? "Päivää" : h >= 17 && h < 22 ? "Iltaa" : "Hyvää yötä";
}
export const T = () => S.themeDraft || S.theme || DEFAULT_THEME;
// Valinnaiset aikatauluominaisuudet (oletuksena pois). Tiedot säilyvät, vaikka ominaisuus on pois päältä.
export const FEATURES = [
  ["showCents", "Näytä sentit", "Summat näytetään muodossa 12,90 €. Pois päältä: 13 €."],
  ["fab", "Pikalisäysnappi (+)", "Pyöreä +-nappi oikeassa alakulmassa kaikilla päänäkymillä."],
  ["quickRecent", "Pikalisäyksen ehdotukset", "Pikalisäys ehdottaa viimeksi käytettyjä menoja (esim. Lidl, Neste) yhdellä napautuksella."],
  ["signColors", "Värikoodatut summat", "Tulot vihreällä, menot tavallisella värillä ja säästöt korostusvärillä."],
  ["hideAmounts", "Piilota summat etusivulla", "Etusivun summat sumennetaan, kunnes napautat niitä. Hyvä, jos käytät puhelinta muiden nähden."],
  ["confirmDelete", "Kysy ennen poistoa", "Pois päältä: poisto tapahtuu heti ja sen voi kumota ilmoituksesta."]
];
export const F = k => !!T().features?.[k];
export const appName = () => T().text.appName || APP_NAME;
export const homeTitle = k => T().home.titles[k] || HOME_CARDS.find(c => c[0] === k)[1];

// Tarkistetaan kaikki arvot, koska ne päätyvät jokaisen laitteen tyyleihin.
export function mergeTheme(src) {
  const t = structuredClone(DEFAULT_THEME);
  const s = src && typeof src === "object" ? src : {};
  const HEX = /^#[0-9a-f]{6}$/i;
  const oneOf = (v, arr, def) => arr.includes(v) ? v : def;
  const numIn = (v, a, b, def) => typeof v === "number" && isFinite(v) && v >= a && v <= b ? v : def;
  const str = (v, def, max = 200) => typeof v === "string" ? v.slice(0, max) : def;
  t.mode = oneOf(s.mode, ["auto", "light", "dark"], t.mode);
  t.topbar = oneOf(s.topbar, ["plain", "color"], t.topbar);
  for (const m of ["light", "dark"]) for (const k of Object.keys(t[m])) if (HEX.test(s[m]?.[k] || "")) t[m][k] = s[m][k].toLowerCase();
  const sh = s.shape || {}, ty = s.type || {}, tx = s.text || {}, hm = s.home || {};
  t.shape.radius = numIn(sh.radius, 0, 40, t.shape.radius);
  t.shape.btnRadius = numIn(sh.btnRadius, 0, 30, t.shape.btnRadius);
  t.shape.inputRadius = numIn(sh.inputRadius, 0, 30, t.shape.inputRadius);
  t.shape.border = numIn(sh.border, 0, 4, t.shape.border);
  t.shape.shadow = oneOf(sh.shadow, Object.keys(SHADOWS), t.shape.shadow);
  t.shape.density = oneOf(sh.density, Object.keys(DENSITY), t.shape.density);
  t.type.scale = numIn(ty.scale, 80, 140, t.type.scale);
  t.type.font = oneOf(ty.font, Object.keys(FONTS), t.type.font);
  t.type.headFont = oneOf(ty.headFont, Object.keys(FONTS), t.type.headFont);
  t.type.titleSize = numIn(ty.titleSize, 0.9, 2.2, t.type.titleSize);
  t.type.headWeight = oneOf(ty.headWeight, HEAD_WEIGHTS.map(w => w[0]), t.type.headWeight);
  if (typeof ty.labelCaps === "boolean") t.type.labelCaps = ty.labelCaps;
  for (const k of Object.keys(t.features)) if (typeof s.features?.[k] === "boolean") t.features[k] = s.features[k];
  if (Array.isArray(s.menu?.order)) t.menu.order = [...new Set([...s.menu.order.filter(k => MENU_KEYS.some(m => m[0] === k)), ...t.menu.order])];
  for (const [k] of MENU_KEYS) if (typeof s.menu?.groups?.[k] === "string") t.menu.groups[k] = s.menu.groups[k].slice(0, 30);
  t.text.appName = str(tx.appName, t.text.appName, 40);
  t.text.tagline = str(tx.tagline, t.text.tagline, 100);
  t.text.greeting = str(tx.greeting, t.text.greeting, 100);
  t.text.name = str(tx.name, t.text.name, 40);
  t.text.notice = str(tx.notice, "", 2000);
  for (const k of Object.keys(NAV_DEFAULTS)) t.text.nav[k] = str(tx.nav?.[k], NAV_DEFAULTS[k], 14);
  if (Array.isArray(s.navItems)) t.navItems = [...new Set(s.navItems.filter(k => SECTIONS.some(x => x[0] === k)))].slice(0, NAV_MAX);
  if (Array.isArray(hm.order)) {
    const known = hm.order.filter(k => HOME_CARDS.some(c => c[0] === k));
    t.home.order = [...new Set([...known, ...t.home.order])];
  }
  for (const [k] of HOME_CARDS) {
    if (hm.hidden?.[k] === true) t.home.hidden[k] = true;
    if (HOME_SIZES.some(z => z[0] === hm.size?.[k])) t.home.size[k] = hm.size[k];
    if (typeof hm.titles?.[k] === "string" && hm.titles[k].trim()) t.home.titles[k] = hm.titles[k].slice(0, 60);
  }
  return t;
}

export function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const onColor = c => contrast(c, "#ffffff") >= contrast(c, "#111111") ? "#ffffff" : "#111111";

export function themeCss(t) {
  const sh = t.shape, ty = t.type, dn = DENSITY[sh.density] || DENSITY.normal;
  const shadow = dark => sh.shadow === "none" ? "none"
    : sh.shadow === "strong" ? (dark ? "0 6px 22px rgba(0,0,0,.45)" : "0 2px 4px rgba(30,40,30,.08), 0 12px 30px rgba(30,40,30,.12)")
      : (dark ? "none" : "0 1px 2px rgba(30,40,30,.06), 0 6px 18px rgba(30,40,30,.05)");
  const vars = (p, dark) => {
    const tint = (c, n) => `color-mix(in srgb, ${c} ${n}%, ${p.card})`;
    return `--bg:${p.bg};--card:${p.card};--ink:${p.ink};--head:${p.head};--muted:${p.muted};--label:${p.label};--line:${p.line};` +
      `--green:${p.primary};--green-d:${p.primary};--green-l:${tint(p.primary, 14)};--on-green:${onColor(p.primary)};--rust:${p.accent};` +
      `--bad:${p.bad};--bad-l:${tint(p.bad, 16)};--warn:${p.warn};--warn-l:${tint(p.warn, 16)};--ok:${p.ok};--ok-l:${tint(p.ok, 16)};` +
      `--shadow:${shadow(dark)};color-scheme:${dark ? "dark" : "light"};`;
  };
  const shared = `--r:${sh.radius}px;--rb:${sh.btnRadius}px;--ri:${sh.inputRadius}px;--bw:${sh.border}px;` +
    `--pad-y:${dn[1]}px;--pad-x:${dn[2]}px;--gap:${dn[3]}px;` +
    `--font:${FONTS[ty.font][1]};--font-head:${FONTS[ty.headFont][1]};--head-w:${ty.headWeight};` +
    `--label-tt:${ty.labelCaps ? "uppercase" : "none"};--title-size:${ty.titleSize}rem;`;
  const dark = vars(t.dark, true);
  return `:root{${shared}${vars(t.light, false)}}html{font-size:${ty.scale}%}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}:root[data-theme="dark"]{${dark}}`;
}

// force = "light"/"dark" esikatselussa (näytetään muokattava paletti)
export function applyTheme(t, force) {
  let el = document.getElementById("theme-style");
  if (!el) { el = document.createElement("style"); el.id = "theme-style"; document.head.appendChild(el); }
  el.textContent = themeCss(t);
  const root = document.documentElement;
  const mode = force || t.mode;
  if (mode === "light" || mode === "dark") root.dataset.theme = mode; else delete root.dataset.theme;
  root.dataset.topbar = t.topbar;
  root.dataset.signs = t.features.signColors ? "on" : "off";
  centsOn.v = t.features.showCents;
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const p = dark ? t.dark : t.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.topbar === "color" ? p.primary : p.bg);
}
export const previewTheme = () => applyTheme(T(), S.themeDraft && S.view === "ulkoasu" ? S.themePal : null);
export const themeDirty = () => !!S.themeDraft && JSON.stringify(S.themeDraft) !== JSON.stringify(S.theme);
export function cacheTheme() { try { localStorage.setItem(THEME_KEY, JSON.stringify(S.theme)); } catch { } }
export function discardThemeDraft() { S.homeEdit = false; if (!S.themeDraft) return; S.themeDraft = null; applyTheme(S.theme); }

S.theme = (() => { try { return mergeTheme(JSON.parse(localStorage.getItem(THEME_KEY) || "{}")); } catch { return mergeTheme({}); } })();
applyTheme(S.theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", previewTheme);


export const navKeys = () => ["koti", ...T().navItems, "lisaa"];
export const backLink = () => navKeys().includes(S.view) ? ""
  : SETTINGS_PAGES.includes(S.view) ? `<a class="back" href="#asetukset">‹ Asetukset</a>` : `<a class="back" href="#lisaa">‹ Lisää</a>`;
export const hideOn = () => !!T().features.hideAmounts;

// Tumman tilan valmiit taustat (idea 58)
export const DARK_STYLES = {
  oled: { name: "OLED-musta", bg: "#000000", card: "#0b0b0b", line: "#2a2a2a" },
  soft: { name: "Pehmeä tumma", bg: "#1b1e23", card: "#252930", line: "#363b44" }
};
