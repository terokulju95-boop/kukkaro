// =============================================================
//  Kategoriat ja budjetit sekä säästötavoitteet
// =============================================================
import { S, bar, cats, chip, curTab, empty, esc, eur, fmtDate, list, seg, today, daysBetween, periods, settings } from "../core.js";
import { period, curIndex, byCat, goalSaved } from "../calc.js";
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

export function vTavoitteet() {
  const g = list("goals");
  let h = backLink();
  if (!g.length) h += empty("Ei säästötavoitteita. Esimerkiksi ASP-tilille voi asettaa tavoitesumman: säästöt kirjautuvat siihen automaattisesti ASP-tili-kategoriasta.");
  const cyc = settings().cycle;
  h += g.map(x => {
    const s = goalSaved(x), pct = x.target ? s / x.target * 100 : 0, left = round2(x.target - s);
    let pace = "";
    if (x.deadline && left > 0) {
      const days = daysBetween(today(), x.deadline);
      const nP = Math.max(1, Math.ceil(days / cyc));
      pace = days > 0 ? `Tavoitteeseen ${fmtDate(x.deadline)} mennessä tarvitaan ${eur(left / nP)} / jakso (${nP} jaksoa).` : `Tavoitepäivä ${fmtDate(x.deadline)} on mennyt.`;
    }
    return `<div class="card link goal" data-action="editGoal" data-id="${esc(x.id)}" role="button">
      <div class="row-between"><div class="big">${esc(x.emoji || "🎯")} ${esc(x.name)}</div><div class="pct ${pct >= 100 ? "ok" : ""}">${Math.floor(pct)} %</div></div>
      ${bar(pct, "sav")}
      <div class="row-between small"><span><b class="amt-v sav">${eur(s)}</b> / ${eur(x.target)}</span><span class="muted">${left > 0 ? `puuttuu ${eur(left)}` : "✓ Saavutettu!"}</span></div>
      ${pace ? `<p class="form-note">${pace}</p>` : ""}
      <div class="chips">${chip("Kategoria: " + esc(cats("saasto").find(c => c.id === x.cat)?.name || "–"))}</div></div>`;
  }).join("");
  return h + `<button class="btn primary block" data-action="addGoal">+ Uusi säästötavoite</button>`;
}
