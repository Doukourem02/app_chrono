"use client";

import React from "react";

interface GoogleMapsBillingErrorProps {
  className?: string;
  style?: React.CSSProperties;
}

export function GoogleMapsBillingError({
  className,
  style,
}: GoogleMapsBillingErrorProps) {
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

  return (
    <div style={containerStyle} className={className}>
      <p style={titleStyle}>⚠️ Erreur de facturation Google Maps</p>

      <p style={textStyle}>
        Même si vous avez déjà configuré un compte de facturation, cette erreur
        peut survenir si :
      </p>

      <ol style={listStyle}>
        <li>
          <strong style={stepTitleStyle}>
            Les APIs ne sont pas activées :
          </strong>
          <br />
          Vous devez activer les APIs suivantes dans Google Cloud Console :
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>Maps JavaScript API</li>
            <li>Places API</li>
            <li>Geocoding API (optionnel mais recommandé)</li>
          </ul>
        </li>
        <li>
          <strong style={stepTitleStyle}>
            Le projet n&apos;est pas lié au compte de facturation :
          </strong>
          <br />
          Assurez-vous que votre projet Google Cloud est bien associé à votre
          compte de facturation.
        </li>
        <li>
          <strong style={stepTitleStyle}>
            La clé API n&apos;est pas correcte :
          </strong>
          <br />
          Vérifiez que la clé API dans votre fichier .env.local correspond bien
          à celle de votre projet Google Cloud.
        </li>
      </ol>

      <div style={{ marginTop: "20px" }}>
        <a
          href="https://console.cloud.google.com/google/maps-apis/apis"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          🔧 Activer les APIs →
        </a>
        <a
          href="https://console.cloud.google.com/billing"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          💳 Vérifier la facturation →
        </a>
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          🔑 Vérifier la clé API →
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
        Google Maps offre un crédit gratuit de $200 par mois qui couvre
        généralement un usage modéré. Vous ne serez facturé que si vous dépassez
        ce crédit mensuel.
      </div>
    </div>
  );
}
