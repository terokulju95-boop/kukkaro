// =============================================================
//  Etusivu: muokattavat kortit (järjestys, koko, otsikot, piilotus)
// =============================================================
import { render } from "../main.js";
import { S, bar, cat, cats, catColor, chip, empty, esc, eur, fmtDateLong, fmtShort, list, nl2br, periods, secH, settings, today, daysBetween } from "../core.js";
import { DEFAULT_THEME, HOME_CARDS, HOME_SIZES, T, homeTitle, timeGreeting } from "../theme.js";
import { saveBarState, tId, tText } from "./asetukset.js";
import { period, curIndex, byCat, recurringCost, goalSaved } from "../calc.js";
import { skippedMonthly, doubles, amountAt, round2 } from "../money.js";
import { rowHtml, catDot } from "./rows.js";

const tab = (view, t) => `data-action="tab" data-view="${view}" data-tab="${t}"`;
export const HOME_DATA = {
  notice: () => {
    const n = T().text.notice.trim(); if (!n) return null;
    return { body: `<p class="notes">${nl2br(n)}</p>`, short: esc(n.split("\n")[0]), cls: "notice" };
  },
  saldo: () => {
    const { p, sum } = period(curIndex()), st = settings();
    const avail = sum.carry + sum.income;
    const used = sum.spent + sum.saved + (st.forecast ? sum.upcoming + sum.upSave : 0);
    const pct = avail > 0 ? used / avail * 100 : 100;
    const cls = sum.left < 0 ? "bad" : "";
    return {
      href: "#jakso",
      body: `<div class="saldo"><div class="huge ${cls}">${eur(sum.left)}</div><div class="muted small">${fmtShort(p.start)}–${fmtShort(p.end)} · ${sum.daysLeft} pv jäljellä</div></div>
        ${bar(pct, sum.left < 0 ? "bad" : pct > 85 ? "warn" : "")}
        <div class="sumgrid">
          ${sum.carry ? `<div><span class="muted">Edelliseltä jaksolta</span><b class="amt-v ${sum.carry < 0 ? "neg" : "pos"}">${eur(sum.carry, true)}</b></div>` : ""}
          <div><span class="muted">Tulot</span><b class="amt-v pos">+${eur(sum.income)}</b></div>
          <div><span class="muted">Käytetty</span><b class="amt-v neg">−${eur(sum.spent)}</b></div>
          ${sum.saved || sum.upSave ? `<div><span class="muted">Säästetty</span><b class="amt-v sav">${eur(sum.saved)}${sum.upSave ? ` <small class="muted">+ ${eur(sum.upSave)} tulossa</small>` : ""}</b></div>` : ""}
          <div><span class="muted">Toistuvia tulossa</span><b class="amt-v neg pending">−${eur(sum.upcoming)}</b></div>
        </div>
        ${sum.late ? `<div class="chips">${chip(`⚠ ${sum.late} erää myöhässä`, "bad")}</div>` : ""}
        ${!st.forecast ? '<p class="form-note">Jäljellä-summa ei vähennä vielä tulossa olevia toistuvia menoja (Asetukset → Palkka ja jaksot).</p>' : ""}`,
      short: `<b class="amt-v ${cls}">${eur(sum.left)}</b> <span class="muted">· ${sum.daysLeft} pv</span>`
    };
  },
  paiva: () => {
    const { sum } = period(curIndex()), st = settings();
    const cls = sum.perDay < 0 ? "bad" : sum.perDay < st.lowPerDay ? "warn" : "";
    return {
      href: "#jakso",
      body: `<div class="big amt-v ${cls}">${eur(sum.perDay)}</div><div class="muted small">päivässä, ${sum.daysLeft} pv palkkaan</div>`,
      short: `<b class="amt-v ${cls}">${eur(sum.perDay)}</b> <span class="muted">/ pv</span>`
    };
  },
  palkka: () => {
    const next = periods().get(curIndex() + 1), d = daysBetween(today(), next.start);
    return {
      href: "#jakso", attrs: `data-action="pMenu"`,
      body: `<div class="big">${d === 0 ? "Tänään" : d === 1 ? "Huomenna" : `${d} pv`}</div><div class="muted small">${fmtDateLong(next.start)}${next.shifted ? " (siirtyy pyhän/viikonlopun takia)" : ""}</div><div class="small amt-v pos">+${eur(next.salary)}</div>`,
      short: `${fmtDateLong(next.start)} <span class="muted">· ${d} pv</span>`
    };
  },
  tulevat: () => {
    const { rows } = period(curIndex());
    const up = rows.filter(r => r.recurring && (r.state === "due" || r.state === "late")).sort((a, b) => a.date.localeCompare(b.date));
    const tot = round2(up.filter(r => r.kind !== "tulo").reduce((s, r) => s + r.amount, 0));
    return {
      count: up.length, href: "#jakso", noFullLink: true, right: `<a href="#jakso">Jakso ›</a>`,
      body: up.length ? `<div class="txlist flat">${up.slice(0, 8).map(r => rowHtml(r, { payBtn: true })).join("")}</div>${up.length > 8 ? `<div class="muted small">+ ${up.length - 8} muuta</div>` : ""}<div class="line total"><span>Yhteensä</span><b>${eur(tot)}</b></div>`
        : '<div class="done-msg">✓ Kaikki tämän jakson toistuvat on maksettu.</div>',
      short: up.length ? `${up.length} kpl · ${eur(tot)}` : '<span class="muted">Kaikki maksettu</span>'
    };
  },
  kevyt: () => {
    const rec = list("recurring").filter(r => r.kind !== "tulo" && r.rhythm === "kk" && r.active !== false);
    if (!rec.length) return null;
    const P = periods(), n0 = curIndex();
    // Ensin varoitus: pankkipäiväsiirron takia sama lasku kahdesti tällä tai seuraavalla jaksolla
    for (let i = 0; i < 2; i++) {
      const p = P.get(n0 + i), dbl = doubles(p, rec, P).filter(([r]) => amountAt(r, p.start) > 0);
      if (!dbl.length) continue;
      const tot = round2(dbl.reduce((s, [r]) => s + amountAt(r, p.start), 0));
      return {
        href: "#tilastot", attrs: tab("tilastot", "ennuste"), cls: "heavy-card",
        body: `<div class="big">${i === 0 ? "Tällä jaksolla" : "Seuraavalla jaksolla"} kahdesti</div><p class="small">${dbl.map(([r, d]) => `${esc(r.name)} (${d.map(fmtShort).join(" ja ")})`).join(", ")}. Varaa <b class="amt-v neg">${eur(tot)}</b> tavallista enemmän.</p><p class="form-note">Viikonloppuna tai pyhänä erääntyvä lasku siirtyy seuraavaan pankkipäivään, jolloin kaksi veloitusta voi osua samalle jaksolle.</p>`,
        short: `<span class="warn">${i === 0 ? "Nyt" : "Seuraavalla"}: ${dbl.map(([r]) => esc(r.name)).join(", ")} 2×</span>`
      };
    }
    for (let i = 0; i < 14; i++) {
      const p = P.get(n0 + i), sk = skippedMonthly(p, rec, P).filter(r => amountAt(r, p.start) > 0);
      if (!sk.length) continue;
      const tot = round2(sk.reduce((s, r) => s + amountAt(r, p.start), 0));
      const when = i === 0 ? "Tällä jaksolla" : i === 1 ? "Seuraavalla jaksolla" : `Jaksolla ${fmtShort(p.start)}–${fmtShort(p.end)}`;
      return {
        href: "#tilastot", attrs: tab("tilastot", "ennuste"), cls: i <= 1 ? "light-card" : "",
        body: `<div class="big">${when}</div><p class="small">ei veloiteta: ${sk.map(r => esc(r.name)).join(", ")}. Rahaa jää <b class="amt-v pos">${eur(tot)}</b> tavallista enemmän.</p><p class="form-note">28 päivän jaksoja on vuodessa 13 mutta kuukausilaskuja 12, joten kerran vuodessa yksi jakso jää ilman niitä.</p>`,
        short: `${when.replace("Jaksolla ", "")}: <b class="amt-v pos">+${eur(tot)}</b>`
      };
    }
    return null;
  },
  budjetit: () => {
    const withB = cats("meno").filter(c => Number(c.budget) > 0);
    if (!withB.length) return { href: "#kategoriat", body: '<div class="muted small">Aseta kategorioille budjetti, niin näet täällä, paljonko jaksossa on vielä käytettävissä.</div>', short: '<span class="muted">Ei budjetteja</span>' };
    const spent = byCat(period(curIndex()).rows, "meno");
    const rows = withB.map(c => { const s = spent[c.id] || 0, pct = s / c.budget * 100; return { c, s, pct }; }).sort((a, b) => b.pct - a.pct);
    const over = rows.filter(r => r.pct > 100).length;
    return {
      href: "#kategoriat", noFullLink: true, right: '<a href="#kategoriat">Muokkaa ›</a>',
      body: rows.map(({ c, s, pct }) => `<div class="budget-row" data-action="catFilter" data-cat="${esc(c.id)}">${catDot(c)}<div class="budget-main"><div class="row-between small"><span>${esc(c.name)}</span><span><b class="amt-v ${pct > 100 ? "bad" : ""}">${eur(s)}</b> <span class="muted">/ ${eur(c.budget)}</span></span></div>${bar(pct, pct > 100 ? "bad" : pct > 85 ? "warn" : "")}</div></div>`).join(""),
      short: over ? `<span class="bad">${over} budjettia ylittynyt</span>` : `${rows.length} budjettia kunnossa`
    };
  },
  viimeisimmat: () => {
    const tx = [...list("tx")].filter(x => x.date <= today()).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
    return {
      href: "#jakso", noFullLink: true, right: '<a href="#jakso">Kaikki ›</a>',
      body: tx.length ? `<div class="txlist flat">${tx.map(x => rowHtml({ ...x, amount: Number(x.amount) || 0, kind: x.kind || "meno", state: "paid" })).join("")}</div>` : '<div class="muted small">Ei vielä kirjauksia. Lisää ensimmäinen +-napista.</div>',
      short: tx.length ? `${esc(tx[0].note || cat(tx[0].cat).name)} <span class="muted">· ${eur(tx[0].amount)}</span>` : '<span class="muted">Ei kirjauksia</span>'
    };
  },
  tavoitteet: () => {
    const g = list("goals");
    if (!g.length) return { href: "#tavoitteet", body: '<div class="muted small">Lisää säästötavoite, esim. ASP-tilin tavoitesumma.</div>', short: '<span class="muted">Ei tavoitteita</span>' };
    return {
      href: "#tavoitteet",
      body: g.map(x => { const s = goalSaved(x), pct = x.target ? s / x.target * 100 : 0; return `<div class="goal-mini"><div class="row-between small"><span>${esc(x.emoji || "🎯")} ${esc(x.name)}</span><span><b class="amt-v sav">${eur(s)}</b> <span class="muted">/ ${eur(x.target)}</span></span></div>${bar(pct, "sav")}</div>`; }).join(""),
      short: g.map(x => `${esc(x.emoji || "🎯")} ${Math.round(goalSaved(x) / (x.target || 1) * 100)} %`).join(" · ")
    };
  },
  tilaukset: () => {
    const rec = list("recurring").filter(r => r.kind === "meno" && r.active !== false && (!r.end || r.end >= today()));
    if (!rec.length) return { href: "#toistuvat", body: '<div class="muted small">Ei toistuvia menoja.</div>', short: '<span class="muted">Ei toistuvia menoja</span>' };
    const m = round2(rec.reduce((s, r) => s + recurringCost(r).month, 0)), y = round2(rec.reduce((s, r) => s + recurringCost(r).year, 0));
    return {
      href: "#toistuvat",
      body: `<div class="big">${eur(m)} <span class="muted small">/ kk</span></div><div class="muted small">${rec.length} toistuvaa menoa · ${eur(y)} vuodessa</div>`,
      short: `${eur(m)} / kk <span class="muted">· ${eur(y)} / v</span>`
    };
  }
};
export const HOME_EMPTY = {
  notice: "Muistio on tyhjä, joten sitä ei näytetä. Kirjoita teksti yläpuolelle.",
  kevyt: "Näkyy, kun sinulla on kuukausittaisia toistuvia menoja: kertoo, mille jaksolle ei osu kuukausilaskuja."
};

export function homeCardHtml(k, size) {
  const d = HOME_DATA[k]?.(); if (!d) return "";
  const label = esc(homeTitle(k)) + (d.count !== undefined ? ` (${d.count})` : "");
  const cls = `card hc hc-${size} ${d.cls || ""}`;
  if (size === "compact") {
    const link = !!d.href;
    const tag = link ? "a" : "div";
    return `<${tag} class="${cls} ${link ? "link" : ""}" ${link ? `href="${d.href}" ${d.attrs || ""}` : ""}><div class="hc-txt"><div class="card-label">${label}</div><div class="hc-v">${d.short}</div></div>${link ? '<span class="chev">›</span>' : ""}</${tag}>`;
  }
  const link = !!d.href && !d.noFullLink;
  const tag = link ? "a" : "div";
  return `<${tag} class="${cls} ${link ? "link" : ""}" ${link ? `href="${d.href}" ${d.attrs || ""}` : ""}><div class="card-label row-between"><span>${label}</span>${d.right || ""}</div>${d.body}</${tag}>`;
}

export function vKoti() {
  const th = T();
  if (S.homeEdit && S.themeDraft) return vKotiEdit();
  const greet = esc(th.text.greeting).replace(/\{nimi\}/g, esc(th.text.name)).replace(/\{tervehdys\}/g, timeGreeting());
  const body = th.home.order.filter(k => !th.home.hidden[k]).map(k => homeCardHtml(k, th.home.size[k])).join("");
  const needs = list("recurring").filter(r => r.needsAmount && !Number(r.amount));
  return (greet.trim() ? `<div class="hello">${greet}</div>` : "")
    + (needs.length ? `<a class="card warn-card link" href="#toistuvat"><b>Täydennä toistuvien summat</b><div class="small">${needs.map(r => esc(r.name)).join(", ")} – summa puuttuu vielä.</div></a>` : "")
    + (th.features.hideAmounts && !S.revealed ? `<p class="form-note center">Summat on piilotettu – napauta summaa näyttääksesi.</p>` : "")
    + (body ? `<div class="home-grid">${body}</div>` : empty("Etusivulle ei ole valittu näytettäviä kortteja."))
    + `<button class="btn ghost small home-edit-btn" data-action="homeEdit">✎ Muokkaa etusivua</button>`;
}

export function vKotiEdit() {
  const D = S.themeDraft, order = D.home.order;
  const vis = order.filter(k => !D.home.hidden[k]), hid = order.filter(k => D.home.hidden[k]);
  let h = `<div class="card he-intro"><div class="card-label">Etusivun muokkaus</div>
    <p class="small">Siirrä kortteja nuolilla tai raahaa ⠿-kahvasta, valitse koko ja piilota turhat. <b>Puolikas</b>-kortit asettuvat vierekkäin.</p>
    ${tText("text.greeting", "Tervehdys ({tervehdys} = Huomenta/Päivää/Iltaa, {nimi} = nimesi, tyhjä = ei tervehdystä)", DEFAULT_THEME.text.greeting)}
    ${tText("text.name", "Nimesi tervehdyksessä", "Tero")}</div>`;
  h += `<div class="home-grid">${vis.map((k, i) => {
    const size = D.home.size[k];
    const def = HOME_CARDS.find(c => c[0] === k)[1];
    const card = homeCardHtml(k, size) || `<div class="card hc hc-${size} he-empty"><div class="card-label">${esc(homeTitle(k))}</div><div class="muted small">${esc(HOME_EMPTY[k] || "Ei näytettävää juuri nyt.")}</div></div>`;
    return `<div class="he hc-${size}" data-key="${k}">
      <div class="he-bar">
        <button class="icon-btn he-drag" aria-label="Raahaa siirtääksesi" title="Raahaa">⠿</button>
        <span class="order-btns"><button class="icon-btn" data-action="homeMove" data-key="${k}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Ylös">↑</button><button class="icon-btn" data-action="homeMove" data-key="${k}" data-dir="1" ${i === vis.length - 1 ? "disabled" : ""} aria-label="Alas">↓</button></span>
        <div class="seg he-size">${HOME_SIZES.map(([z, l]) => `<button data-action="homeSize" data-key="${k}" data-size="${z}" class="${z === size ? "on" : ""}">${l}</button>`).join("")}</div>
        <button class="icon-btn" data-action="homeHide" data-key="${k}" aria-label="Piilota ${esc(def)}" title="Piilota">✕</button>
      </div>
      <input class="t-title" id="${tId("home.titles." + k)}" data-tk="home.titles.${k}" value="${esc(D.home.titles[k] || "")}" placeholder="Otsikko: ${esc(def)}" autocomplete="off">
      ${k === "notice" ? `<textarea class="t-title" id="${tId("text.notice")}" data-tk="text.notice" rows="2" placeholder="Muistiinpano itsellesi, esim. Autovakuutus erääntyy maaliskuussa">${esc(D.text.notice)}</textarea>` : ""}
      <div class="he-body" aria-hidden="true">${card}</div>
    </div>`;
  }).join("")}</div>`;
  if (hid.length) h += secH("Piilotetut kortit") + `<div class="chips">${hid.map(k => `<button class="chip-btn" data-action="homeShow" data-key="${k}">+ ${esc(homeTitle(k))}</button>`).join("")}</div>`;
  h += `<button class="btn danger ghost block" data-action="homeDefaults">Palauta etusivun oletusasettelu</button>`;
  const [d, txt] = saveBarState();
  h += `<div id="t-savebar" class="savebar ${d ? "dirty" : ""}"><span class="savebar-t">${txt}</span><button class="btn ghost small" data-action="homeCancel">${d ? "Peru" : "Sulje"}</button><button class="btn primary small" data-action="themeSave" ${d ? "" : "disabled"}>Tallenna</button></div>`;
  return h;
}

// ---------- Korttien raahaus muokkaustilassa ----------
let drag = null;
document.addEventListener("pointerdown", e => {
  const h = e.target.closest(".he-drag"); if (!h || !S.homeEdit || !S.themeDraft) return;
  const card = h.closest(".he"); if (!card) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  drag = { card, grid: card.parentElement, offX: e.clientX - r.left, offY: e.clientY - r.top };
  card.classList.add("dragging"); document.body.classList.add("drag-active");
  h.setPointerCapture?.(e.pointerId);
});
document.addEventListener("pointermove", e => {
  if (!drag) return;
  const edge = 110;
  if (e.clientY > innerHeight - edge) window.scrollBy(0, 14); else if (e.clientY < edge) window.scrollBy(0, -14);
  drag.card.style.visibility = "hidden";
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".he");
  drag.card.style.visibility = "";
  if (over && over !== drag.card && over.parentElement === drag.grid) {
    const r = over.getBoundingClientRect();
    const before = over.classList.contains("hc-half") ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    drag.grid.insertBefore(drag.card, before ? over : over.nextSibling);
  }
  drag.card.style.transform = "";
  const n = drag.card.getBoundingClientRect();
  drag.card.style.transform = `translate(${e.clientX - drag.offX - n.left}px, ${e.clientY - drag.offY - n.top}px)`;
});
function endDrag() {
  if (!drag) return;
  const { card, grid } = drag; drag = null;
  card.classList.remove("dragging"); card.style.transform = ""; document.body.classList.remove("drag-active");
  const vis = [...grid.querySelectorAll(":scope > .he")].map(x => x.dataset.key);
  const D = S.themeDraft.home;
  D.order = [...vis, ...D.order.filter(k => D.hidden[k])];
  render();
}
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);
