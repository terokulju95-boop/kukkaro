// =============================================================
//  Sovelluslukko: 4–6-numeroinen PIN tällä laitteella
//  PIN tallennetaan vain laitteelle (SHA-256-tiiviste), ei Firebaseen.
//  Firebase-kirjautuminen säilyy, lukko vain estää sovelluksen avaamisen.
// =============================================================
import { $, esc, toast } from "./core.js";

const KEY = "kukkaro_lock";
let unlocked = false, lastSeen = Date.now();
export const lockCfg = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
export const AFTER_OPTS = [[0, "Heti kun sovellus suljetaan"], [1, "1 minuutin jälkeen"], [5, "5 minuutin jälkeen"], [15, "15 minuutin jälkeen"], [60, "Tunnin jälkeen"]];

async function hash(pin, salt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
export async function setLock(pin, after = 1) {
  const salt = Math.random().toString(36).slice(2);
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await hash(pin, salt), after, len: pin.length }));
  unlocked = true; lastSeen = Date.now();
}
export function setLockAfter(after) { const c = lockCfg(); if (!c) return; c.after = after; localStorage.setItem(KEY, JSON.stringify(c)); }
export function clearLock() { localStorage.removeItem(KEY); }
export function touchLock() { if (unlocked || !lockCfg()) lastSeen = Date.now(); }
export function lockActive() {
  const c = lockCfg(); if (!c) return false;
  if (!unlocked) return true;
  if (Date.now() - lastSeen > (c.after || 0) * 60000) { unlocked = false; return true; }
  return false;
}

// PIN-näppäimistö. mode: "unlock" | "set"
export function pinPad({ title, sub, len = 4, onDone, onCancel, mode = "unlock" }) {
  let buf = "";
  const root = mode === "unlock" ? $("#auth") : $("#modal");
  const html = `<div class="${mode === "unlock" ? "auth-card" : "sheet pin-sheet"}">
    ${onCancel ? '<button class="link-btn back-btn" id="pin-back">‹ Peruuta</button>' : ""}
    <div class="lock-ic">🔒</div><h1>${esc(title)}</h1><p class="muted">${esc(sub || "")}</p>
    <div class="pin-dots" id="pin-dots"></div>
    <div class="auth-err" id="pin-err" role="alert"></div>
    <div class="pinpad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(k => `<button class="pin-key ${k.length > 1 ? "fn" : ""}" data-k="${k}" aria-label="${k === "back" ? "Poista" : k === "clear" ? "Tyhjennä" : k}">${k === "back" ? "⌫" : k === "clear" ? "C" : k}</button>`).join("")}</div>
    ${mode === "set" ? '<button class="btn ghost small" id="pin-ok" hidden>Valmis</button>' : ""}
  </div>`;
  if (mode === "unlock") { ["boot", "app"].forEach(x => $("#" + x).hidden = true); root.hidden = false; root.innerHTML = html; }
  else { root.innerHTML = html; root.classList.add("open"); }
  const dots = () => $("#pin-dots").innerHTML = Array.from({ length: Math.max(len, buf.length) }, (_, i) => `<i class="${i < buf.length ? "on" : ""}"></i>`).join("");
  const err = t => $("#pin-err").textContent = t;
  const close = () => { document.onkeydown = null; if (mode === "set") { root.classList.remove("open"); root.innerHTML = ""; } };
  dots();
  if (onCancel) $("#pin-back").onclick = () => { close(); onCancel(); };
  const finish = async () => { const r = await onDone(buf); if (r === true) close(); else { err(r || "Väärä PIN-koodi."); buf = ""; dots(); const d = $("#pin-dots"); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake"); } };
  const press = k => {
    if (k === "clear") { buf = ""; err(""); return dots(); }
    if (k === "back") { buf = buf.slice(0, -1); err(""); return dots(); }
    if (buf.length >= 6) return;
    buf += k; dots();
    if (buf.length === len) finish();
  };
  root.querySelectorAll(".pin-key").forEach(b => b.onclick = () => press(b.dataset.k));
  document.onkeydown = e => { if (!$("#pin-dots")) { document.onkeydown = null; return; } if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("back"); };
}

export function showLock(onOpen) {
  const c = lockCfg();
  pinPad({
    title: "Kukkaro on lukittu", sub: "Syötä PIN-koodi", len: c.len || 4,
    onDone: async pin => {
      if (await hash(pin, c.salt) !== c.hash) return "Väärä PIN-koodi.";
      unlocked = true; lastSeen = Date.now(); onOpen(); return true;
    }
  });
}
// Uuden PIN-koodin asetus: kysytään kahdesti
export function askNewPin(len, after, done) {
  pinPad({
    mode: "set", title: "Uusi PIN-koodi", sub: `${len} numeroa`, len, onCancel: () => { },
    onDone: async first => {
      setTimeout(() => pinPad({
        mode: "set", title: "Vahvista PIN", sub: "Syötä sama PIN uudelleen", len, onCancel: () => { },
        onDone: async second => { if (second !== first) return "PIN-koodit eivät täsmää."; await setLock(first, after); toast("Sovelluslukko otettu käyttöön"); done(); return true; }
      }), 50);
      return true;
    }
  });
}
