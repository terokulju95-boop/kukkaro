// =============================================================
//  Ulkoasun versiot ja omat teemat (22) sekä sovelluksen kuvake (4)
//  Firestore: app/themeVersions { history: [...], saved: [...] }
//             app/icon { i180, i192, i512, updatedAt, updatedByName }
// =============================================================
import { S, db, doc, getDoc, setDoc, onSnapshot, esc, fmtDT, nowIso, toast, fail, secH } from "../core.js";
import { mergeTheme, previewTheme } from "../theme.js";
import { render } from "../main.js";

const VERSIONS_DOC = () => doc(db, "app", "themeVersions");
const ICON_DOC = () => doc(db, "app", "icon");
const ICON_KEY = "kukkaro_icon";
const MAX_HISTORY = 10, MAX_SAVED = 12;

// ---------- Versiot ----------
export async function loadThemeVersions() {
  try { const s = await getDoc(VERSIONS_DOC()); S.themeVersions = s.exists() ? s.data() : { history: [], saved: [] }; render(); } catch { }
}
// Kutsutaan, kun uusi ulkoasu tallennetaan: edellinen jää historiaan
export function pushThemeHistory(prev, prevMeta) {
  if (!prev) return;
  const v = S.themeVersions || { history: [], saved: [] };
  const entry = { at: prevMeta?.at || nowIso(), theme: prev };
  v.history = [entry, ...(v.history || [])].slice(0, MAX_HISTORY);
  S.themeVersions = v;
  setDoc(VERSIONS_DOC(), { history: v.history }, { merge: true }).catch(fail);
}
export function versionsSection() {
  const v = S.themeVersions;
  if (!v) return secH("Versiot ja omat teemat") + `<div class="card muted">Ladataan…</div>`;
  const hist = v.history || [], saved = v.saved || [];
  return secH("Versiot ja omat teemat") + `<div class="card t-card">
    <p class="form-note">Jokainen tallennus säilyttää edellisen ulkoasun. Voit palata siihen tai tallentaa nykyisen ulkoasun omalla nimellä. Valittu versio tulee esikatseluun – tallenna, jos haluat ottaa sen käyttöön.</p>
    <div class="row-btns"><button class="btn" data-action="themeSaveNamed">💾 Tallenna nykyinen omaksi teemaksi</button></div>
    ${saved.length ? `<h3 class="form-h">Omat teemat</h3><div class="list">${saved.map((s, i) => `<div class="item"><div class="item-row">${swatch(s.theme)}<div class="item-main"><div class="item-title">${esc(s.name)}</div><div class="by">${fmtDT(s.at)}</div></div><button class="btn small" data-action="themeLoad" data-src="saved" data-i="${i}">Esikatsele</button><button class="icon-btn" data-action="themeDelSaved" data-i="${i}" aria-label="Poista">✕</button></div></div>`).join("")}</div>` : ""}
    ${hist.length ? `<h3 class="form-h">Aiemmat versiot</h3><div class="list">${hist.map((h, i) => `<div class="item"><div class="item-row">${swatch(h.theme)}<div class="item-main"><div class="item-title">${fmtDT(h.at)}</div></div><button class="btn small" data-action="themeLoad" data-src="history" data-i="${i}">Palaa tähän</button></div></div>`).join("")}</div>` : '<p class="form-note">Aiempia versioita ei vielä ole.</p>'}
  </div>`;
}
const swatch = t => `<span class="sw-mini">${["bg", "card", "primary", "accent"].map(c => `<i style="background:${esc(t?.light?.[c] || "#ccc")}"></i>`).join("")}</span>`;

// ---------- Sovelluksen kuvake ----------
export function applyIcon(icon) {
  const set = (rel, href) => { let l = document.querySelector(`link[rel="${rel}"]`); if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); } l.href = href; };
  const base = new URL("./", location.href).href;
  if (!icon?.i192) { set("icon", "icons/icon-192.png"); set("apple-touch-icon", "icons/apple-touch-icon.png"); set("manifest", "manifest.json"); return; }
  set("icon", icon.i192);
  set("apple-touch-icon", icon.i180 || icon.i192);
  // Androidin asennus lukee kuvakkeet manifestista: luodaan oma manifesti, jossa on oma kuvake
  const manifest = {
    name: S.theme?.text?.appName || "Kukkaro", short_name: S.theme?.text?.appName || "Kukkaro", lang: "fi", display: "standalone",
    start_url: base, scope: base, background_color: S.theme?.light?.bg || "#f4f2ec", theme_color: S.theme?.light?.primary || "#1f6f5c",
    icons: [{ src: icon.i192, sizes: "192x192", type: "image/png" }, { src: icon.i512, sizes: "512x512", type: icon.i512.startsWith("data:image/png") ? "image/png" : "image/jpeg" }, { src: icon.i512, sizes: "512x512", type: icon.i512.startsWith("data:image/png") ? "image/png" : "image/jpeg", purpose: "maskable" }]
  };
  set("manifest", URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" })));
}
export const iconSrc = () => S.icon?.i192 || null;
try { S.icon = JSON.parse(localStorage.getItem(ICON_KEY) || "null"); if (S.icon) applyIcon(S.icon); } catch { }
export function listenIcon() {
  return onSnapshot(ICON_DOC(), snap => {
    if (!snap.exists() && snap.metadata?.fromCache) return;
    S.icon = snap.exists() ? snap.data() : null;
    try { S.icon ? localStorage.setItem(ICON_KEY, JSON.stringify(S.icon)) : localStorage.removeItem(ICON_KEY); } catch { }
    applyIcon(S.icon); render();
  }, () => { });
}
// Kuva → neliö (keskeltä rajattu) → PNG/JPEG halutussa koossa
function squareImage(file, size, pad = 0) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas"); c.width = c.height = size;
      const g = c.getContext("2d"); const s = Math.min(img.width, img.height);
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, size, size);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, pad, pad, size - 2 * pad, size - 2 * pad);
      let out = c.toDataURL("image/png");
      if (out.length > 600000) out = c.toDataURL("image/jpeg", 0.85);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kuvaa ei voitu lukea")); };
    img.src = url;
  });
}
export function iconSection() {
  const src = iconSrc();
  return secH("Sovelluksen kuvake") + `<div class="card t-card">
    <div class="icon-row"><img class="icon-prev" src="${src || "icons/icon-192.png"}" alt="Kuvake"><div><b>${src ? "Oma kuvake" : "Oletuskuvake"}</b>${S.icon?.updatedAt ? `<div class="by">${fmtDT(S.icon.updatedAt)}</div>` : ""}</div></div>
    <div class="row-btns"><label class="btn file-btn">📷 Valitse kuva<input type="file" id="icon-file" accept="image/*" hidden></label>${src ? '<button class="btn ghost" data-action="iconReset">Palauta oletus</button>' : ""}</div>
    <p class="form-note">Kuva rajataan neliöksi keskeltä. Kuvake näkyy kirjautumisessa ja selaimen välilehdellä heti. Puhelin tallentaa kotinäytön kuvakkeen asennushetkellä, joten uuden kuvakkeen saa kotinäytölle poistamalla sovelluksen kotinäytöltä ja lisäämällä sen uudelleen.</p>
  </div>`;
}
document.addEventListener("change", async e => {
  if (e.target.id !== "icon-file" || !e.target.files[0]) return;
  try {
    const f = e.target.files[0];
    const [i180, i192, i512] = await Promise.all([squareImage(f, 180), squareImage(f, 192), squareImage(f, 512)]);
    const data = { i180, i192, i512, updatedAt: nowIso() };
    S.icon = data; applyIcon(data); render();
    setDoc(ICON_DOC(), data).catch(fail);
    toast("Kuvake vaihdettu");
  } catch { toast("Kuvan käsittely epäonnistui", true); }
  e.target.value = "";
});

export const THEMEVER_ACTIONS = {
  themeSaveNamed: () => {
    if (!S.themeDraft) return;
    const name = (prompt("Teeman nimi:", "Oma teema") || "").trim().slice(0, 40); if (!name) return;
    const v = S.themeVersions || { history: [], saved: [] };
    v.saved = [{ name, at: nowIso(), theme: mergeTheme(S.themeDraft) }, ...(v.saved || []).filter(s => s.name !== name)].slice(0, MAX_SAVED);
    S.themeVersions = v;
    setDoc(VERSIONS_DOC(), { saved: v.saved }, { merge: true }).catch(fail);
    toast(`Teema "${name}" tallennettu`); render();
  },
  themeLoad: d => {
    const e = S.themeVersions?.[d.src]?.[Number(d.i)]; if (!e || !S.themeDraft) return;
    S.themeDraft = mergeTheme(e.theme); previewTheme(); render();
    toast("Esikatselussa – tallenna ottaaksesi käyttöön");
  },
  themeDelSaved: d => {
    const v = S.themeVersions; if (!v?.saved) return;
    const s = v.saved[Number(d.i)]; if (!s || !confirm(`Poistetaanko teema "${s.name}"?`)) return;
    v.saved.splice(Number(d.i), 1);
    setDoc(VERSIONS_DOC(), { saved: v.saved }, { merge: true }).catch(fail); render();
  },
  iconReset: () => {
    if (!confirm("Palautetaanko oletuskuvake?")) return;
    S.icon = null; applyIcon(null); setDoc(ICON_DOC(), {}).catch(fail); render();
  }
};
