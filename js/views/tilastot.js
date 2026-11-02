// =============================================================
//  Tilastot: jaksot, kategoriat ja ennuste
// =============================================================
import { S, bar, cat, catColor, curTab, empty, esc, eur, fmtShort, list, periods, seg, settings, today } from "../core.js";
import { period, curIndex, byCat } from "../calc.js";
import { skippedMonthly, doubles, amountAt, round2 } from "../money.js";
import { catDot } from "./rows.js";

export function vTilastot() {
  const tab = curTab("tilastot", "jaksot");
  let h = seg("tilastot", [["jaksot", "Jaksot"], ["kategoriat", "Kategoriat"], ["ennuste", "Ennuste"]], "jaksot");
  if (tab === "kategoriat") return h + vCats();
  if (tab === "ennuste") return h + vForecast();
  return h + vPeriods();
}

function vPeriods() {
  const n0 = curIndex(), P = periods();
  // Viimeiset 12 jaksoa + nykyinen, mutta ei ennen ensimmäistä omaa kirjausta tai käyttöönottoa
  const first = [...list("tx").map(x => x.date), settings().since].filter(Boolean).sort()[0] || today();
  const firstN = Math.max(n0 - 12, P.indexOf(first));
  const data = []; for (let n = n0; n >= firstN; n--) data.push(period(n));
  const max = Math.max(1, ...data.map(d => Math.max(d.sum.income, d.sum.spent + d.sum.upcoming + d.sum.saved + d.sum.upSave)));
  const past = data.filter(d => d.p.n < n0);
  const avg = k => past.length ? round2(past.reduce((s, d) => s + k(d.sum), 0) / past.length) : 0;
  let h = past.length ? `<div class="card"><div class="card-label">Keskimäärin jaksossa (${past.length} edellistä)</div><div class="stat3">
    <div><div class="muted small">Menot</div><div class="big">${eur(avg(s => s.spent + s.upcoming))}</div></div>
    <div><div class="muted small">Säästöt</div><div class="big amt-v sav">${eur(avg(s => s.saved + s.upSave))}</div></div>
    <div><div class="muted small">Jäi yli</div><div class="big amt-v ${avg(s => s.total) < 0 ? "bad" : "pos"}">${eur(avg(s => s.total))}</div></div></div></div>` : "";
  h += `<div class="legend"><span><i class="lg-in"></i>Tulot</span><span><i class="lg-out"></i>Menot</span><span><i class="lg-sav"></i>Säästöt</span></div>`;
  h += `<div class="card plist">${data.map(({ p, sum }) => {
    const out = sum.spent + sum.upcoming, sav = sum.saved + sum.upSave, res = p.n === n0 ? sum.left : sum.total;
    return `<div class="prow" data-action="pJump" data-n="${p.n}" role="button">
      <div class="prow-h"><span>${fmtShort(p.start)}–${fmtShort(p.end)}${p.n === n0 ? " <b>· nyt</b>" : ""}</span><b class="amt-v ${res < 0 ? "bad" : "pos"}">${eur(res, true)}</b></div>
      <div class="pbar"><i class="in" style="width:${sum.income / max * 100}%"></i></div>
      <div class="pbar"><i class="out" style="width:${out / max * 100}%"></i><i class="sav" style="width:${sav / max * 100}%"></i></div>
    </div>`;
  }).join("")}</div>`;
  return h + `<p class="form-note">Napauta jaksoa nähdäksesi sen tapahtumat.</p>`;
}

function vCats() {
  const n0 = curIndex(), y = Number(today().slice(0, 4));
  const ranges = [["cur", "Tämä jakso"], ["prev", "Edellinen jakso"], ["y", String(y)], ["y1", String(y - 1)], ["avg", "Keskiarvo / jakso"]];
  const r = S.statRange || "cur";
  let rows = [], nPeriods = 1;
  const yearRows = yy => { const a = periods().indexOf(`${yy}-01-01`), b = periods().indexOf(`${yy}-12-31`); const out = []; for (let n = a; n <= b; n++) out.push(...period(n).rows.filter(x => x.date.startsWith(String(yy)) && x.date <= today())); return out; };
  if (r === "cur") rows = period(n0).rows;
  else if (r === "prev") rows = period(n0 - 1).rows;
  else if (r === "y") rows = yearRows(y);
  else if (r === "y1") rows = yearRows(y - 1);
  else { for (let n = n0 - 6; n < n0; n++) rows.push(...period(n).rows); nPeriods = 6; }
  const kind = S.statKind || "meno";
  const m = byCat(rows, kind, r !== "cur");
  const ent = Object.entries(m).map(([k, v]) => [k, round2(v / nPeriods)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const tot = round2(ent.reduce((s, [, v]) => s + v, 0)), max = ent[0]?.[1] || 1;
  let h = `<div class="chips">${ranges.map(([k, l]) => `<button class="chip-btn ${k === r ? "on" : ""}" data-action="statRange" data-v="${k}">${esc(l)}</button>`).join("")}</div>
    <div class="chips">${[["meno", "Menot"], ["saasto", "Säästöt"], ["tulo", "Tulot"]].map(([k, l]) => `<button class="chip-btn ${k === kind ? "on" : ""}" data-action="statKind" data-v="${k}">${l}</button>`).join("")}</div>`;
  if (!ent.length) return h + empty("Ei kirjauksia tältä ajalta.");
  // Rengaskaavio
  let acc = 0;
  const segs = ent.map(([k, v]) => { const c = cat(k), a = acc / tot * 100; acc += v; return `${catColor(c)} ${a}% ${acc / tot * 100}%`; }).join(",");
  h += `<div class="card donut-card"><div class="donut" style="background:conic-gradient(${segs})"><div class="donut-in"><div class="muted small">Yhteensä</div><div class="big">${eur(tot)}</div></div></div></div>`;
  h += `<div class="card">${ent.map(([k, v]) => { const c = cat(k); return `<div class="budget-row" data-action="catFilter" data-cat="${esc(k)}">${catDot(c)}<div class="budget-main"><div class="row-between small"><span>${esc(c.name)}</span><span><b>${eur(v)}</b> <span class="muted">${Math.round(v / tot * 100)} %</span></span></div>${bar(v / max * 100, "cc")}</div></div>`.replace('class="bar cc"', `class="bar cc" style="--cc:${catColor(c)}"`); }).join("")}</div>`;
  return h + (r === "avg" ? '<p class="form-note">Kuuden edellisen jakson keskiarvo.</p>' : r !== "cur" ? '<p class="form-note">Vain toteutuneet kirjaukset.</p>' : "");
}

// Tulevat 13 jaksoa: palkka, toistuvat menot ja säästöt → mitä jää muuhun käyttöön
function vForecast() {
  const n0 = curIndex(), P = periods(), rec = list("recurring");
  let h = `<p class="form-note">Seuraavan vuoden jaksot. "Muuhun käyttöön" = tulot miinus toistuvat menot ja säästöt. ${settings().cycle === 28 ? "Vihreällä merkityille jaksoille ei osu kaikkia kuukausilaskuja, keltaisille sama lasku osuu kahdesti." : ""}</p>`;
  const data = []; for (let n = n0; n < n0 + 13; n++) data.push(period(n));
  const max = Math.max(1, ...data.map(d => d.sum.income));
  h += `<div class="card plist">${data.map(({ p, rows }) => {
    const inc = rows.filter(r => r.kind === "tulo" && r.state !== "skip").reduce((s, r) => s + r.amount, 0);
    const recOut = rows.filter(r => r.recurring && r.kind === "meno" && r.state !== "skip").reduce((s, r) => s + r.amount, 0);
    const recSav = rows.filter(r => r.recurring && r.kind === "saasto" && r.state !== "skip").reduce((s, r) => s + r.amount, 0);
    const free = round2(inc - recOut - recSav);
    const sk = skippedMonthly(p, rec.filter(r => r.kind !== "tulo"), P).filter(r => amountAt(r, p.start) > 0);
    const dbl = doubles(p, rec.filter(r => r.kind !== "tulo"), P).filter(([r]) => amountAt(r, p.start) > 0);
    return `<div class="prow ${sk.length ? "light" : ""} ${dbl.length ? "heavy" : ""}" data-action="pJump" data-n="${p.n}" role="button">
      <div class="prow-h"><span>${fmtShort(p.start)}–${fmtShort(p.end)}${p.n === n0 ? " <b>· nyt</b>" : ""}</span><span class="muted small">muuhun käyttöön</span><b class="amt-v ${free < 0 ? "bad" : "pos"}">${eur(free)}</b></div>
      <div class="pbar"><i class="out" style="width:${recOut / max * 100}%"></i><i class="sav" style="width:${recSav / max * 100}%"></i><i class="free" style="width:${Math.max(0, free) / max * 100}%"></i></div>
      ${sk.length ? `<div class="small ok">Ei veloiteta: ${sk.map(r => esc(r.name)).join(", ")} (+${eur(sk.reduce((s, r) => s + amountAt(r, p.start), 0))})</div>` : ""}
      ${dbl.length ? `<div class="small warn">Kahdesti: ${dbl.map(([r]) => esc(r.name)).join(", ")} (pankkipäiväsiirto)</div>` : ""}
      ${p.shifted ? `<div class="small muted">Palkka ${fmtShort(p.start)} (siirtyy pyhän/viikonlopun takia)</div>` : ""}
    </div>`;
  }).join("")}</div>`;
  return h + `<div class="legend"><span><i class="lg-out"></i>Toistuvat menot</span><span><i class="lg-sav"></i>Säästöt</span><span><i class="lg-free"></i>Muuhun käyttöön</span></div>`;
}
