import { hashPassword, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "@yamacommerce/auth";
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { formatInvoiceNumber, formatOrderNumber, nextCounterValue } from "./counters";
import { activateSectorDefaults } from "./modules-registry";

/**
 * Données de démonstration.
 *
 * Crée : les formules d'abonnement, les rôles système globaux, un Super Admin, et DEUX
 * entreprises de démonstration distinctes (pour permettre de vérifier immédiatement
 * l'isolation multi-tenant — voir tests/tenant-isolation.test.ts) avec des données
 * réalistes en FCFA.
 *
 * Idempotent : peut être relancé sans dupliquer les données (upsert sur les clés naturelles).
 */
async function main() {
  console.info("Démarrage du seed…");

  // ---------------------------------------------------------------------
  // 1. Formules d'abonnement
  // ---------------------------------------------------------------------
  // Formules commerciales (octobre 2026) — voir docs/14 §« Formules ». La qualité
  // visuelle (templates premium, animations) est identique pour toutes : seules les
  // fonctions, les quotas et l'accompagnement changent. `maxProducts` = nombre de
  // FICHES (voir docs/14, « Ce que compte une fiche ») ; les quotas d'IA sont une
  // proposition chiffrée à valider (coût estimé), configurables par le Super Admin.
  const PLAN_DEFINITIONS = [
    {
      name: "Essentiel", priceMonthly: 9_900, priceYearly: 99_000, trialDays: 14, isQuoteOnly: false,
      maxProducts: 100, maxEmployees: 1, maxShops: 1, customDomainAllowed: false, maxCustomDomains: 0,
      storageMB: 2_048, maxImageFileMB: 10, maxVideoFileMB: 200, maxDocumentFileMB: 10, maxMediaFileCount: 2_000, monthlyUploadMB: 2_048,
      advancedReports: false, whatsappAutomation: false, commissionRate: 0,
      maxAIGenerationsPerMonth: 0, maxAIImagesAnalyzedPerMonth: 0, maxAIProductsImportedPerMonth: 0, aiEstimatedCostCapXOF: 0,
      features: ["premium_site", "template_customization", "orders", "customer_requests", "cod_payment", "manual_mobile_money"],
    },
    {
      name: "Business", priceMonthly: 24_900, priceYearly: 249_000, trialDays: 14, isQuoteOnly: false,
      maxProducts: 1_000, maxEmployees: 5, maxShops: 1, customDomainAllowed: true, maxCustomDomains: 1,
      storageMB: 10_240, maxImageFileMB: 20, maxVideoFileMB: 500, maxDocumentFileMB: 20, maxMediaFileCount: 10_000, monthlyUploadMB: 10_240,
      advancedReports: false, whatsappAutomation: false, commissionRate: 0,
      maxAIGenerationsPerMonth: 300, maxAIImagesAnalyzedPerMonth: 100, maxAIProductsImportedPerMonth: 500, aiEstimatedCostCapXOF: 2_500,
      features: ["premium_site", "template_customization", "orders", "customer_requests", "cod_payment", "manual_mobile_money", "custom_domain", "business_management", "invoices", "statistics", "ai_quota"],
    },
    {
      name: "Premium", priceMonthly: 49_900, priceYearly: 499_000, trialDays: 14, isQuoteOnly: false,
      maxProducts: 5_000, maxEmployees: 15, maxShops: 1, customDomainAllowed: true, maxCustomDomains: 3,
      storageMB: 51_200, maxImageFileMB: 30, maxVideoFileMB: 1_024, maxDocumentFileMB: 50, maxMediaFileCount: 50_000, monthlyUploadMB: 51_200,
      advancedReports: true, whatsappAutomation: true, commissionRate: 0,
      maxAIGenerationsPerMonth: 1_500, maxAIImagesAnalyzedPerMonth: 500, maxAIProductsImportedPerMonth: 5_000, aiEstimatedCostCapXOF: 10_000,
      features: ["premium_site", "template_customization", "orders", "customer_requests", "cod_payment", "manual_mobile_money", "custom_domain", "business_management", "invoices", "statistics", "ai_quota", "advanced_management", "automations", "priority_support", "advanced_reports"],
    },
    {
      name: "Sur mesure", priceMonthly: 0, priceYearly: 0, trialDays: 30, isQuoteOnly: true,
      maxProducts: 100_000, maxEmployees: 200, maxShops: 50, customDomainAllowed: true, maxCustomDomains: 20,
      storageMB: 200_000, maxImageFileMB: 50, maxVideoFileMB: 2_048, maxDocumentFileMB: 100, maxMediaFileCount: 500_000, monthlyUploadMB: 200_000,
      advancedReports: true, whatsappAutomation: true, commissionRate: 0,
      maxAIGenerationsPerMonth: 5_000, maxAIImagesAnalyzedPerMonth: 2_000, maxAIProductsImportedPerMonth: 100_000, aiEstimatedCostCapXOF: null,
      features: ["premium_site", "template_customization", "orders", "customer_requests", "cod_payment", "manual_mobile_money", "custom_domain", "business_management", "invoices", "statistics", "ai_quota", "advanced_management", "automations", "priority_support", "advanced_reports", "multi_establishment", "integrations", "dedicated_onboarding"],
    },
  ];
  // Une base créée avant octobre 2026 appelait « Sur mesure » « Entreprise ».
  await prisma.subscriptionPlan.updateMany({ where: { name: "Entreprise" }, data: { name: "Sur mesure" } });
  const plans = await Promise.all(
    PLAN_DEFINITIONS.map((def) =>
      prisma.subscriptionPlan.upsert({ where: { name: def.name }, update: def, create: { ...def, status: "PUBLISHED" } }),
    ),
  );
  const essentiel = plans[0]!;
  console.info(`  ✓ ${plans.length} formules d'abonnement`);

  // ---------------------------------------------------------------------
  // 2. Rôles système globaux (tenantId = null)
  // ---------------------------------------------------------------------
  // Note : on évite volontairement `upsert` avec `tenantId: null` dans la clé composée
  // `tenantId_name` — Prisma type cette clé en `string` (non nullable) même si le champ
  // est nullable en base, ce qui la rend inutilisable ici. `findFirst` + create/update
  // contourne le problème et reste idempotent (renforcé par l'index unique partiel
  // `Role_global_name_unique` posé par la migration RLS).
  const roleByName = new Map<string, string>();
  for (const roleName of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({ where: { tenantId: null, name: roleName } });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { permissions: SYSTEM_ROLE_PERMISSIONS[roleName] },
        })
      : await prisma.role.create({
          data: {
            tenantId: null,
            name: roleName,
            isSystem: true,
            permissions: SYSTEM_ROLE_PERMISSIONS[roleName],
          },
        });
    roleByName.set(roleName, role.id);
  }
  console.info(`  ✓ ${SYSTEM_ROLES.length} rôles système globaux`);

  // ---------------------------------------------------------------------
  // 3. Super Admin
  // ---------------------------------------------------------------------
  const superAdminEmail = process.env.SUPERADMIN_SEED_EMAIL ?? "superadmin@yamacommerce.ai";
  const superAdminPassword = process.env.SUPERADMIN_SEED_PASSWORD ?? "ChangeMoi!2026";
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      fullName: "Super Administrateur Y-COM",
      passwordHash: await hashPassword(superAdminPassword),
      isSuperAdmin: true,
    },
  });
  console.info(`  ✓ Super Admin (${superAdminEmail})`);

  // ---------------------------------------------------------------------
  // 3bis. Registre secteurs / modules (voir docs/11-secteurs-et-modules.md)
  // ---------------------------------------------------------------------
  await seedSectorAndModuleRegistry();
  console.info(
    `  ✓ Registre secteurs/modules (${SECTORS.length} secteurs, ${MODULES.length} modules)`,
  );

  // ---------------------------------------------------------------------
  // 4. Deux entreprises de démonstration (pour les tests d'isolation)
  // ---------------------------------------------------------------------
  await seedDemoTenant({
    slug: "boutique-aida",
    name: "Boutique Aïda",
    businessType: "ECOMMERCE",
    sectorKey: "ecommerce",
    ownerEmail: "aida@boutique-aida.sn",
    ownerName: "Aïda Diop",
    planId: essentiel.id,
    ownerRoleId: roleByName.get("OWNER")!,
    product: { name: "Ensemble boubou brodé", price: 45_000, sku: "BA-BOUBOU-001" },
    customer: { firstName: "Fatou", lastName: "Ndiaye", phone: "+221771234567" },
  });

  await seedDemoTenant({
    slug: "teranga-auto",
    name: "Teranga Auto",
    businessType: "AUTOMOBILE",
    sectorKey: "automobile",
    ownerEmail: "contact@teranga-auto.sn",
    ownerName: "Moussa Fall",
    planId: essentiel.id,
    ownerRoleId: roleByName.get("OWNER")!,
    product: { name: "Toyota Corolla 2018 — révisée", price: 8_500_000, sku: "TA-COROLLA-2018" },
    customer: { firstName: "Cheikh", lastName: "Sarr", phone: "+221781234567" },
  });

  console.info("Seed terminé avec succès.");
}

/**
 * Registre des secteurs — reflète exactement docs/11-secteurs-et-modules.md §11.3
 * (10 secteurs système) + l'option « Autre activité » (§11.7.1, aucun module par défaut).
 */
const SECTORS: Array<{ key: string; name: string; defaultModuleKeys: string[] }> = [
  {
    key: "ecommerce",
    name: "Boutiques, commerçants et grossistes",
    defaultModuleKeys: ["catalog", "inventory", "delivery_zones", "wholesale_pricing"],
  },
  {
    key: "fashion",
    name: "Mode et vêtements",
    defaultModuleKeys: ["catalog", "inventory", "variants_advanced", "lookbook", "delivery_zones"],
  },
  {
    key: "restaurant",
    name: "Restauration",
    defaultModuleKeys: ["table_reservations", "qr_ordering", "delivery_zones"],
  },
  {
    key: "real_estate",
    name: "Immobilier",
    defaultModuleKeys: [
      "listings",
      "leases",
      "rent_collection",
      "property_maintenance",
      "visit_requests",
    ],
  },
  {
    key: "travel_agency",
    name: "Agences de voyage",
    defaultModuleKeys: ["listings", "departures", "visa_requests", "traveler_documents"],
  },
  {
    key: "automobile",
    name: "Automobile",
    defaultModuleKeys: ["listings", "import_tracking", "test_drive_appointments", "leads"],
  },
  {
    key: "hospitality",
    name: "Hôtels et locations",
    defaultModuleKeys: ["listings", "availability_calendar", "housekeeping"],
  },
  {
    key: "services",
    name: "Salons et prestataires de services",
    defaultModuleKeys: ["service_catalog", "appointments", "staff_availability"],
  },
  {
    key: "education",
    name: "Écoles et centres de formation",
    defaultModuleKeys: [
      "courses",
      "enrollments",
      "academic_tracking",
      "student_portal",
      "parent_portal",
    ],
  },
  {
    key: "delivery",
    name: "Services de livraison",
    defaultModuleKeys: ["dispatch", "delivery_zones", "deliverer_tracking", "cod_reconciliation"],
  },
  {
    key: "custom",
    name: "Autre activité",
    defaultModuleKeys: [], // composition manuelle — voir docs/11 §11.7.1
  },
];

/** Catalogue des modules — noyau (core) + sectoriels, voir docs/11 §11.2 et §11.4. */
const MODULES: Array<{
  key: string;
  name: string;
  category: "core" | "sector";
  sectorKeys: string[];
}> = [
  // Noyau commun
  { key: "auth", name: "Authentification", category: "core", sectorKeys: [] },
  { key: "businesses", name: "Gestion de l'entreprise", category: "core", sectorKeys: [] },
  { key: "customers", name: "Clients", category: "core", sectorKeys: [] },
  { key: "employees", name: "Employés, rôles et permissions", category: "core", sectorKeys: [] },
  { key: "payments", name: "Paiements", category: "core", sectorKeys: [] },
  { key: "invoicing", name: "Facturation", category: "core", sectorKeys: [] },
  { key: "emails", name: "E-mails", category: "core", sectorKeys: [] },
  { key: "whatsapp", name: "WhatsApp", category: "core", sectorKeys: [] },
  { key: "ai", name: "Intelligence artificielle", category: "core", sectorKeys: [] },
  { key: "subscriptions", name: "Abonnements", category: "core", sectorKeys: [] },
  { key: "domains", name: "Domaines et sous-domaines", category: "core", sectorKeys: [] },
  { key: "visual_editor", name: "Éditeur visuel", category: "core", sectorKeys: [] },
  { key: "files", name: "Gestion des fichiers", category: "core", sectorKeys: [] },
  { key: "analytics", name: "Analyses et rapports", category: "core", sectorKeys: [] },
  { key: "settings", name: "Paramètres généraux", category: "core", sectorKeys: [] },
  // E-commerce / mode / restauration
  {
    key: "catalog",
    name: "Catalogue",
    category: "sector",
    sectorKeys: ["ecommerce", "fashion", "restaurant"],
  },
  { key: "inventory", name: "Stock", category: "sector", sectorKeys: ["ecommerce", "fashion"] },
  {
    key: "delivery_zones",
    name: "Zones de livraison",
    category: "sector",
    sectorKeys: ["ecommerce", "fashion", "restaurant", "delivery"],
  },
  { key: "wholesale_pricing", name: "Prix de gros", category: "sector", sectorKeys: ["ecommerce"] },
  {
    key: "variants_advanced",
    name: "Variantes avancées",
    category: "sector",
    sectorKeys: ["fashion"],
  },
  { key: "lookbook", name: "Lookbook", category: "sector", sectorKeys: ["fashion"] },
  {
    key: "table_reservations",
    name: "Réservation de table",
    category: "sector",
    sectorKeys: ["restaurant"],
  },
  {
    key: "qr_ordering",
    name: "Commande par QR code",
    category: "sector",
    sectorKeys: ["restaurant"],
  },
  // Immobilier
  {
    key: "listings",
    name: "Annonces (biens/circuits/véhicules/chambres)",
    category: "sector",
    sectorKeys: ["real_estate", "travel_agency", "automobile", "hospitality"],
  },
  { key: "leases", name: "Baux", category: "sector", sectorKeys: ["real_estate"] },
  {
    key: "rent_collection",
    name: "Encaissement des loyers",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  {
    key: "property_maintenance",
    name: "Maintenance des biens",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  {
    key: "visit_requests",
    name: "Demandes de visite",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  // Voyage
  {
    key: "departures",
    name: "Calendrier des départs",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  {
    key: "visa_requests",
    name: "Demandes de visa",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  {
    key: "traveler_documents",
    name: "Documents voyageurs",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  // Automobile
  {
    key: "import_tracking",
    name: "Suivi d'importation",
    category: "sector",
    sectorKeys: ["automobile"],
  },
  {
    key: "test_drive_appointments",
    name: "Essais véhicule",
    category: "sector",
    sectorKeys: ["automobile"],
  },
  { key: "leads", name: "Prospects", category: "sector", sectorKeys: ["automobile"] },
  // Hôtellerie
  {
    key: "availability_calendar",
    name: "Calendrier de disponibilité",
    category: "sector",
    sectorKeys: ["hospitality"],
  },
  { key: "housekeeping", name: "Ménage", category: "sector", sectorKeys: ["hospitality"] },
  // Services
  {
    key: "service_catalog",
    name: "Catalogue de prestations",
    category: "sector",
    sectorKeys: ["services"],
  },
  {
    key: "appointments",
    name: "Rendez-vous",
    category: "sector",
    sectorKeys: ["services", "restaurant", "automobile", "hospitality"],
  },
  {
    key: "staff_availability",
    name: "Disponibilité des employés",
    category: "sector",
    sectorKeys: ["services"],
  },
  // Éducation
  { key: "courses", name: "Formations", category: "sector", sectorKeys: ["education"] },
  { key: "enrollments", name: "Inscriptions", category: "sector", sectorKeys: ["education"] },
  {
    key: "academic_tracking",
    name: "Suivi académique",
    category: "sector",
    sectorKeys: ["education"],
  },
  {
    key: "student_portal",
    name: "Portail étudiant",
    category: "sector",
    sectorKeys: ["education"],
  },
  { key: "parent_portal", name: "Portail parent", category: "sector", sectorKeys: ["education"] },
  // Livraison
  {
    key: "dispatch",
    name: "Répartition des courses",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  {
    key: "deliverer_tracking",
    name: "Suivi livreur",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  {
    key: "cod_reconciliation",
    name: "Réconciliation COD",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  // Transverse
  {
    key: "regulated_documents",
    name: "Documents réglementés",
    category: "sector",
    sectorKeys: ["services", "ecommerce", "travel_agency"],
  },
];

async function seedSectorAndModuleRegistry() {
  for (const moduleDef of MODULES) {
    await prisma.module.upsert({
      where: { key: moduleDef.key },
      update: {
        name: moduleDef.name,
        category: moduleDef.category,
        sectorKeys: moduleDef.sectorKeys,
      },
      create: moduleDef,
    });
  }

  // Secteurs livrés et testés de bout en bout — les seuls proposés à la création
  // d'entreprise (les autres sont affichés « À venir »). Tenu à jour à chaque secteur livré.
  const OPERATIONAL_SECTOR_KEYS: string[] = ["ecommerce", "fashion", "real_estate", "travel_agency", "services", "hospitality", "restaurant", "automobile", "education", "delivery"];
  for (const sectorDef of SECTORS) {
    await prisma.sector.upsert({
      where: { key: sectorDef.key },
      update: { name: sectorDef.name, defaultModuleKeys: sectorDef.defaultModuleKeys, isAvailable: OPERATIONAL_SECTOR_KEYS.includes(sectorDef.key) },
      create: {
        key: sectorDef.key,
        name: sectorDef.name,
        defaultModuleKeys: sectorDef.defaultModuleKeys,
        isSystem: true,
        isAvailable: OPERATIONAL_SECTOR_KEYS.includes(sectorDef.key),
      },
    });
  }
}

async function seedDemoTenant(input: {
  slug: string;
  name: string;
  businessType: "ECOMMERCE" | "AUTOMOBILE";
  sectorKey: string;
  ownerEmail: string;
  ownerName: string;
  planId: string;
  ownerRoleId: string;
  product: { name: string; price: number; sku: string };
  customer: { firstName: string; lastName: string; phone: string };
}) {
  // Entreprises de DÉMONSTRATION : jamais en production sans autorisation explicite,
  // et jamais par-dessus une entreprise réelle qui aurait le même sous-domaine.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.info(`  – ${input.slug} : démonstration non créée en production`);
    return;
  }
  const already = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug: input.slug }, select: { isDemo: true } }));
  if (already && !already.isDemo) {
    console.warn(`  ! ${input.slug} est une entreprise réelle : aucune donnée de démonstration ajoutée`);
    return;
  }
  // La création d'un tenant et son provisionnement initial (domaine, abonnement,
  // rattachement du propriétaire, moyens de paiement) sont des opérations Super Admin
  // par nature (voir docs/02-architecture-fonctionnelle.md §2.3) : sous Row-Level
  // Security, elles exigent donc explicitement un accès élevé — jamais le contexte
  // tenant par défaut, qui n'existe d'ailleurs pas encore puisque le tenant n'existe pas.
  const ownerUser = await prisma.user.upsert({
    where: { email: input.ownerEmail },
    update: {},
    create: {
      email: input.ownerEmail,
      fullName: input.ownerName,
      passwordHash: await hashPassword("Demo!2026"),
    },
  });

  const tenant = await withSuperAdminAccess(async (tx) => {
    const createdTenant = await tx.tenant.upsert({
      where: { slug: input.slug },
      update: {},
      create: {
        slug: input.slug,
        name: input.name,
        businessType: input.businessType,
        sectorKey: input.sectorKey,
        status: "ACTIVE",
        isDemo: true,
        branding: { primaryColor: "#0F766E", secondaryColor: "#F59E0B", defaultMode: "light" },
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Active les modules par défaut du secteur choisi — voir docs/11 §11.6.
    await activateSectorDefaults(tx, createdTenant.id, input.sectorKey);

    // Même suffixe que les autres démos (prévisualisation : sous-domaine du serveur).
    const subdomain = `${input.slug}.${process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai"}`;
    await tx.domain.upsert({
      where: { domain: subdomain },
      update: {},
      create: {
        tenantId: createdTenant.id,
        domain: subdomain,
        type: "subdomain",
        isPrimary: true,
        serveDirectlyWhenNotPrimary: true,
        lifecycleStatus: "ACTIVE",
        dnsProvider: "caddy",
      },
    });

    await tx.tenantSubscription.upsert({
      where: { tenantId: createdTenant.id },
      update: {},
      create: {
        tenantId: createdTenant.id,
        planId: input.planId,
        status: "TRIALING",
        billingCycle: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: createdTenant.id, userId: ownerUser.id } },
      update: {},
      create: {
        tenantId: createdTenant.id,
        userId: ownerUser.id,
        roleId: input.ownerRoleId,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId: createdTenant.id, provider: "cod" } },
      update: {},
      create: { tenantId: createdTenant.id, provider: "cod", isEnabled: true, mode: "sandbox" },
    });
    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId: createdTenant.id, provider: "paydunya" } },
      update: {},
      create: {
        tenantId: createdTenant.id,
        provider: "paydunya",
        isEnabled: false,
        mode: "sandbox",
      },
    });

    return createdTenant;
  });

  // Relance du seed : les données de démonstration de ce tenant existent déjà (sa
  // boutique principale en est la marque) — ne rien recréer, le seed reste idempotent.
  if (await withTenant(tenant.id, (tx) => tx.shop.count({ where: { tenantId: tenant.id, isMain: true } }))) return;

  // Le reste des écritures scoped-tenant passe par withTenant() pour exercer, dès le
  // seed, le même chemin que le code applicatif (contexte RLS posé correctement).
  await withTenant(tenant.id, async (tx) => {
    const shop = await tx.shop.create({
      data: { tenantId: tenant.id, name: `${input.name} — Boutique principale`, isMain: true },
    });

    const category = await tx.category.create({
      data: { tenantId: tenant.id, name: "Général", slug: "general" },
    });

    const product = await tx.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: input.product.name,
        slug: input.product.sku.toLowerCase(),
        description: `${input.product.name} — produit de démonstration.`,
        shortDescription: input.product.name,
        sku: input.product.sku,
        status: "PUBLISHED",
        basePrice: input.product.price,
        tags: ["demo"],
      },
    });

    const variant = await tx.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        name: "Standard",
        sku: `${input.product.sku}-STD`,
        price: input.product.price,
        attributes: {},
      },
    });

    await tx.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        productVariantId: variant.id,
        shopId: shop.id,
        availableQuantity: 10,
        lowStockThreshold: 2,
      },
    });

    const customer = await tx.customer.create({
      data: {
        tenantId: tenant.id,
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        customerGroup: "retail",
      },
    });

    const fiscalYear = new Date().getFullYear();
    const orderSeq = await nextCounterValue(tx, tenant.id, `order-${fiscalYear}`);
    const order = await tx.order.create({
      data: {
        tenantId: tenant.id,
        shopId: shop.id,
        customerId: customer.id,
        orderNumber: formatOrderNumber(fiscalYear, orderSeq),
        status: "DELIVERED",
        channel: "web",
        paymentStatus: "PAID",
        subtotal: input.product.price,
        total: input.product.price,
        items: {
          create: {
            tenantId: tenant.id,
            productVariantId: variant.id,
            productNameSnapshot: input.product.name,
            unitPrice: input.product.price,
            quantity: 1,
            total: input.product.price,
          },
        },
        statusHistory: {
          create: {
            tenantId: tenant.id,
            toStatus: "DELIVERED",
            changedByType: "system",
            note: "Commande de démonstration",
          },
        },
      },
    });

    const payment = await tx.payment.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        provider: "cod",
        idempotencyKey: `seed-${order.id}`,
        amount: input.product.price,
        status: "SUCCEEDED",
        type: "full",
        verifiedAt: new Date(),
        reconciliationStatus: "matched",
        reconciledAt: new Date(),
      },
    });

    const invoiceSeq = await nextCounterValue(tx, tenant.id, `invoice-${fiscalYear}`);
    await tx.invoice.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        number: formatInvoiceNumber(fiscalYear, invoiceSeq),
        fiscalYear,
        type: "invoice",
        status: "finalized",
        customerSnapshot: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        },
        itemsSnapshot: [
          {
            name: input.product.name,
            quantity: 1,
            unitPrice: input.product.price,
            total: input.product.price,
          },
        ],
        subtotal: input.product.price,
        taxTotal: 0,
        total: input.product.price,
        paymentStatus: "PAID",
        qrCodeToken: `seed-${order.id}-${payment.id}`,
        finalizedAt: new Date(),
      },
    });
  });

  console.info(`  ✓ Entreprise de démonstration "${input.name}" (${input.slug})`);
}

main()
  .catch((error) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
