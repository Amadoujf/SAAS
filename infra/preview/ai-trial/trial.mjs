// Banc d'essai de l'assistant IA « Mon site », sur des entreprises de TEST (jamais les
// démos). Pour chaque scénario : questionnaire → trois propositions (captures en mode
// téléphone) → choix → deux demandes de modification par conversation → publication →
// site public capturé à 390 px. Le coût réel est lu ensuite dans la base (run.sh).
//
// Variables : BASE (https://<domaine>), SITE_SUFFIX (<domaine>), PASSWORD (mot de passe
// des comptes de démo), ACCESS_CODE (code de prévisualisation, facultatif), OUT (dossier
// de sortie), ONLY (identifiants de scénarios séparés par des virgules, facultatif),
// HOST_RULES (règle de résolution Chromium, essais locaux uniquement).
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = (k, d) => process.env[k] ?? d;
const BASE = env("BASE").replace(/\/$/, "");
const SITE = (slug) => `${new URL(BASE).protocol}//${slug}.${env("SITE_SUFFIX")}`;
const OUT = env("OUT", join(here, "out"));
const only = env("ONLY", "").split(",").filter(Boolean);
const scenarios = JSON.parse(readFileSync(join(here, "scenarios.json"), "utf8")).filter((s) => !only.length || only.includes(s.id));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: process.env.HOST_RULES ? [`--host-resolver-rules=${process.env.HOST_RULES}`] : [] });
const results = { startedAt: new Date().toISOString(), base: BASE, scenarios: [] };
const save = () => writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));

async function newContext(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, ignoreHTTPSErrors: env("IGNORE_HTTPS", "") === "1" });
  if (env("ACCESS_CODE", "")) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/acces-previsualisation`, { waitUntil: "domcontentloaded" });
    await p.fill("input[name=code]", env("ACCESS_CODE"));
    await Promise.all([p.waitForLoadState("domcontentloaded"), p.click("button[type=submit]")]);
    await p.close();
  }
  return ctx;
}

for (const s of scenarios) {
  const r = { id: s.id, tenant: s.tenant, catalogue: s.catalogue, brief: s.brief, startedAt: new Date().toISOString(), directions: [], edits: [], errors: [] };
  results.scenarios.push(r);
  const dir = join(OUT, s.id);
  mkdirSync(dir, { recursive: true });
  const ctx = await newContext({ width: 1440, height: 900 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => r.errors.push(`page : ${e.message.split("\n")[0]}`));
  try {
    await p.goto(`${BASE}/connexion`, { waitUntil: "domcontentloaded" });
    await p.getByLabel("E-mail").fill(s.owner);
    await p.getByLabel("Mot de passe").fill(env("PASSWORD"));
    await p.getByRole("button", { name: "Se connecter" }).click();
    await p.waitForTimeout(3000);
    // Les aperçus (iframes) chargent en continu : on attend la structure, pas le réseau.
    await p.goto(`${BASE}/dashboard/mon-site`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.getByRole("heading", { name: "Mon site" }).waitFor({ timeout: 120_000 });
    // État de départ possible : site déjà composé (« Recréer »), propositions en attente
    // (« Modifier mes réponses ») ou questionnaire jamais commencé.
    // Démarrage selon l'état trouvé (site déjà composé, propositions en attente,
    // introduction) ; les boutons ne répondent qu'une fois la page interactive : on
    // réessaie jusqu'à voir la première question.
    const creation = p.locator("section[aria-labelledby=creation-titre]");
    for (let attempt = 0; attempt < 15 && !(await creation.locator("textarea:visible").count()); attempt += 1) {
      const next = p.getByRole("button", { name: /Recréer avec l'IA|Modifier mes réponses|Commencer/ });
      if (await next.count()) await next.first().click().catch(() => {});
      await p.waitForTimeout(1000);
    }
    // Questionnaire : activité, clientèle, ambiances + inspiration, éléments.
    const q = creation;
    await q.locator("textarea:visible").first().fill(s.brief.activity);
    await p.getByRole("button", { name: /Continuer/ }).click();
    await q.locator("input:visible, textarea:visible").first().fill(s.brief.audience);
    await p.getByRole("button", { name: /Continuer/ }).click();
    for (const word of s.brief.styles) await p.getByRole("group", { name: /Ambiances/ }).getByRole("button", { name: new RegExp(word, "i") }).click();
    await p.getByLabel("Inspiration (facultatif)").fill(s.brief.likes);
    await p.getByRole("button", { name: /Continuer/ }).click();
    const t0 = Date.now();
    await p.getByRole("button", { name: /Composer mes trois sites/ }).click();
    await p.getByRole("button", { name: /Choisir ce site/ }).first().waitFor({ timeout: 300_000 });
    r.directionsMs = Date.now() - t0;
    r.simulated = (await p.getByText(/Simulation locale/).count()) > 0;
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(dir, "propositions.png"), fullPage: true });
    const cards = p.getByRole("button", { name: /^Voir « .* » en grand$/ });
    for (let i = 0; i < (await cards.count()); i += 1) {
      const name = ((await cards.nth(i).getAttribute("aria-label")) ?? "").replace(/^Voir « | » en grand$/g, "");
      await cards.nth(i).click();
      const dialog = p.getByRole("dialog");
      await dialog.getByRole("button", { name: "Téléphone" }).click();
      await p.waitForTimeout(3500);
      // Seulement l'aperçu téléphone (pas la fenêtre de comparaison qui l'entoure).
      await dialog.locator("iframe").first().screenshot({ path: join(dir, `proposition-${i + 1}.png`) });
      r.directions.push({ name, shot: `proposition-${i + 1}.png` });
      await dialog.getByRole("button", { name: "Fermer" }).click();
    }
    // Textes des cartes (nom, intention, plan) pour juger la fidélité à la demande.
    r.cardsText = await p.locator("section[aria-labelledby=directions]").innerText().catch(() => "");
    await p.getByRole("button", { name: /Choisir ce site/ }).first().click();
    await p.waitForTimeout(5000);
    r.chosen = r.directions[0]?.name ?? null;
    for (const [k, message] of s.edits.entries()) {
      const e = { message, applied: false };
      const t1 = Date.now();
      // Fin de la réponse : retour du serveur pour CETTE demande (l'historique affiché est
      // limité, on ne peut pas se fier au nombre de messages), puis rafraîchissement.
      const answered = p.waitForResponse((res) => res.url().endsWith("/api/site-ai") && res.request().method() === "POST" && (res.request().postData() ?? "").includes(JSON.stringify(message).slice(1, -1)), { timeout: 300_000 });
      await p.getByPlaceholder(/mets la vitrine|Que changer/).fill(message);
      await p.getByRole("button", { name: "Envoyer" }).click();
      const res = await answered;
      e.ms = Date.now() - t1;
      e.httpStatus = res.status();
      await p.waitForTimeout(2500);
      const item = p.locator('ol[aria-live="polite"] > li.grid', { hasText: message }).last();
      e.reply = (await item.innerText().catch(() => "")).replace(message, "").trim();
      e.failed = res.status() >= 400 || /a échoué|n'a pas été modifié/.test(e.reply);
      const apply = item.getByRole("button", { name: /^Appliquer$/ });
      if (await apply.count()) {
        await apply.click();
        await p.waitForTimeout(4000);
        e.applied = true;
      }
      await p.screenshot({ path: join(dir, `modification-${k + 1}.png`) });
      e.shot = `modification-${k + 1}.png`;
      r.edits.push(e);
    }
    // Publication sur l'entreprise de TEST, puis site public capturé sur téléphone.
    const publish = p.getByRole("button", { name: "Publier" });
    if (await publish.first().isEnabled().catch(() => false)) {
      await publish.first().click();
      await p.waitForTimeout(600);
      await p.getByRole("button", { name: "Publier" }).last().click();
      await p.getByText(/Site publié/).waitFor({ timeout: 60_000 }).catch(() => {});
      r.published = (await p.getByText(/Site publié/).count()) > 0;
    }
    const phone = await newContext({ width: 390, height: 844 });
    const site = await phone.newPage();
    await site.goto(SITE(s.tenant), { waitUntil: "networkidle", timeout: 120_000 });
    await site.waitForTimeout(1500);
    r.mobile = await site.evaluate(() => ({
      overflowPx: document.documentElement.scrollWidth - innerWidth,
      brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
      height: document.documentElement.scrollHeight,
    }));
    await site.screenshot({ path: join(dir, "site-telephone.png"), fullPage: true });
    r.mobileShot = "site-telephone.png";
    await phone.close();
  } catch (error) {
    r.errors.push(String(error.message ?? error).split("\n")[0]);
    await p.screenshot({ path: join(dir, "erreur.png") }).catch(() => {});
  }
  r.finishedAt = new Date().toISOString();
  await ctx.close();
  save();
  console.log(`${s.id} : ${r.errors.length ? "ÉCHEC — " + r.errors[0] : `${r.directions.length} propositions, ${r.edits.filter((e) => e.applied).length}/${r.edits.length} modifications appliquées`}`);
}
results.finishedAt = new Date().toISOString();
save();
await browser.close();
