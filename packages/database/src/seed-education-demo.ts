/**
 * Démonstration ÉDUCATION : « Collège Les Filaos », établissement privé à Dakar (fictif).
 * Script de DÉVELOPPEMENT uniquement — jamais exécuté par la CI ni en production. Tout
 * passe par les VRAIS moteurs (formations, classes à capacité, inscriptions au montant
 * calculé, échéances, encaissements communs, appel, notes publiées ou non).
 * Visuels : natures mortes d'école ORIGINALES rendues par scripts/demo-visuals/education.py,
 * marquées « démonstration », sans photographie ni personne.
 *
 *   pnpm --filter @yamacommerce/database run seed:education-demo
 *
 * Établissement de TEST pour les vérifications navigateur (jamais la démo) :
 *   EDU_SEED=test pnpm --filter @yamacommerce/database run seed:education-demo
 */
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { assertDemoSeedAllowed } from "./demo-guard";
import { createOwnerAccount, provisionTenantForOwner } from "./tenant-provisioning";
import { saveStorefrontContent } from "./storefront-registry";
import { setListingStatus } from "./listing-registry";
import { addDays, utcToLocal, weekdayOf } from "./service-slots";
import {
  createAssessment,
  createClass,
  createProgram,
  defaultInstallmentPlan,
  enrollStudent,
  publishAssessment,
  recordAttendance,
  recordEnrollmentPayment,
  recordGrades,
  updateEducationSettings,
  type ProgramInput,
} from "./education-registry";

const TEST = process.env.EDU_SEED === "test";
const SLUG = TEST ? "test-ecole" : "les-filaos";
const NAME = TEST ? "École de test" : "Collège Les Filaos";
const MAIL = TEST ? "test-ecole.sn" : "les-filaos.sn";
const V = "/demo-templates/education";
const TZ = "Africa/Dakar";
const media = (key: string, title: string) => [{ url: `${V}/${key}.webp`, alt: `${title} — illustration`, demo: true }];

async function main() {
  assertDemoSeedAllowed();
  const existing = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: SLUG } }));
  if (existing) {
    console.info(`${NAME} déjà présent — rien à faire.`);
    return;
  }
  const owner = await createOwnerAccount({ email: `direction@${MAIL}`, fullName: "Mame Diarra Sow", password: "Demo!2026" });
  const { tenantId } = await provisionTenantForOwner({
    ownerUserId: owner.id,
    name: NAME,
    subdomain: SLUG,
    subdomainSuffix: process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai",
    sectorKey: "education",
    planName: "Business",
    templatePreference: "preau",
  });
  // Deux enseignants (rôle « Enseignant » : présences et notes de LEURS classes).
  const teachers = await Promise.all([
    createOwnerAccount({ email: `a.ndiaye@${MAIL}`, fullName: "Alioune Ndiaye", password: "Demo!2026" }),
    createOwnerAccount({ email: `f.gomis@${MAIL}`, fullName: "Florence Gomis", password: "Demo!2026" }),
  ]);
  await withSuperAdminAccess(async (tx) => {
    const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await tx.tenant.update({
      where: { id: tenantId },
      data: { isDemo: true, timezone: TZ, branding: { ...(t.branding as object), contactPhone: "+221 33 860 42 15", contactWhatsapp: "+221776042150", contactEmail: `contact@${MAIL}`, contactAddress: "Rue MZ-83, Mermoz, Dakar" } },
    });
    const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, name: "TEACHER" } });
    for (const u of teachers) await tx.tenantUser.create({ data: { tenantId, userId: u.id, roleId: role.id, status: "ACTIVE", joinedAt: new Date() } });
  });
  const [ndiaye, gomis] = teachers.map((t) => t.id) as [string, string];
  const staff = { userId: owner.id, type: "owner" as const };
  const admin = { userId: owner.id, all: true };
  await withTenant(tenantId, (tx) => updateEducationSettings(tx, tenantId, { academicYear: "2026-2027", gradeScale: 20, absenceAlert: 3, onlineEnrollment: true }));

  const today = utcToLocal(new Date(), TZ).date;
  const rentree = addDays(today, -16);
  const soir = addDays(today, -23);
  const programs: [string, ProgramInput][] = [
    ["tableau", { title: "Terminale S — Mathématiques et sciences", category: "school", level: "Terminale", format: "onsite", audience: "teens", durationLabel: "Année scolaire", tuition: 450_000, registrationFee: 50_000, defaultInstallments: 9, featured: true, summary: "Préparation complète au bac S : effectifs réduits, devoirs surveillés chaque semaine, suivi partagé avec les familles.", description: "Mathématiques, physique-chimie et SVT, avec deux devoirs surveillés par mois.\nConseils de classe chaque trimestre ; bulletins et absences consultables par les parents dans leur espace." }],
    ["primaire", { title: "Éveil — CP et CE1", category: "school", level: "CP · CE1", format: "onsite", audience: "children", durationLabel: "Année scolaire", tuition: 360_000, registrationFee: 40_000, defaultInstallments: 9, featured: true, summary: "Lecture, écriture et calcul dans des classes de vingt élèves, avec une maîtresse par classe." }],
    ["cahier", { title: "Soutien scolaire — Collège", category: "tutoring", level: "6e à 3e", format: "onsite", audience: "teens", durationLabel: "Trimestre", tuition: 90_000, registrationFee: 10_000, defaultInstallments: 3, summary: "Deux séances par semaine après les cours : méthode, exercices, reprise des notions mal comprises." }],
    ["langues", { title: "Anglais B1 — cours du soir", category: "language", level: "B1", format: "onsite", audience: "adults", durationLabel: "12 semaines", tuition: 120_000, registrationFee: 15_000, defaultInstallments: 3, featured: true, summary: "Parler avec aisance au travail et en voyage : petits groupes, beaucoup d'oral, test de niveau à l'entrée." }],
    ["ordinateur", { title: "Bureautique et tableur", category: "training", level: "Débutant", format: "hybrid", audience: "adults", durationLabel: "8 semaines", tuition: 85_000, registrationFee: 10_000, defaultInstallments: 2, summary: "Traitement de texte, tableur et messagerie : les outils du bureau, sur des cas concrets." }],
    ["geometrie", { title: "Préparation au BFEM — Mathématiques", category: "tutoring", level: "3e", format: "onsite", audience: "teens", durationLabel: "10 semaines", tuition: 60_000, registrationFee: 0, defaultInstallments: 2, summary: "Géométrie, calcul et sujets d'annales corrigés ensemble, le samedi matin." }],
    ["livres", { title: "Lettres — Bac de français", category: "school", level: "Première", format: "onsite", audience: "teens", durationLabel: "Année scolaire", tuition: 180_000, registrationFee: 20_000, defaultInstallments: 6, summary: "Commentaire, dissertation et oral : un entraînement régulier jusqu'aux épreuves anticipées." }],
  ];
  const ids: Record<string, string> = {};
  await withTenant(tenantId, async (tx) => {
    for (const [key, input] of programs) {
      const p = await createProgram(tx, tenantId, { ...input, media: media(key, input.title) }, owner.id);
      await setListingStatus(tx, tenantId, p.id, "published", owner.id);
      ids[key] = p.id;
    }
  });

  // Classes : emplois du temps réels (jour, heure), enseignants, capacités.
  const end = "2027-07-10";
  const cls: Record<string, string> = {};
  const starts: Record<string, string> = {};
  const mk = async (key: string, program: string, name: string, teacher: string | null, room: string, start: string, stop: string, capacity: number, schedule: [number, number, number][]) => {
    starts[key] = start;
    cls[key] = (await withTenant(tenantId, (tx) => createClass(tx, tenantId, { listingId: ids[program]!, name, teacherUserId: teacher, room, startDate: start, endDate: stop, capacity, schedule: schedule.map(([weekday, s, e]) => ({ weekday, startMinute: s * 60, endMinute: e * 60 })) }))).id;
  };
  await mk("ts", "tableau", "Terminale S", ndiaye, "Salle 12", rentree, end, 24, [[1, 8, 12], [2, 8, 12], [3, 8, 12], [4, 8, 12], [5, 8, 12]]);
  await mk("cp", "primaire", "CP A", gomis, "Salle 2", rentree, end, 20, [[1, 8, 13], [2, 8, 13], [3, 8, 12], [4, 8, 13], [5, 8, 12]]);
  await mk("soutien", "cahier", "Soutien 4e-3e", ndiaye, "Salle 8", rentree, addDays(rentree, 90), 12, [[2, 16, 18], [4, 16, 18]]);
  await mk("ang", "langues", "Anglais B1 — soir", gomis, "Salle 5", soir, addDays(soir, 84), 14, [[1, 18, 20], [3, 18, 20]]);
  await mk("bur", "ordinateur", "Bureautique — samedi", null, "Salle informatique", soir, addDays(soir, 56), 10, [[6, 9, 12]]);
  await mk("bfem", "geometrie", "BFEM — samedi", ndiaye, "Salle 8", addDays(today, 10), addDays(today, 80), 16, [[6, 9, 11]]);
  await mk("lettres", "livres", "Première L", gomis, "Salle 10", rentree, end, 24, [[1, 14, 16], [3, 14, 16], [5, 14, 16]]);

  // Élèves et familles : inscriptions au bureau (montant calculé par le moteur).
  const families: [string, string, string, [string, string, string][], "parent" | "guardian" | "self"][] = [
    ["Aminata", "Diallo", "77 402 18 36", [["Moussa", "ts", "2008-03-12"], ["Fatou", "cp", "2020-01-25"]], "parent"],
    ["Cheikh", "Ba", "78 211 90 45", [["Awa", "ts", "2008-11-02"]], "parent"],
    ["Ndeye", "Fall", "76 590 32 17", [["Ibrahima", "ts", "2009-05-19"], ["Rokhaya", "soutien", "2012-07-08"]], "parent"],
    ["Pape", "Sarr", "77 118 64 29", [["Aïssatou", "cp", "2020-04-14"]], "parent"],
    ["Mariama", "Kane", "70 322 51 08", [["Omar", "soutien", "2011-09-30"]], "guardian"],
    ["Serigne", "Mbaye", "77 845 20 63", [["Khady", "lettres", "2010-02-21"]], "parent"],
    ["Coumba", "Thiam", "76 203 77 91", [["Babacar", "cp", "2019-12-03"]], "parent"],
    ["Adama", "Cissé", "77 690 13 52", [["Adama", "ang", ""]], "self"],
    ["Yacine", "Ndoye", "78 451 06 38", [["Yacine", "ang", ""]], "self"],
    ["Ousmane", "Faye", "77 330 84 11", [["Ousmane", "bur", ""]], "self"],
    ["Bineta", "Seck", "76 874 29 60", [["Mamadou", "ts", "2008-08-15"]], "parent"],
    ["Lamine", "Gueye", "77 562 41 97", [["Seynabou", "lettres", "2009-10-27"]], "parent"],
  ];
  const discounts: Record<string, [number, string]> = { Rokhaya: [10_000, "Fratrie"], Fatou: [40_000, "Fratrie (deux enfants inscrits)"], Mamadou: [100_000, "Bourse au mérite"] };
  const enrolled: { id: string; student: string; program: string; total: number }[] = [];
  for (const [first, last, phone, kids, relation] of families) {
    let guardianId: string | null = null;
    for (const [kid, classKey, birth] of kids) {
      const programKey = Object.entries({ ts: "tableau", cp: "primaire", soutien: "cahier", ang: "langues", bur: "ordinateur", bfem: "geometrie", lettres: "livres" }).find(([k]) => k === classKey)![1];
      const d = discounts[kid];
      // Inscription faite avant la rentrée : frais à l'inscription, scolarité mensuelle dès le premier jour de classe.
      const p = programs.find(([k]) => k === programKey)![1];
      const installments = defaultInstallmentPlan({ registrationFee: p.registrationFee ?? 0, tuition: p.tuition!, discountAmount: d?.[0] ?? 0, count: p.defaultInstallments ?? 1, firstDueDate: starts[classKey]!, enrollmentDate: addDays(starts[classKey]!, -10) });
      const e = await withTenant(tenantId, (tx) =>
        enrollStudent(tx, tenantId, {
          listingId: ids[programKey]!,
          classGroupId: cls[classKey]!,
          guardianId,
          guardian: guardianId ? null : { firstName: first, lastName: last, phone },
          student: { firstName: kid, lastName: last, birthDate: birth || null },
          relation,
          discountAmount: d?.[0] ?? 0,
          discountReason: d?.[1] ?? null,
          installments,
          channel: "dashboard",
          actor: staff,
        }),
      );
      guardianId = e.customerId;
      enrolled.push({ id: e.id, student: kid, program: programKey, total: e.totalAmount ?? 0 });
    }
  }

  // Encaissements réels et datés : la plupart à jour, quelques retards (relances).
  const late = new Set(["Ibrahima", "Babacar", "Omar"]);
  const methods = ["wave", "orange_money", "cash", "bank_transfer"] as const;
  for (const [i, e] of enrolled.entries()) {
    const r = await withTenant(tenantId, (tx) => tx.reservation.findUniqueOrThrow({ where: { id: e.id }, include: { enrollment: { include: { installments: { orderBy: { position: "asc" } } } } } }));
    const inst = r.enrollment!.installments;
    const paidAt = (iso: string) => new Date(`${iso < today ? iso : addDays(today, -1)}T10:${String(10 + (i % 40)).padStart(2, "0")}:00Z`);
    // Frais d'inscription (ou 1re échéance) toujours réglés ; ensuite, tout ce qui est échu sauf pour les retardataires.
    const due = inst.filter((x, k) => k === 0 || (!late.has(e.student) && x.dueDate.toISOString().slice(0, 10) <= today));
    for (const [k, x] of due.entries()) {
      await withTenant(tenantId, (tx) => recordEnrollmentPayment(tx, tenantId, { reservationId: e.id, amount: x.amount, method: methods[(i + k) % methods.length]!, reference: k % 2 ? null : `REF-${2400 + i * 7 + k}`, paidAt: paidAt(x.dueDate.toISOString().slice(0, 10)), actorUserId: owner.id }));
    }
  }

  // Une demande d'inscription en ligne, à confirmer par l'administration.
  await withTenant(tenantId, (tx) => enrollStudent(tx, tenantId, { listingId: ids.geometrie!, guardian: { firstName: "Rama", lastName: "Diouf", phone: "77 904 55 18", email: "rama.diouf@exemple.sn" }, student: { firstName: "Alioune", lastName: "Diouf", birthDate: "2011-06-04" }, relation: "parent", note: "Mon fils a besoin de reprendre la géométrie avant le BFEM.", channel: "web", actor: { userId: null, type: "customer" } }));

  // Appel des séances passées (présents par défaut, quelques absences et retards).
  const classKeys = ["ts", "cp", "soutien", "ang", "bur", "lettres"];
  for (const key of classKeys) {
    const c = await withTenant(tenantId, (tx) => tx.classGroup.findUniqueOrThrow({ where: { id: cls[key]! }, include: { enrollments: { where: { active: true }, include: { student: true } } } }));
    const days = new Set((c.schedule as { weekday: number }[]).map((s) => s.weekday));
    let n = 0;
    for (let dte = c.startDate.toISOString().slice(0, 10); dte < today; dte = addDays(dte, 1)) {
      if (!days.has(weekdayOf(dte))) continue;
      n++;
      const entries = c.enrollments.map((e, k) => ({ studentId: e.studentId, status: (e.student.firstName === "Ibrahima" && n % 3 === 0) || (k === 1 && n === 4) ? "absent" : k === 0 && n % 5 === 2 ? "late" : e.student.firstName === "Omar" && n === 2 ? "excused" : "present" }));
      if (entries.length) await withTenant(tenantId, (tx) => recordAttendance(tx, tenantId, { classGroupId: c.id, sessionDate: dte, entries, scope: admin }));
    }
  }

  // Évaluations : une publiée (visible des familles), une en cours de saisie.
  const scores = [14.5, 11, 16, 9.5, 12.5, 17, 13];
  for (const key of ["ts", "cp", "soutien", "ang", "lettres"]) {
    const c = await withTenant(tenantId, (tx) => tx.classGroup.findUniqueOrThrow({ where: { id: cls[key]! }, include: { enrollments: { where: { active: true } } } }));
    if (!c.enrollments.length) continue;
    const a1 = await withTenant(tenantId, (tx) => createAssessment(tx, tenantId, { classGroupId: c.id, title: key === "ang" ? "Test d'écoute" : "Devoir n° 1", date: addDays(today, -6), coefficient: 2, scope: admin }));
    await withTenant(tenantId, (tx) => recordGrades(tx, tenantId, { assessmentId: a1.id, entries: c.enrollments.map((e, k) => ({ studentId: e.studentId, score: scores[(k + key.length) % scores.length]!, comment: k === 0 ? "Bon travail, rédaction à soigner." : null })), scope: admin }));
    await withTenant(tenantId, (tx) => publishAssessment(tx, tenantId, a1.id, admin));
    const a2 = await withTenant(tenantId, (tx) => createAssessment(tx, tenantId, { classGroupId: c.id, title: "Interrogation écrite", date: addDays(today, -1), coefficient: 1, scope: admin }));
    await withTenant(tenantId, (tx) => recordGrades(tx, tenantId, { assessmentId: a2.id, entries: c.enrollments.slice(0, 1).map((e) => ({ studentId: e.studentId, score: 12 })), scope: admin }));
  }

  await withTenant(tenantId, (tx) =>
    saveStorefrontContent(tx, tenantId, {
      announcement: { text: "Inscriptions ouvertes : préparation au BFEM le samedi matin, début dans dix jours", href: "/formations" },
      hero: {
        autoplaySeconds: 7,
        slides: [
          { id: "preau", imageUrl: `${V}/preau.webp`, mobileImageUrl: null, imageAlt: "Cour sous le préau et flamboyant en fleurs", demo: true, productId: null, eyebrow: "Établissement privé · Mermoz, Dakar", title: NAME, subtitle: "De l'éveil au baccalauréat, et des cours du soir pour les adultes : des classes à taille humaine, des familles informées à chaque étape.", ctaLabel: "Voir les formations", ctaHref: "/formations", theme: "light" },
        ],
      },
      featuredCategoryIds: [],
      featuredProductIds: [],
      collections: [],
      reassurance: [],
    }, owner.id),
  );
  console.info(`${NAME} créé (direction@${MAIL} / Demo!2026 ; enseignants a.ndiaye@${MAIL}, f.gomis@${MAIL}) : ${programs.length} formations, ${enrolled.length} inscriptions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
