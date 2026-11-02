// Tapahtumarivi, jota käytetään etusivulla, jaksonäkymässä ja tilastoissa
import { cat, catColor, esc, eur, fmtWd } from "../core.js";

export const KIND_CLS = { meno: "neg", tulo: "pos", saasto: "sav" };
export const amtHtml = (r) => `<span class="amt-v ${KIND_CLS[r.kind]} ${r.state === "skip" ? "struck" : ""} ${r.state === "due" || r.state === "late" ? "pending" : ""}">${r.kind === "tulo" ? "+" : "−"}${eur(r.amount)}</span>`;
export const catDot = (c) => `<span class="cat-dot" style="--cc:${catColor(c)}">${esc(c.emoji || "•")}</span>`;
export function rowHtml(r, opts = {}) {
  const c = cat(r.cat);
  const title = r.note || c.name;
  const chips = [
    r.recurring ? '<span class="tag">🔁</span>' : "",
    r.state === "late" ? '<span class="tag bad">myöhässä</span>' : r.state === "due" ? '<span class="tag">tulossa</span>' : r.state === "skip" ? '<span class="tag">ohitettu</span>' : "",
    r.recurring && r.state === "paid" && r.auto ? "" : ""
  ].join("");
  const attrs = `data-action="row" data-id="${esc(r.id)}" ${r.rid ? `data-rid="${esc(r.rid)}"` : ""} data-date="${r.date}" ${r.salary ? 'data-salary="1"' : ""}`;
  const pay = opts.payBtn && r.recurring && (r.state === "due" || r.state === "late") && !r.auto
    ? `<button class="icon-btn pay-btn" data-action="payOcc" data-rid="${esc(r.rid)}" data-date="${r.date}" aria-label="Merkitse maksetuksi" title="Merkitse maksetuksi">✓</button>` : "";
  return `<div class="txrow ${r.state === "skip" ? "is-skip" : ""}"><div class="txrow-main" ${attrs} role="button" tabindex="0">${catDot(c)}
    <div class="tx-t"><div class="tx-title">${esc(title)}</div><div class="tx-sub">${opts.noDate ? "" : fmtWd(r.date) + " · "}${esc(r.note ? c.name : "")}${chips}</div></div>
    ${amtHtml(r)}</div>${pay}</div>`;
}
