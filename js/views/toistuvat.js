// =============================================================
//  Toistuvat: Netflix, puhelinlasku, jäsenmaksu, ASP-säästö…
// =============================================================
import { S, cat, chip, curTab, empty, esc, eur, fmtDate, fmtDateLong, fmtWd, list, periods, today, addDays, seg } from "../core.js";
import { amountAt, occurrences, occState, occAmount, rhythmName, round2 } from "../money.js";
import { recurringCost, nextOf } from "../calc.js";
import { catDot, rowHtml } from "./rows.js";

const KIND_T = { meno: "Menot", saasto: "Säästöt", tulo: "Tulot" };
export function vToistuvat() {
  const all = list("recurring");
  const tab = curTab("toistuvat", "meno");
  let h = seg("toistuvat", [["meno", "Menot"], ["saasto", "Säästöt"], ["tulo", "Tulot"], ["kalenteri", "Tulevat"]], "meno");
  if (tab === "kalenteri") return h + calendar(all);
  const t = today();
  const items = all.filter(r => (r.kind || "meno") === tab);
  const live = items.filter(r => r.active !== false && (!r.end || r.end >= t));
  const ended = items.filter(r => !live.includes(r));
  const sum = k => round2(live.reduce((s, r) => s + recurringCost(r)[k], 0));
  if (live.length) h += `<div class="card"><div class="stat3">
    <div><div class="card-label">Jaksossa</div><div class="big">${eur(sum("period"))}</div></div>
    <div><div class="card-label">Kuukaudessa</div><div class="big">${eur(sum("month"))}</div></div>
    <div><div class="card-label">Vuodessa</div><div class="big">${eur(sum("year"))}</div></div></div>
    <p class="form-note">Keskiarvoja. Kuukausilaskut osuvat 12:lle vuoden 13 palkkajaksosta.</p></div>`;
  h += `<div class="row-btns"><button class="btn primary" data-action="addRec" data-kind="${tab}">+ Uusi ${tab === "meno" ? "toistuva meno" : tab === "saasto" ? "säästö" : "tulo"}</button>${!all.length ? '<button class="btn" data-action="seedRec">Lisää ehdotetut</button>' : ""}</div>`;
  if (!items.length) return h + empty(tab === "meno" ? "Ei toistuvia menoja. Lisää esim. Netflix, puhelinlasku ja jäsenmaksut – ne kirjautuvat jatkossa jokaiseen jaksoon itsestään." : tab === "saasto" ? "Ei toistuvia säästöjä. Lisää esim. ASP-tilin kuukausisäästö rytmillä \"Joka palkkapäivä\"." : "Palkka tulee automaattisesti asetuksista. Tänne voit lisätä muita säännöllisiä tuloja.");
  h += `<div class="list">${live.sort(byNext).map(item).join("")}</div>`;
  if (ended.length) h += `<details class="more" id="rec-ended" ${S.openDetails.has("rec-ended") ? "open" : ""}><summary>Päättyneet ja keskeytetyt (${ended.length})</summary><div class="list">${ended.map(item).join("")}</div></details>`;
  return h;
}
const byNext = (a, b) => (nextOf(a) || "9999").localeCompare(nextOf(b) || "9999");

function item(r) {
  const t = today(), c = cat(r.cat), next = nextOf(r), cost = recurringCost(r);
  const amt = amountAt(r, t), paused = r.active === false, ended = r.end && r.end < t;
  const chips = [
    r.needsAmount && !Number(r.amount) ? chip("Summa puuttuu", "warn") : "",
    paused ? chip("Keskeytetty", "warn") : ended ? chip("Päättynyt " + fmtDate(r.end)) : r.end ? chip("Päättyy " + fmtDate(r.end)) : "",
    r.auto === false ? chip("Kuitataan itse") : chip("Automaattinen"),
    r.rhythm !== "palkka" ? chip((r.shift || "seur") === "seur" ? "Pyhänä → seur. pankkipäivä" : r.shift === "edel" ? "Pyhänä → edell. pankkipäivä" : "Kortti: myös viikonloppuna") : "",
    (r.prices || []).length > 1 ? chip(`Hinta muuttunut ${fmtDate(r.prices.at(-1).from)}`) : ""
  ].join("");
  return `<div class="item"><div class="item-row" data-action="editRec" data-id="${esc(r.id)}" role="button">${catDot(c)}
    <div class="item-main"><div class="item-title">${esc(r.name)}</div>
      <div class="by">${esc(rhythmName(r.rhythm))}${next && !paused ? ` · seuraava ${fmtWd(next)}` : ""} · ${eur(cost.year)} / v</div>
      <div class="chips">${chips}<button class="chip-btn" data-action="toggleRec" data-id="${esc(r.id)}">${paused ? "▶ Jatka" : "⏸ Keskeytä"}</button></div></div>
    <div class="amt"><b>${eur(amt)}</b></div></div></div>`;
}

// Seuraavat 60 päivää kaikista toistuvista
function calendar(all) {
  const t = today(), to = addDays(t, 60), P = periods(), rows = [];
  for (const r of all) for (const d of occurrences(r, addDays(t, -14), to, P)) {
    const st = occState(r, d);
    if (d < t && st !== "late") continue;
    rows.push({ id: r.id + "@" + d, rid: r.id, date: d, amount: occAmount(r, d), kind: r.kind || "meno", cat: r.cat, note: r.name, recurring: true, state: st, auto: r.auto !== false });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return empty("Ei tulevia eriä seuraavan 60 päivän aikana.");
  // Palkkapäivät väliotsikoiksi
  let h = "", pIdx = null;
  for (const r of rows) {
    const p = P.at(r.date);
    if (p.n !== pIdx) {
      pIdx = p.n;
      const out = rows.filter(x => P.at(x.date).n === p.n && x.kind !== "tulo" && x.state !== "skip").reduce((s, x) => s + x.amount, 0);
      h += `<div class="day-h"><span>Jakso ${fmtDateLong(p.start).replace(/^\S+ /, "")}–${fmtDate(p.end)}</span><span class="muted">${eur(out)}</span></div>`;
    }
    h += `<div class="txlist">${rowHtml(r, { payBtn: true })}</div>`;
  }
  return `<p class="form-note">Seuraavan 60 päivän toistuvat erät jaksoittain. Napauta erää merkitäksesi sen maksetuksi, ohittaaksesi sen tai muuttaaksesi summaa.</p>` + h;
}
