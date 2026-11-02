// Sovelluksen käynnistys: näkymät, renderöinti, reititys, kirjautuminen ja sovelluslukko
import { $, COLS, ICONS, LOGIN_EMAIL, NAV, S, SETTINGS_DOC, auth, collection, db, esc, onAuthStateChanged, onSnapshot, sendPasswordResetEmail, signInWithEmailAndPassword, toast } from "./core.js";
import { mergeSettings } from "./money.js";
import { T, THEME_DOC, appName, applyTheme, cacheTheme, discardThemeDraft, mergeTheme, navKeys, previewTheme, themeDirty, hideOn } from "./theme.js";
import { iconSrc, listenIcon } from "./views/teemat.js";
import { vKoti } from "./views/koti.js";
import { vJakso } from "./views/jakso.js";
import { vToistuvat } from "./views/toistuvat.js";
import { vTilastot } from "./views/tilastot.js";
import { vKategoriat, vTilit } from "./views/kategoriat.js";
import { vLisaa, vAsetukset, vRahaAsetukset, vUlkoasu, vYksityisyys, vYllapito, vTili, vAloitus } from "./views/asetukset.js";
import { lockActive, showLock, touchLock } from "./lock.js";
import { updateNet, fabHtml, migrateGoals } from "./actions.js";

export const VIEWS = {
  koti: { title: () => appName(), render: vKoti, fab: true },
  jakso: { title: () => "Jakso", render: vJakso, fab: true },
  toistuvat: { title: () => "Toistuvat", render: vToistuvat },
  tilastot: { title: () => "Tilastot", render: vTilastot },
  kategoriat: { title: () => "Kategoriat ja budjetit", render: vKategoriat },
  tilit: { title: () => "Tilit ja säästöt", render: vTilit },
  lisaa: { title: () => "Lisää", render: vLisaa },
  asetukset: { title: () => "Asetukset", render: vAsetukset },
  rahaasetukset: { title: () => "Palkka ja jaksot", render: vRahaAsetukset },
  ulkoasu: { title: () => "Ulkoasu ja ominaisuudet", render: vUlkoasu },
  yksityisyys: { title: () => "Lukitus ja yksityisyys", render: vYksityisyys },
  yllapito: { title: () => "Varmuuskopio ja tiedot", render: vYllapito },
  tili: { title: () => "Tili", render: vTili },
  aloitus: { title: () => "Tervetuloa", render: vAloitus }
};

// ---------- Renderöinti ----------
let rq = false;
export function scheduleRender() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; render(); }); }
export function render() {
  if (!S.user || !S.started) return;
  if (S.settingsLoaded && !S.settings?.done && S.view !== "aloitus") S.view = "aloitus";
  migrateGoals();
  const view = $("#view");
  const a = document.activeElement;
  const keep = a && view.contains(a) && a.id ? { id: a.id, val: a.value, s: a.selectionStart } : null;
  if (S.view === "ulkoasu" && !S.themeDraft) {
    S.themeDraft = structuredClone(S.theme);
    S.themePal = S.theme.mode !== "auto" ? S.theme.mode : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    previewTheme();
  }
  const V = VIEWS[S.view] || VIEWS.koti;
  $("#title").textContent = V.title();
  document.title = V.title() === appName() ? appName() : V.title() + " · " + appName();
  view.innerHTML = V.render();
  view.classList.toggle("hide-amts", hideOn() && S.view === "koti" && !S.revealed);
  if (S.animate) {
    S.animate = false;
    [...view.children].slice(0, 12).forEach((el, i) => el.style.setProperty("--i", i));
    view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
  }
  renderNav();
  $("#fab").innerHTML = V.fab && T().features.fab && S.view !== "aloitus" && !S.homeEdit ? fabHtml() : "";
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.val; el.focus(); try { el.setSelectionRange(keep.s, keep.s); } catch { } }
  }
}
export function renderNav() {
  const nav = $("#nav");
  if (S.view === "aloitus") { nav.hidden = true; return; }
  nav.hidden = false;
  const keys = navKeys();
  const active = keys.includes(S.view) ? S.view : "lisaa";
  const labels = T().text.nav;
  nav.style.gridTemplateColumns = `repeat(${keys.length}, 1fr)`;
  nav.innerHTML = NAV.filter(([k]) => keys.includes(k)).sort((a, b) => keys.indexOf(a[0]) - keys.indexOf(b[0])).map(([k, l]) => `<a href="#${k}" class="${k === active ? "on" : ""}" ${k === active ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg><span>${esc(labels[k] || l)}</span></a>`).join("");
}
export function routeFromHash() { let h = location.hash.slice(1); if (h === "tavoitteet") h = "tilit"; S.view = VIEWS[h] ? h : "koti"; }
window.addEventListener("hashchange", () => {
  const prev = S.view;
  routeFromHash();
  const editing = prev === "ulkoasu" ? !S.homeEdit : (prev === "koti" && S.homeEdit);
  if (editing && S.view !== prev && S.themeDraft) {
    if (themeDirty() && !confirm("Muutoksia ei ole tallennettu. Hylätäänkö ne?")) { location.hash = prev; return; }
    discardThemeDraft();
  }
  if (S.view !== "jakso") { S.catFilter = null; S.search = ""; }
  // Jaksoon palataan aina nykyiseen jaksoon, ellei siirrytty tiettyyn jaksoon (tilastoista)
  if (S.view === "jakso" && prev !== "jakso" && !S.keepOffset) S.pOffset = 0;
  S.keepOffset = false;
  S.revealed = false;
  previewTheme();
  S.animate = true;
  window.scrollTo(0, 0); render();
});

// =============================================================
//  KIRJAUTUMINEN: sähköposti + salasana (vain yksi käyttäjä)
// =============================================================
export function authError(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-email")) return "Väärä sähköposti tai salasana.";
  if (c.includes("network-request-failed")) return "Ei verkkoyhteyttä.";
  if (c.includes("too-many-requests")) return "Liian monta yritystä. Odota hetki.";
  if (c.includes("api-key") || c.includes("configuration")) return "Firebase-asetukset puuttuvat (firebase-config.js).";
  return "Virhe: " + (e?.message || c);
}
export const PURSE_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#1f6f5c"/><path d="M22 22c0-6 4-9 10-9s10 3 10 9" fill="none" stroke="#f4f2ec" stroke-width="3.5" stroke-linecap="round"/><rect x="12" y="22" width="40" height="28" rx="9" fill="#f4f2ec"/><circle cx="32" cy="36" r="6.5" fill="#c08a2b"/><path d="M32 32.5v7M29.8 34.4h4.4M29.8 37.6h4.4" stroke="#f4f2ec" stroke-width="1.4" stroke-linecap="round"/></svg>`;
export const logo = () => iconSrc() ? `<img class="auth-logo" src="${iconSrc()}" alt="">` : PURSE_SVG;

export function showOnly(id) { ["boot", "auth", "app"].forEach(x => { const el = document.getElementById(x); if (el) el.hidden = x !== id; }); }
export function showMessage(msg, isErr = false, extra = "") {
  showOnly("auth");
  $("#auth").innerHTML = `<div class="auth-card">${logo()}<p class="${isErr ? "bad" : "muted"}">${esc(msg)}</p>${extra}</div>`;
}
export function showLogin() {
  showOnly("auth");
  $("#auth").innerHTML = `<div class="auth-card">${logo()}<h1>${esc(appName())}</h1>${T().text.tagline ? `<p class="muted">${esc(T().text.tagline)}</p>` : ""}
    <form id="authform" class="form">
      <label class="fld"><span>Sähköposti</span><input type="email" name="email" value="${esc(LOGIN_EMAIL)}" autocomplete="username" required></label>
      <label class="fld"><span>Salasana</span><input name="password" type="password" required autocomplete="current-password"></label>
      <div class="auth-err" id="autherr" role="alert"></div>
      <button class="btn primary block">Kirjaudu</button>
    </form>
    <p class="form-note">Kirjautuminen tehdään kerran tällä laitteella. Halutessasi voit lisätä sovellukselle oman PIN-lukon asetuksista.</p>
    <button class="link-btn muted" id="auth-reset">Unohtuiko salasana?</button>
  </div>`;
  const form = $("#authform"), err = $("#autherr");
  $("#auth-reset").onclick = async () => {
    const email = form.elements.email.value.trim() || LOGIN_EMAIL;
    try { await sendPasswordResetEmail(auth, email); err.className = "auth-err ok"; err.textContent = "Vaihtolinkki lähetetty osoitteeseen " + email; }
    catch (e) { err.textContent = authError(e); }
  };
  form.onsubmit = async e => {
    e.preventDefault(); err.className = "auth-err"; err.textContent = "";
    const btn = form.querySelector("button"); btn.disabled = true; btn.textContent = "Kirjaudutaan…";
    try { await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value); }
    catch (ex) { err.textContent = authError(ex); btn.disabled = false; btn.textContent = "Kirjaudu"; }
  };
}

// ---------- Tiedot ----------
export function startData() {
  stopData();
  S.started = true;
  S.pending = {};
  COLS.forEach(c => {
    S.unsubs.push(onSnapshot(collection(db, c), { includeMetadataChanges: true }, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const changed = JSON.stringify(docs) !== JSON.stringify(S.d[c]);
      S.d[c] = docs;
      if (changed) S.dataVer = (S.dataVer || 0) + 1;
      S.pending[c] = snap.docs.filter(d => d.metadata?.hasPendingWrites).length;
      updateNet();
      if (changed) scheduleRender();
    }, err => onDataError(err)));
  });
  S.unsubs.push(onSnapshot(SETTINGS_DOC(), snap => {
    if (!snap.exists() && snap.metadata?.fromCache) return; // ei tietoa vielä palvelimelta
    S.settings = snap.exists() ? mergeSettings(snap.data()) : null;
    S.settingsLoaded = true;
    S.dataVer = (S.dataVer || 0) + 1;
    if (S.settings?.done && S.view === "aloitus") { S.view = "koti"; if (location.hash === "#aloitus") location.hash = "koti"; }
    scheduleRender();
  }, err => onDataError(err)));
}
function onDataError(err) {
  console.error(err);
  if (err.code === "permission-denied") {
    stopData();
    showMessage("Ei käyttöoikeutta tietokantaan. Tarkista Firestoren säännöt: niissä pitää olla tämä käyttäjätunnus (UID):", true,
      `<p><code class="uid">${esc(S.user?.uid || "")}</code></p><button class="btn" id="copy-uid">Kopioi UID</button> <button class="btn ghost" id="retry">Yritä uudelleen</button>`);
    $("#copy-uid").onclick = async () => { try { await navigator.clipboard.writeText(S.user.uid); toast("UID kopioitu"); } catch { prompt("Kopioi:", S.user.uid); } };
    $("#retry").onclick = () => startApp();
  }
}
export function stopData() { S.unsubs.forEach(u => u()); S.unsubs = []; S.started = false; }

export function startApp() {
  if (lockActive()) { showLock(() => startApp()); return; }
  touchLock();
  if (!S.started) { startData(); routeFromHash(); }
  showOnly("app");
  updateNet();
  render();
}

export function onThemeSnap(snap) {
  if (!snap.exists() && snap.metadata.fromCache) return;
  const data = snap.exists() ? snap.data() : {};
  S.theme = mergeTheme(data);
  S.themeMeta = data.updatedAt ? { at: data.updatedAt } : null;
  cacheTheme();
  if (!S.themeDraft) applyTheme(S.theme);
  if (S.started) scheduleRender();
}

let themeUnsub = null, iconUnsub = null;
onAuthStateChanged(auth, user => {
  S.user = user;
  if (themeUnsub) { themeUnsub(); themeUnsub = null; }
  stopData(); S.d = {}; S.settings = null; S.settingsLoaded = false;
  discardThemeDraft();
  if (!user) { showLogin(); return; }
  themeUnsub = onSnapshot(THEME_DOC(), onThemeSnap, err => console.warn("theme", err));
  if (iconUnsub) iconUnsub();
  iconUnsub = listenIcon();
  startApp();
});

// ---------- PWA ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => { }); });
  }).catch(e => console.warn("SW", e));
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) showUpdateBanner(); });
}
export function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const b = document.createElement("div");
  b.id = "update-banner"; b.className = "update-banner";
  b.innerHTML = `<span>✨ Uusi versio saatavilla</span><button class="btn small primary" type="button">Päivitä</button>`;
  b.querySelector("button").onclick = () => location.reload();
  document.body.appendChild(b);
}
// Lukitus palaa, kun sovellus on ollut taustalla asetetun ajan
document.addEventListener("visibilitychange", () => {
  if (!S.user) return;
  if (document.visibilityState === "hidden") touchLock();
  else if (lockActive()) showLock(() => { showOnly("app"); render(); });
});
