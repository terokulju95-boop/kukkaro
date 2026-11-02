// =============================================================
//  Kategoriat ja budjetit sekä tilit
// =============================================================
import { S, bar, cats, chip, curTab, empty, esc, eur, fmtDate, list, secH, seg, today, daysBetween, periods, settings } from "../core.js";
import { period, curIndex, byCat, accBalance, mainAcc, mainSummary, savingsAccs, savingsTotal } from "../calc.js";
import { catDot } from "./rows.js";
import { backLink } from "../theme.js";
import { round2 } from "../money.js";

export function vKategoriat() {
  const kind = curTab("kategoriat", "meno");
  let h = backLink() + seg("kategoriat", [["meno", "Menot"], ["tulo", "Tulot"], ["saasto", "Säästöt"]], "meno");
  const list0 = cats(kind);
  const spent = byCat(period(curIndex()).rows, kind);
  if (!list("categories").length) return h + empty("Kategorioita ei ole.") + `<button class="btn primary block" data-action="seedCats">Lisää oletuskategoriat</button>`;
  if (kind === "meno") {
    const totalB = round2(list0.reduce((s, c) => s + (Number(c.budget) || 0), 0));
    if (totalB) h += `<div class="card small"><div class="row-between"><span>Budjetit yhteensä jaksossa</span><b>${eur(totalB)}</b></div><div class="row-between muted"><span>Palkka</span><span>${eur(settings().salary)}</span></div></div>`;
  }
  h += `<div class="list">${list0.map((c, i) => {
    const s = spent[c.id] || 0, b = Number(c.budget) || 0;
    return `<div class="item"><div class="item-row">${catDot(c)}
      <div class="item-main" data-action="editCat" data-id="${esc(c.id)}" role="button"><div class="item-title">${esc(c.name)}</div>
        <div class="by">Tällä jaksolla ${eur(s)}${b ? ` / budjetti ${eur(b)}` : ""}</div>${b ? bar(s / b * 100, s > b ? "bad" : s / b > .85 ? "warn" : "") : ""}</div>
      <span class="order-btns"><button class="icon-btn" data-action="moveCat" data-kind="${kind}" data-id="${esc(c.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Ylös">↑</button><button class="icon-btn" data-action="moveCat" data-kind="${kind}" data-id="${esc(c.id)}" data-dir="1" ${i === list0.length - 1 ? "disabled" : ""} aria-label="Alas">↓</button></span>
    </div></div>`;
  }).join("")}</div>`;
  return h + `<button class="btn primary block" data-action="addCat">+ Uusi kategoria</button>`;
}

// =============================================================
//  Tilit: käyttötili ja säästötilit (tavoite on tilin lisätieto)
// =============================================================
export function vTilit() {
  const main = mainAcc(), ms = mainSummary(), sav = savingsAccs(), cyc = settings().cycle;
  let h = "";
  if (!main) h += `<div class="card"><div class="card-label">Käyttötili</div><p>Kirjaa käyttötilisi saldo kerran, niin Kukkaro näyttää koko tilin rahat – myös aiemmista palkoista jääneet.</p><button class="btn primary" data-action="accSetup">Aseta käyttötilin saldo</button></div>`;
  else h += `<div class="card link acc" data-action="accOpen" data-id="${esc(main.id)}" role="button">
    <div class="row-between"><div class="card-label">${esc(main.emoji || "💳")} ${esc(main.name)}</div><button class="btn small" data-action="accCheck" data-id="${esc(main.id)}">Tarkista saldo</button></div>
    <div class="huge amt-v ${ms.now < 0 ? "bad" : ""}">${eur(ms.now)}</div>
    ${checkedLine(main)}
    <div class="sumgrid"><div><span class="muted">Laskujen jälkeen ennen palkkaa</span><b class="amt-v">${eur(ms.after)}</b></div>
      <div><span class="muted">Tästä palkasta</span><b class="amt-v">${eur(ms.thisPay)}</b></div>
      <div><span class="muted">Aiemmista palkoista</span><b class="amt-v ${ms.older < 0 ? "bad" : "pos"}">${eur(ms.older)}</b></div></div></div>`;
  h += secH("Säästötilit", sav.length ? `<b class="amt-v sav">${eur(savingsTotal())}</b>` : "");
  if (!sav.length) h += empty("Ei säästötilejä. Lisää esim. ASP-tili: sen saldo kasvaa automaattisesti, kun toistuva ASP-säästö lähtee käyttötililtä.");
  h += sav.map(a => {
    const s = accBalance(a), c = cats("saasto").find(x => x.id === a.cat);
    let goal = "";
    if (Number(a.target) > 0) {
      const pct = s / a.target * 100, left = round2(a.target - s);
      let pace = "";
      if (a.deadline && left > 0) { const days = daysBetween(today(), a.deadline); const nP = Math.max(1, Math.ceil(days / cyc)); pace = days > 0 ? ` · ${eur(left / nP)} / palkka ${fmtDate(a.deadline)} mennessä` : ""; }
      goal = `${bar(pct, "sav")}<div class="row-between small"><span class="muted">Tavoite ${eur(a.target)}</span><span class="muted">${left > 0 ? `puuttuu ${eur(left)}${pace}` : "✓ Saavutettu!"}</span></div>`;
    }
    return `<div class="card link acc" data-action="accOpen" data-id="${esc(a.id)}" role="button">
      <div class="row-between"><div class="big">${esc(a.emoji || "🏦")} ${esc(a.name)}</div><b class="big amt-v sav">${eur(s)}</b></div>
      ${goal}<div class="chips">${c ? chip(`${esc(c.emoji)} ${esc(c.name)} → tälle tilille`) : chip("Ei säästökategoriaa", "warn")}</div></div>`;
  }).join("");
  h += `<button class="btn primary block" data-action="accNew" data-type="saasto">+ Uusi säästötili</button>`;
  if (main || sav.length) h += `<div class="card"><div class="row-between"><span class="card-label">Kaikki tilit yhteensä</span><b class="big">${eur((main ? ms.now : 0) + savingsTotal())}</b></div></div>`;
  return h;
}
export function checkedLine(a) {
  if (!a.checkedAt) return "";
  const d = daysBetween(a.checkedAt.slice(0, 10), today());
  return `<div class="small ${d > 14 ? "warn" : "muted"}">${d === 0 ? "Tarkistettu tänään" : `Tarkistettu ${d} pv sitten`}${d > 14 ? " – tarkista saldo pankista" : ""}</div>`;
}
