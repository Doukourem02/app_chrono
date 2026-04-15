"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { pathnameToPanelId } from "@/lib/workspacePaths";
import { workspacePanelComponents } from "./workspacePanelRegistry";

/**
 * Affiche le panneau actif et garde en mémoire les panneaux déjà visités (DOM masqué),
 * pour ne pas démonter l’UI ni perdre l’état local (formulaires, scroll, etc.) au changement de menu.
 */
export default function WorkspaceKeepAlive() {
  const pathname = usePathname();
  const router = useRouter();
  const activePanelId = useMemo(() => pathnameToPanelId(pathname ?? ""), [pathname]);

  const [panelState, setPanelState] = useState<{
    visited: Set<string>;
    prevActivePanelId: string | null;
  }>(() => ({ visited: new Set(), prevActivePanelId: null }));

  if (activePanelId !== panelState.prevActivePanelId) {
    setPanelState((s) => ({
      prevActivePanelId: activePanelId,
      visited: activePanelId ? new Set(s.visited).add(activePanelId) : s.visited,
    }));
  }
  const visited = panelState.visited;

  useEffect(() => {
    if (pathname === "/workspace") {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  if (pathname === "/workspace") {
    return null;
  }

  if (!activePanelId) {
    return (
      <div style={{ padding: 24, color: "var(--text-secondary)" }}>
        Vue workspace inconnue pour cette URL.
      </div>
    );
  }

  if (!workspacePanelComponents[activePanelId]) {
    return (
      <div style={{ padding: 24, color: "var(--text-secondary)" }}>
        Panneau « {activePanelId} » non enregistré.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      {Array.from(visited).map((id) => {
        const Cmp = workspacePanelComponents[id];
        if (!Cmp) return null;
        const isActive = id === activePanelId;
        return (
          <div
            key={id}
            style={{
              display: isActive ? "block" : "none",
            }}
            aria-hidden={!isActive}
          >
            <Cmp />
          </div>
        );
      })}
    </div>
  );
}
