// =============================================================
//  Jakso: kaikki tulot ja menot palkkajaksoittain
// =============================================================
import { S, bar, cat, catColor, curTab, empty, esc, eur, fmtDateLong, fmtShort, today } from "../core.js";
import { period, curIndex, byCat } from "../calc.js";
import { rowHtml } from "./rows.js";
import { render } from "../main.js";

export function vJakso() {
  const n = curIndex() + S.pOffset, { p, rows, sum } = period(n);
  const off = S.pOffset, t = today();
  const label = off === 0 ? "Nykyinen jakso" : off === -1 ? "Edellinen jakso" : off === 1 ? "Seuraava jakso" : off < 0 ? `${-off} jaksoa sitten` : `${off} jakson päästä`;
  let h = `<div class="card pnav">
    <button class="icon-btn" data-action="pNav" data-dir="-1" aria-label="Edellinen jakso">‹</button>
    <div class="pnav-mid" data-action="pMenu" role="button"><div class="card-label">${label}${p.note ? " · 📝" : ""}</div><div class="big">${fmtShort(p.start)}–${fmtShort(p.end)}${p.end.slice(0, 4) !== t.slice(0, 4) ? p.end.slice(0, 4) : ""}</div>
      <div class="muted small">${p.days} pv${off === 0 ? ` · ${sum.daysLeft} jäljellä` : ""}${p.moved ? " · alku siirretty" : ""} ⋯</div></div>
    <button class="icon-btn" data-action="pNav" data-dir="1" aria-label="Seuraava jakso">›</button>
  </div>`;
  if (off !== 0) h += `<button class="btn ghost small block" data-action="pNav" data-dir="0">↺ Takaisin nykyiseen jaksoon</button>`;
  const future = p.start > t;
  h += `<div class="card"><div class="row-between"><div><div class="card-label">${future ? "Ennuste: jää käyttöön" : p.end < t ? "Jäi yli" : "Jäljellä"}</div><div class="huge amt-v ${sum.left < 0 ? "bad" : ""}">${eur(off < 0 ? sum.total : sum.left)}</div></div>
    ${off === 0 ? `<div class="right"><div class="card-label">Päivässä</div><div class="big amt-v">${eur(sum.perDay)}</div></div>` : ""}</div>
    <div class="sumgrid">
      ${sum.carry ? `<div><span class="muted">Edelliseltä</span><b class="amt-v">${eur(sum.carry, true)}</b></div>` : ""}
      <div><span class="muted">Tulot</span><b class="amt-v pos">+${eur(sum.income)}</b></div>
      <div><span class="muted">Menot</span><b class="amt-v neg">−${eur(sum.spent + sum.upcoming)}</b>${sum.upcoming ? `<small class="muted block">josta tulossa ${eur(sum.upcoming)}</small>` : ""}</div>
      <div><span class="muted">Säästöt</span><b class="amt-v sav">${eur(sum.saved + sum.upSave)}</b></div>
    </div></div>`;

  // Suodattimet
  const kind = curTab("jakso", "all");
  h += `<div class="seg">${[["all", "Kaikki"], ["meno", "Menot"], ["tulo", "Tulot"], ["saasto", "Säästöt"]].map(([k, l]) => `<button data-action="tab" data-view="jakso" data-tab="${k}" class="${k === kind ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const totals = byCat(rows, kind === "all" ? "meno" : kind);
  const used = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxV = used[0]?.[1] || 1;
  if (used.length) h += `<div class="catbars">${used.map(([id, v]) => { const c = cat(id); return `<button class="catbar ${S.catFilter === id ? "on" : ""} ${S.catFilter && S.catFilter !== id ? "dim" : ""}" data-action="catFilter" data-cat="${esc(id)}" style="--cc:${catColor(c)}"><span class="cb-l">${esc(c.emoji || "•")} ${esc(c.name)}</span><span class="cb-v">${eur(v)}</span>${bar(v / maxV * 100, "cc")}</button>`; }).join("")}</div>`;
  h += `<div class="search"><input id="q" type="search" placeholder="Hae selitteellä…" value="${esc(S.search)}" autocomplete="off"></div>`;

  const q = S.search.trim().toLowerCase();
  const shown = rows.filter(r => (kind === "all" || r.kind === kind) && (!S.catFilter || (r.cat || "") === S.catFilter)
    && (!q || (r.note || "").toLowerCase().includes(q) || cat(r.cat).name.toLowerCase().includes(q)));
  if (!shown.length) return h + empty(rows.length ? "Ei hakuehtoja vastaavia rivejä." : "Tällä jaksolla ei ole vielä tapahtumia.");
  // Päivittäin ryhmitelty lista
  const days = [];
  for (const r of shown) { if (!days.length || days.at(-1).d !== r.date) days.push({ d: r.date, rows: [] }); days.at(-1).rows.push(r); }
  h += days.map(({ d, rows: rs }) => {
    const net = rs.filter(r => r.state !== "skip").reduce((s, r) => s + (r.kind === "tulo" ? r.amount : -r.amount), 0);
    return `<div class="day-h"><span>${d === t ? "Tänään" : fmtDateLong(d)}${d > t ? ' <span class="muted">· tulossa</span>' : ""}</span><span class="muted">${eur(net, true)}</span></div><div class="txlist">${rs.map(r => rowHtml(r, { payBtn: true, noDate: true })).join("")}</div>`;
  }).join("");
  if (S.catFilter || q) {
    const tot = shown.filter(r => r.state !== "skip").reduce((s, r) => s + r.amount, 0);
    h += `<div class="card small"><div class="row-between"><span>${shown.length} riviä yhteensä</span><b>${eur(tot)}</b></div></div>`;
  }
  return h;
}

// Haku päivittyy kirjoittaessa
document.addEventListener("input", e => { if (e.target.id === "q") { S.search = e.target.value; render(); } });
