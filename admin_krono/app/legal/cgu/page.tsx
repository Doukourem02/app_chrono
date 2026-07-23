import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Krono",
  description: "Conditions générales d'utilisation du service Krono.",
};

export default function CguPage() {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 sm:p-10">
      <p className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Document type à adapter à votre activité et à faire valider par un conseil si besoin.
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
        Conditions générales d&apos;utilisation
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : avril 2026</p>

      <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-zinc-700">
        <h2 className="text-lg font-medium text-zinc-900">1. Objet</h2>
        <p>
          Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
          l&apos;utilisation de l&apos;application mobile <strong>Krono</strong> et des services
          associés de mise en relation pour des prestations de livraison ou de transport de biens,
          proposés par l&apos;éditeur du service.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">2. Acceptation</h2>
        <p>
          En créant un compte ou en utilisant l&apos;application, vous acceptez sans réserve les
          présentes CGU et la{" "}
          <Link href="/legal/confidentialite" className="text-violet-600 underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">3. Compte et accès</h2>
        <p>
          Vous vous engagez à fournir des informations exactes et à préserver la confidentialité de
          vos identifiants. Toute utilisation de votre compte est réputée faite par vous.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">4. Services</h2>
        <p>
          Krono permet notamment de passer des demandes de course / livraison et de suivre leur
          statut. Les délais, zones desservies et modalités pratiques peuvent varier ; l&apos;éditeur
          s&apos;efforce d&apos;assurer la disponibilité du service sans garantie de résultat
          permanente.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">5. Tarification et paiement</h2>
        <p>
          Les prix applicables sont ceux affichés au moment de la commande ou ceux convenus dans
          l&apos;application. Toute réclamation doit être formulée selon les canaux indiqués dans
          l&apos;app ou sur le site support.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">6. Responsabilité</h2>
        <p>
          Dans les limites autorisées par la loi, la responsabilité de l&apos;éditeur ne saurait
          être engagée pour des dommages indirects ou pour des indisponibilités liées à des tiers
          (réseaux, hébergeurs, prestataires de cartographie, etc.).
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">7. Modification des CGU</h2>
        <p>
          Les CGU peuvent être mises à jour ; la date de dernière mise à jour figure en tête de ce
          document. L&apos;utilisation continue du service vaut acceptation des CGU en vigueur.
        </p>

        <h2 className="pt-4 text-lg font-medium text-zinc-900">8. Contact</h2>
        <p>
          Pour toute question relative aux présentes CGU : indiquez ici l&apos;adresse e-mail ou le
          formulaire de contact support de votre entreprise.
        </p>
      </section>
    </article>
  );
}
