"use client";

import React from "react";

interface GoogleMapsDeletedProjectErrorProps {
  className?: string;
  style?: React.CSSProperties;
}

export function GoogleMapsDeletedProjectError({
  className,
  style,
}: GoogleMapsDeletedProjectErrorProps) {
  const containerStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "24px",
    maxWidth: "600px",
    margin: "0 auto",
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: "bold",
    marginBottom: "16px",
    color: "#EF4444",
    fontSize: "18px",
  };

  const textStyle: React.CSSProperties = {
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#374151",
    marginBottom: "12px",
  };

  const listStyle: React.CSSProperties = {
    textAlign: "left",
    margin: "16px 0",
    paddingLeft: "24px",
    fontSize: "13px",
    lineHeight: "1.8",
    color: "#4B5563",
  };

  const linkStyle: React.CSSProperties = {
    color: "#2563eb",
    textDecoration: "underline",
    fontSize: "14px",
    fontWeight: "500",
    display: "inline-block",
    marginTop: "8px",
    marginRight: "16px",
  };

  const stepTitleStyle: React.CSSProperties = {
    fontWeight: "600",
    color: "#1F2937",
    marginTop: "12px",
    marginBottom: "8px",
  };

  const warningBoxStyle: React.CSSProperties = {
    marginTop: "20px",
    padding: "16px",
    backgroundColor: "#FEF3C7",
    border: "1px solid #FCD34D",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#92400E",
  };

  return (
    <div style={containerStyle} className={className}>
      <p style={titleStyle}>🚫 Projet Google Cloud supprimé ou désactivé</p>

      <p style={textStyle}>
        L&apos;erreur{" "}
        <code
          style={{
            backgroundColor: "#F3F4F6",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          DeletedApiProjectMapError
        </code>{" "}
        indique que le projet Google Cloud associé à votre clé API a été
        supprimé ou désactivé.
      </p>

      <div style={warningBoxStyle}>
        <strong style={{ display: "block", marginBottom: "8px" }}>
          ⚠️ Action requise :
        </strong>
        Vous devez créer un nouveau projet Google Cloud ou restaurer le projet
        existant, puis générer une nouvelle clé API.
      </div>

      <ol style={listStyle}>
        <li>
          <strong style={stepTitleStyle}>
            Créer un nouveau projet Google Cloud :
          </strong>
          <br />
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              Allez sur{" "}
              <a
                href="https://console.cloud.google.com/projectcreate"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Google Cloud Console
              </a>
            </li>
            <li>Créez un nouveau projet ou sélectionnez un projet existant</li>
            <li>Notez le nom et l&apos;ID du projet</li>
          </ul>
        </li>
        <li>
          <strong style={stepTitleStyle}>Activer les APIs nécessaires :</strong>
          <br />
          Dans votre projet, activez les APIs suivantes :
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Maps JavaScript API</li>
            <li>Places API</li>
            <li>Geocoding API (optionnel mais recommandé)</li>
          </ul>
        </li>
        <li>
          <strong style={stepTitleStyle}>
            Lier le projet à un compte de facturation :
          </strong>
          <br />
          Assurez-vous que votre projet est lié à un compte de facturation
          actif.
        </li>
        <li>
          <strong style={stepTitleStyle}>Créer une nouvelle clé API :</strong>
          <br />
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              Allez dans &quot;APIs &amp; Services&quot; →
              &quot;Credentials&quot;
            </li>
            <li>
              Cliquez sur &quot;Create Credentials&quot; → &quot;API Key&quot;
            </li>
            <li>Copiez la nouvelle clé API</li>
            <li>
              Configurez les restrictions d&apos;API (Maps JavaScript API,
              Places API)
            </li>
            <li>
              Configurez les restrictions d&apos;application (domaines
              autorisés)
            </li>
          </ul>
        </li>
        <li>
          <strong style={stepTitleStyle}>
            Mettre à jour votre fichier .env.local :
          </strong>
          <br />
          Remplacez l&apos;ancienne clé API par la nouvelle dans votre fichier{" "}
          <code
            style={{
              backgroundColor: "#F3F4F6",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            .env.local
          </code>{" "}
          :
          <pre
            style={{
              backgroundColor: "#F3F4F6",
              padding: "12px",
              borderRadius: "6px",
              fontSize: "12px",
              marginTop: "8px",
              overflow: "auto",
              textAlign: "left",
            }}
          >
            {`NEXT_PUBLIC_GOOGLE_API_KEY=votre_nouvelle_cle_api_ici`}
          </pre>
        </li>
        <li>
          <strong style={stepTitleStyle}>
            Redémarrer le serveur de développement :
          </strong>
          <br />
          Après avoir modifié le fichier{" "}
          <code
            style={{
              backgroundColor: "#F3F4F6",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            .env.local
          </code>
          , redémarrez votre serveur Next.js.
        </li>
      </ol>

      <div style={{ marginTop: "20px" }}>
        <a
          href="https://console.cloud.google.com/projectcreate"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          🆕 Créer un projet →
        </a>
        <a
          href="https://console.cloud.google.com/google/maps-apis/apis"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          🔧 Activer les APIs →
        </a>
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          🔑 Créer une clé API →
        </a>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          backgroundColor: "#F3F4F6",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#6B7280",
        }}
      >
        <strong
          style={{ display: "block", marginBottom: "8px", color: "#374151" }}
        >
          💡 Note importante :
        </strong>
        Si vous avez accidentellement supprimé votre projet, vous pouvez essayer
        de le restaurer dans les 30 jours via
        <a
          href="https://console.cloud.google.com/iam-admin/settings"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            marginLeft: "4px",
          }}
        >
          les paramètres IAM
        </a>
        .
      </div>
    </div>
  );
}
