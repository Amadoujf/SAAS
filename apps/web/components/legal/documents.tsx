import Link from "next/link";
import type { LegalContext, PlatformLegal, TenantLegal } from "@/lib/legal/legal-context";
import { tenantContact } from "@/lib/legal/legal-context";
import { LegalFacts, LegalSection, LegalText } from "./legal-page";

/**
 * Textes des pages légales. Modèles génériques, rédigés pour le Sénégal, À FAIRE
 * VALIDER par un professionnel du droit avant l'ouverture au public (voir docs/20).
 * Deux versions : la plateforme (éditeur, conditions d'utilisation pour les
 * entreprises) et le site de chaque entreprise (vendeur, conditions de vente).
 */

const mail = (v: string | null) => (v ? <a href={`mailto:${v}`}>{v}</a> : null);

function publisherFacts(p: PlatformLegal): [string, string | null | JSX.Element][] {
  return [
    ["Raison sociale", p.legalName],
    ["Forme juridique", p.legalForm],
    ["Adresse", p.address],
    ["NINEA", p.ninea],
    ["RCCM", p.rccm],
    ["E-mail", mail(p.email)],
    ["Téléphone", p.phone],
    ["Responsable de la publication", p.director],
  ];
}

function sellerFacts(t: TenantLegal): [string, string | null | JSX.Element][] {
  const c = tenantContact(t);
  return [
    ["Nom ou raison sociale", c.name],
    ["Forme juridique", t.profile.legalForm],
    ["Adresse", c.address],
    ["NINEA", t.profile.ninea],
    ["RCCM", t.profile.rccm],
    ["E-mail", mail(c.email)],
    ["Téléphone", c.phone],
    ["Responsable de la publication", t.profile.publicationDirector],
  ];
}

function contactLine(ctx: LegalContext) {
  if (ctx.kind === "tenant") {
    const c = tenantContact(ctx.tenant);
    const ways = [c.email && <a key="m" href={`mailto:${c.email}`}>{c.email}</a>, c.phone && <span key="p">{c.phone}</span>].filter(Boolean);
    return ways.length ? <>{ways.map((w, i) => <span key={i}>{i > 0 && " ou "}{w}</span>)}</> : <>les coordonnées indiquées sur le site</>;
  }
  return ctx.platform.email ? <a href={`mailto:${ctx.platform.email}`}>{ctx.platform.email}</a> : <>les coordonnées indiquées ci-dessus</>;
}

/* ------------------------------------------------------------------ Mentions légales */

export function LegalNotice({ ctx }: { ctx: LegalContext }) {
  const p = ctx.platform;
  if (ctx.kind === "tenant") {
    return (
      <>
        <LegalSection title="Éditeur du site">
          <p>Ce site est édité par l&apos;entreprise suivante, seule responsable de son contenu, de ses prix et de ses ventes :</p>
          <LegalFacts items={sellerFacts(ctx.tenant)} />
        </LegalSection>
        <LegalSection title="Solution technique et hébergement">
          <p>Le site est réalisé avec la solution {p.brand}{p.legalName ? <>, éditée par {p.legalName}</> : null}, qui fournit l&apos;outil technique sans être partie aux ventes.</p>
          <p>Hébergement des serveurs : {p.hosting}.</p>
        </LegalSection>
        <LegalSection title="Propriété intellectuelle">
          <p>Les textes, photographies, logos et marques présentés sur ce site appartiennent à l&apos;entreprise ou à leurs auteurs. Toute reproduction sans autorisation est interdite.</p>
        </LegalSection>
        <LegalSection title="Nous contacter">
          <p>Pour toute question : {contactLine(ctx)}.</p>
        </LegalSection>
      </>
    );
  }
  return (
    <>
      <LegalSection title="Éditeur">
        <LegalFacts items={publisherFacts(p)} />
      </LegalSection>
      <LegalSection title="Hébergement">
        <p>{p.hosting}.</p>
      </LegalSection>
      <LegalSection title="Sites des entreprises">
        <p>Chaque entreprise qui utilise {p.brand} est éditrice de son propre site et seule responsable de son contenu, de ses prix et de ses ventes. Ses informations figurent sur la page « Mentions légales » de son site.</p>
      </LegalSection>
      <LegalSection title="Propriété intellectuelle">
        <p>La marque {p.brand}, le logiciel, les modèles de sites et les contenus de ce site sont protégés. Toute reproduction sans autorisation est interdite.</p>
      </LegalSection>
    </>
  );
}

/* --------------------------------------------------------------- Conditions générales */

export function Terms({ ctx }: { ctx: LegalContext }) {
  const p = ctx.platform;
  if (ctx.kind === "tenant") {
    const t = ctx.tenant;
    const seller = tenantContact(t).name;
    return (
      <>
        <LegalSection title="1. Objet">
          <p>Les présentes conditions régissent les commandes, réservations et demandes passées sur le site de {seller} (le « vendeur »), identifié dans les <Link href="/mentions-legales">mentions légales</Link>. Passer une commande ou une réservation vaut acceptation de ces conditions.</p>
        </LegalSection>
        <LegalSection title="2. Commandes et réservations">
          <p>Avant validation, un récapitulatif indique les articles ou prestations, les quantités, les dates éventuelles et le prix total. Après validation, vous recevez un numéro et un lien de suivi. Le vendeur peut refuser une commande en cas d&apos;indisponibilité ou d&apos;informations manifestement erronées ; vous en êtes alors informé.</p>
        </LegalSection>
        <LegalSection title="3. Prix">
          <p>Les prix sont indiqués en francs CFA (FCFA). Le prix applicable est celui affiché au moment de la commande ; il est recalculé par le serveur du vendeur, jamais imposé par le navigateur. Les frais de livraison éventuels sont indiqués avant la validation.</p>
        </LegalSection>
        <LegalSection title="4. Paiement">
          <p>Les moyens de paiement proposés sont ceux affichés lors de la commande : paiement à la livraison, sur place, ou par transfert Wave ou Orange Money vers le compte du vendeur.</p>
          <p>Une commande payée par transfert n&apos;est considérée comme payée qu&apos;après confirmation, par le vendeur, de la réception des fonds. Tant que ce n&apos;est pas le cas, elle reste « en attente de paiement » et peut expirer à l&apos;issue du délai indiqué.</p>
        </LegalSection>
        <LegalSection title="5. Livraison, retrait et exécution">
          <p>Les zones, délais et conditions de livraison ou de retrait sont indiqués lors de la commande. Les délais sont donnés à titre indicatif ; en cas de retard important, le vendeur vous prévient. Vérifiez votre commande à la réception et signalez sans attendre tout article manquant ou endommagé.</p>
        </LegalSection>
        <LegalSection title="6. Retours, échanges et annulations">
          {t.profile.returnPolicy ? <LegalText text={t.profile.returnPolicy} /> : <p>Pour toute demande de retour, d&apos;échange ou d&apos;annulation, contactez le vendeur : {contactLine(ctx)}. Les conditions applicables vous sont alors précisées.</p>}
        </LegalSection>
        <LegalSection title="7. Réclamations">
          <p>Toute réclamation peut être adressée au vendeur : {contactLine(ctx)}. Une solution amiable est recherchée en priorité.</p>
        </LegalSection>
        <LegalSection title="8. Données personnelles">
          <p>Les informations fournies servent à traiter votre commande ou réservation. Voir la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
        </LegalSection>
        <LegalSection title={`9. Rôle de ${p.brand}`}>
          <p>{p.brand} fournit au vendeur la solution technique de ce site. {p.brand} n&apos;est pas partie à la vente : le vendeur reste seul responsable de ses produits, de ses prestations, de ses prix et de l&apos;exécution des commandes.</p>
        </LegalSection>
        <LegalSection title="10. Droit applicable">
          <p>Les présentes conditions sont soumises au droit sénégalais. À défaut d&apos;accord amiable, le litige est porté devant les juridictions compétentes du Sénégal.</p>
        </LegalSection>
        {t.profile.additionalTerms && (
          <LegalSection title="11. Conditions particulières du vendeur">
            <LegalText text={t.profile.additionalTerms} />
          </LegalSection>
        )}
      </>
    );
  }
  return (
    <>
      <LegalSection title="1. Objet">
        <p>Les présentes conditions régissent l&apos;utilisation de {p.brand} par les entreprises qui y créent leur site et y gèrent leur activité (l&apos;« entreprise »). Créer un compte vaut acceptation de ces conditions.</p>
      </LegalSection>
      <LegalSection title="2. Compte et accès">
        <p>L&apos;entreprise fournit des informations exactes et protège ses identifiants. Elle choisit les membres de son équipe et leurs droits ; elle reste responsable des actions effectuées depuis son compte.</p>
      </LegalSection>
      <LegalSection title="3. Formules et paiement de l'abonnement">
        <p>Les fonctionnalités, quotas et prix de chaque formule sont indiqués sur la page des tarifs. L&apos;abonnement est réglé par l&apos;intermédiaire de notre prestataire de paiement d&apos;abonnements. Un abonnement impayé peut entraîner, après information, la suspension de l&apos;accès et du site public.</p>
      </LegalSection>
      <LegalSection title="4. Responsabilités de l'entreprise">
        <ul>
          <li>Elle est l&apos;éditrice de son site et la vendeuse de ses produits et prestations ;</li>
          <li>elle publie des contenus licites, des prix exacts et ses informations légales ;</li>
          <li>elle exécute les commandes et réservations, et confirme elle-même la réception des paiements ;</li>
          <li>elle respecte les droits de ses clients, notamment sur leurs données personnelles.</li>
        </ul>
      </LegalSection>
      <LegalSection title={`5. Engagements de ${p.brand}`}>
        <p>{p.brand} met en œuvre les moyens raisonnables pour assurer la disponibilité, la sécurité et la sauvegarde du service : séparation stricte des données entre entreprises, connexions chiffrées, sauvegardes chiffrées hors du serveur. Des interruptions ponctuelles peuvent survenir pour maintenance ou incident. {p.brand} n&apos;est pas partie aux ventes des entreprises.</p>
      </LegalSection>
      <LegalSection title="6. Assistant de création par intelligence artificielle">
        <p>Les propositions de l&apos;assistant (structure, textes, styles) sont des suggestions à vérifier par l&apos;entreprise avant publication. Leur usage est limité par les quotas de la formule.</p>
      </LegalSection>
      <LegalSection title="7. Données">
        <p>L&apos;entreprise reste propriétaire de ses contenus et des données de ses clients ; elle en est responsable du traitement. {p.brand} les traite pour son compte, uniquement pour fournir le service. Voir la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
      </LegalSection>
      <LegalSection title="8. Suspension et résiliation">
        <p>L&apos;entreprise peut cesser d&apos;utiliser le service à tout moment. {p.brand} peut suspendre un compte en cas de manquement grave à ces conditions (contenus illicites, fraude), après information sauf urgence.</p>
      </LegalSection>
      <LegalSection title="9. Droit applicable">
        <p>Les présentes conditions sont soumises au droit sénégalais. À défaut d&apos;accord amiable, le litige est porté devant les juridictions compétentes du Sénégal.</p>
      </LegalSection>
    </>
  );
}

/* ---------------------------------------------------------- Politique de confidentialité */

const RIGHTS = (
  <>
    <p>Conformément à la loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression de vos données.</p>
  </>
);

const COOKIES = (
  <p>Le site utilise uniquement des cookies et un stockage dans votre navigateur nécessaires à son fonctionnement : votre panier, votre session de connexion et, le cas échéant, l&apos;accès à une version de prévisualisation. Aucun cookie publicitaire ni de mesure d&apos;audience n&apos;est déposé.</p>
);

export function Privacy({ ctx }: { ctx: LegalContext }) {
  const p = ctx.platform;
  const security = (
    <p>Les échanges sont chiffrés (HTTPS). Les données de chaque entreprise sont strictement séparées de celles des autres, les accès sont limités aux personnes habilitées et les sauvegardes sont chiffrées. Les serveurs sont hébergés par {p.hosting} : vos données sont donc stockées hors du Sénégal, dans l&apos;Union européenne.</p>
  );
  if (ctx.kind === "tenant") {
    const seller = tenantContact(ctx.tenant).name;
    return (
      <>
        <LegalSection title="Responsable du traitement">
          <p>{seller}, identifié dans les <Link href="/mentions-legales">mentions légales</Link>, est responsable des données collectées sur ce site. {p.brand} les traite pour son compte, comme prestataire technique.</p>
        </LegalSection>
        <LegalSection title="Données collectées">
          <ul>
            <li>vos coordonnées : nom, téléphone, e-mail ;</li>
            <li>votre adresse de livraison, si vous en indiquez une ;</li>
            <li>le contenu de vos commandes, réservations ou demandes, et leur suivi ;</li>
            <li>les justificatifs de paiement que vous envoyez, le cas échéant.</li>
          </ul>
        </LegalSection>
        <LegalSection title="Utilisation">
          <p>Ces données servent à traiter et livrer vos commandes ou réservations, vous en informer, répondre à vos demandes et respecter les obligations comptables. Elles ne sont jamais vendues.</p>
        </LegalSection>
        <LegalSection title="Destinataires">
          <p>Le vendeur et son personnel habilité, le livreur pour une livraison, et les prestataires techniques nécessaires au service (hébergement, envoi des messages de suivi).</p>
        </LegalSection>
        <LegalSection title="Durée de conservation">
          <p>Les données sont conservées le temps de la relation commerciale, puis archivées pendant la durée imposée par les obligations comptables et fiscales.</p>
        </LegalSection>
        <LegalSection title="Sécurité">{security}</LegalSection>
        <LegalSection title="Cookies">{COOKIES}</LegalSection>
        <LegalSection title="Vos droits">
          {RIGHTS}
          <p>Pour les exercer, contactez le vendeur : {contactLine(ctx)}. Vous pouvez aussi saisir la Commission de protection des données personnelles (CDP).</p>
        </LegalSection>
      </>
    );
  }
  return (
    <>
      <LegalSection title="Responsable du traitement">
        <p>{p.legalName ?? p.brand} est responsable des données des comptes créés sur {p.brand}. Pour les données des clients d&apos;une entreprise, c&apos;est l&apos;entreprise qui en est responsable ; {p.brand} les traite pour son compte (voir la politique de confidentialité de son site).</p>
      </LegalSection>
      <LegalSection title="Données collectées">
        <ul>
          <li>compte : nom, e-mail, téléphone ; le mot de passe n&apos;est jamais conservé en clair ;</li>
          <li>entreprise : nom, secteur, informations légales, contenus du site ;</li>
          <li>abonnement : formule et état des paiements (les données de carte ou de portefeuille sont traitées par le prestataire de paiement, jamais par {p.brand}) ;</li>
          <li>assistant de création : les descriptions et demandes saisies, envoyées au fournisseur d&apos;intelligence artificielle pour générer les propositions ;</li>
          <li>journaux techniques et de sécurité.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Utilisation">
        <p>Fournir et sécuriser le service, gérer les abonnements, envoyer les messages liés au compte, assister les entreprises. Les données ne sont jamais vendues.</p>
      </LegalSection>
      <LegalSection title="Prestataires">
        <p>Hébergement ({p.hosting}), paiement des abonnements, envoi des e-mails, fournisseur d&apos;intelligence artificielle pour l&apos;assistant. Chacun ne reçoit que ce qui est nécessaire à sa mission.</p>
      </LegalSection>
      <LegalSection title="Durée de conservation">
        <p>Le temps de l&apos;utilisation du service, puis la durée imposée par les obligations légales, comptables et fiscales.</p>
      </LegalSection>
      <LegalSection title="Sécurité">{security}</LegalSection>
      <LegalSection title="Cookies">{COOKIES}</LegalSection>
      <LegalSection title="Vos droits">
        {RIGHTS}
        <p>Pour les exercer : {contactLine(ctx)}. Vous pouvez aussi saisir la Commission de protection des données personnelles (CDP).</p>
      </LegalSection>
    </>
  );
}
