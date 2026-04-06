import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Krono",
  description: "Politique de confidentialité et traitement des données personnelles — Krono.",
};

export default function ConfidentialitePage() {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 sm:p-10">
      <p className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Document type à compléter (identité du responsable, base légale, durées, sous-traitants,
        pays) et à faire valider pour être conforme au RGPD et aux exigences des stores.
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : avril 2026</p>

      <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-zinc-700">
        <h2 className="text-lg font-medium text-zinc-900">1. Responsable du traitement</h2>
        <p>
          Indiquez ici la dénomination sociale, l&apos;adresse et le contact (DPO le cas échéant) du
          responsable du traitement des données personnelles collectées via Krono.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">2. Données collectées</h2>
        <p>
          Sont notamment concernés : identité, coordonnées (téléphone, e-mail), données de
          géolocalisation lorsque vous utilisez les fonctions de carte et de suivi de course,
          données relatives aux commandes et au paiement, données techniques (logs, identifiant
          d&apos;appareil) et contenus que vous transmettez via l&apos;application.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">3. Finalités</h2>
        <p>
          Les données sont utilisées pour fournir le service (mise en relation, exécution des
          livraisons, facturation), assurer la sécurité, améliorer l&apos;application, respecter les
          obligations légales et, avec votre consentement le cas échéant, vous adresser des
          communications.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">4. Bases légales</h2>
        <p>
          Exécution du contrat, intérêt légitime (sécurité, amélioration du service), obligation
          légale, consentement lorsque la réglementation l&apos;exige (ex. certaines notifications).
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">5. Destinataires et sous-traitants</h2>
        <p>
          Les données peuvent être transmises à des prestataires techniques (hébergement,
          authentification, cartographie, analytique, messagerie) dans le strict cadre de leurs
          missions et sous contrat conforme au RGPD. Listez ici vos principaux sous-traitants et
          liens vers leurs politiques si nécessaire.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">6. Durée de conservation</h2>
        <p>
          Précisez les durées ou critères de conservation par type de données (compte actif,
          obligations comptables, litiges, etc.).
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">7. Transferts hors UE</h2>
        <p>
          Si des données sont hébergées ou traitées hors de l&apos;Espace économique européen,
          indiquez les garanties appropriées (clauses types, décision d&apos;adéquation, etc.).
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">8. Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation, d&apos;opposition, de portabilité et du droit de
          définir des directives post-mortem. Vous pouvez introduire une réclamation auprès de
          l&apos;autorité de protection des données compétente.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">9. Cookies et traceurs</h2>
        <p>
          Si une version web collecte des traceurs, décrivez-les et renvoyez vers une bannière de
          consentement le cas échéant.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">10. Contact</h2>
        <p>
          Pour exercer vos droits ou poser une question : indiquez l&apos;e-mail ou le formulaire
          dédié.
        </p>

        <p className="pt-6 text-sm text-zinc-500">
          Voir aussi les{" "}
          <Link href="/legal/cgu" className="text-violet-600 underline underline-offset-2">
            conditions générales d&apos;utilisation
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
