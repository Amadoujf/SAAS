// Rapport HTML du banc d'essai IA : coût RÉEL de chaque génération (jetons facturés lus
// dans la base), durées, propositions en mode téléphone, réponses aux modifications,
// site publié sur téléphone. Usage : node report.mjs <dossier de sortie>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
const jobs = existsSync(join(dir, "costs.json")) ? JSON.parse(readFileSync(join(dir, "costs.json"), "utf8")) : [];
const budget = existsSync(join(dir, "budget.json")) ? JSON.parse(readFileSync(join(dir, "budget.json"), "utf8")) : null;
const rate = Number(process.env.AI_USD_TO_XOF) > 0 ? Number(process.env.AI_USD_TO_XOF) : 610;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fcfa = (n) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const usd = (n) => `${(n / rate).toFixed(3)} $`;
const sec = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const label = { site_directions: "Création (3 propositions)", site_edit: "Modification", site_improve: "Amélioration" };

// Chaque génération est rattachée à UN seul scénario : le dernier commencé, sur la même
// entreprise, avant la génération (dates de la base en UTC).
const at = (v) => new Date(/Z|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`).getTime();
const owner = (j) => results.scenarios.filter((s) => s.tenant === j.tenant && new Date(s.startedAt).getTime() <= at(j.createdAt)).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0]?.id;
const rows = results.scenarios.map((s) => {
  const mine = jobs.filter((j) => owner(j) === s.id);
  return { s, jobs: mine, cost: mine.reduce((t, j) => t + (j.costEstimateXOF ?? 0), 0) };
});
const all = rows.flatMap((r) => r.jobs);
const total = all.reduce((t, j) => t + (j.costEstimateXOF ?? 0), 0);
const byType = (type) => all.filter((j) => j.type === type && j.status === "completed");
const avg = (list, f) => (list.length ? list.reduce((t, j) => t + f(j), 0) / list.length : 0);
const simulated = all.some((j) => j.simulated) || results.scenarios.some((s) => s.simulated);
const models = [...new Set(all.map((j) => j.model).filter(Boolean))];

const summary = `
<div class="scroll"><table>
  <tr><th>Opération</th><th>Nombre</th><th>Coût moyen</th><th>Jetons moyens (entrée / sortie)</th><th>Durée moyenne</th></tr>
  ${["site_directions", "site_edit", "site_improve"].map((t) => {
    const l = byType(t);
    return l.length ? `<tr><td>${label[t]}</td><td>${l.length}</td><td>${fcfa(avg(l, (j) => j.costEstimateXOF))} (${usd(avg(l, (j) => j.costEstimateXOF))})</td><td>${Math.round(avg(l, (j) => j.inputTokens))} / ${Math.round(avg(l, (j) => j.outputTokens))}</td><td>${sec(avg(l, (j) => j.durationMs ?? 0))}</td></tr>` : "";
  }).join("")}
  <tr class="total"><td>Total de l'essai</td><td>${all.length} appel(s), dont ${all.filter((j) => j.status !== "completed").length} en échec</td><td colspan="3">${fcfa(total)} (${usd(total)})</td></tr>
</table></div>
${budget ? `<p>Budget de la plateforme pour ${esc(budget.periodMonth)} : ${fcfa(budget.spentXOF)} dépensés, ${fcfa(budget.reservedXOF)} réservés en cours${process.env.AI_PLATFORM_MONTHLY_CAP_XOF ? `, plafond ${fcfa(Number(process.env.AI_PLATFORM_MONTHLY_CAP_XOF))}` : ""}.</p>` : ""}`;

const sections = rows.map(({ s, jobs: js, cost }) => `
<section>
  <h2>${esc(s.id)} <small>${esc(s.tenant)} — ${esc(s.catalogue)}</small></h2>
  ${s.errors?.length ? `<p class="err">Erreurs : ${s.errors.map(esc).join(" ; ")}</p>` : ""}
  <div class="brief">
    <p><b>Activité :</b> ${esc(s.brief.activity)}</p>
    <p><b>Clientèle :</b> ${esc(s.brief.audience)} · <b>Ambiances :</b> ${esc(s.brief.styles.join(", "))}</p>
    <p><b>Goûts :</b> ${esc(s.brief.likes)}</p>
  </div>
  <p class="meta">Coût réel du scénario : <b>${fcfa(cost)}</b> (${usd(cost)}) · création en ${sec(s.directionsMs)} · ${js.map((j) => `${label[j.type] ?? j.type} ${j.status === "completed" ? "" : `(${esc(j.status)}) `}${fcfa(j.costEstimateXOF)} [${j.inputTokens}/${j.outputTokens} jetons, ${esc(j.model ?? "simulation")}]`).join(" · ")}</p>
  <h3>Les trois propositions (aperçu téléphone)</h3>
  <div class="grid3">${s.directions.map((d) => `<figure><img src="${esc(s.id)}/${esc(d.shot)}" loading="lazy" alt=""><figcaption>${esc(d.name)}${d.name === s.chosen ? " — choisie" : ""}</figcaption></figure>`).join("")}</div>
  <details><summary>Textes des propositions (intention, plan)</summary><pre>${esc(s.cardsText)}</pre></details>
  <h3>Modifications demandées en conversation</h3>
  <ol class="edits">${s.edits.map((e) => `<li><p><b>« ${esc(e.message)} »</b> — ${e.failed ? "échec" : e.applied ? "appliquée" : "aucune modification proposée"} en ${sec(e.ms)}</p><pre>${esc(e.reply)}</pre><img src="${esc(s.id)}/${esc(e.shot)}" loading="lazy" alt=""></li>`).join("")}</ol>
  <h3>Site publié, sur téléphone (390 px)</h3>
  ${s.mobile ? `<p class="meta">Débordement horizontal : ${s.mobile.overflowPx} px · images cassées : ${s.mobile.brokenImages} · hauteur : ${s.mobile.height} px</p><img class="phone" src="${esc(s.id)}/${esc(s.mobileShot)}" loading="lazy" alt="">` : "<p>Non capturé.</p>"}
</section>`).join("");

writeFileSync(join(dir, "index.html"), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Banc d'essai IA</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;color:#14182b;background:#f6f7fb}main{max-width:1180px;margin:auto}
h1{font-size:26px}h2{margin-top:0}h2 small{font-weight:400;color:#5b6173;font-size:14px}section{background:#fff;border-radius:16px;padding:20px;margin:20px 0;box-shadow:0 1px 3px #0001}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:560px;background:#fff}td,th{border-bottom:1px solid #e3e5ec;padding:8px;text-align:left;vertical-align:top}.total td{font-weight:600}
.banner{background:#fff3d6;color:#7a4b00;padding:12px 16px;border-radius:12px;font-weight:600}.err{color:#b42318}.meta{color:#4a5066;font-size:13px}
.brief{background:#f3f4f8;border-radius:12px;padding:10px 14px}.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start}
figure{margin:0}figure img,.edits img{width:100%;border-radius:10px;border:1px solid #e3e5ec}figcaption{font-weight:600;margin-top:4px}
img.phone{width:min(390px,100%);border:1px solid #e3e5ec;border-radius:12px}pre{white-space:pre-wrap;background:#f6f7fb;padding:8px;border-radius:8px;font-size:13px}
</style></head><body><main>
<h1>Banc d'essai de l'assistant IA</h1>
<p class="meta">${esc(results.base)} · du ${esc(results.startedAt)} au ${esc(results.finishedAt ?? "—")} · modèle(s) : ${esc(models.join(", ") || "aucun appel réel")} · ${results.scenarios.length} scénario(s) sur des entreprises de TEST</p>
${simulated ? `<p class="banner">Contient des réponses SIMULÉES (règles locales de développement) : ce ne sont pas des générations IA et leur coût est nul.</p>` : ""}
<h2>Coût réel mesuré</h2>${summary}
<p class="meta">Coût = jetons facturés renvoyés par le fournisseur × tarif public du modèle (${rate} FCFA pour 1 $). Pour la fidélité et la diversité, comparez chaque demande aux trois propositions et aux modifications ci-dessous.</p>
${sections}
</main></body></html>`);
console.log(`Rapport : ${join(dir, "index.html")} — ${all.length} appel(s), ${fcfa(total)}`);
