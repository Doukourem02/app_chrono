"use client";

import { SkeletonLoader } from "@/components/animations";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { GoogleMapsProvider } from "@/contexts/GoogleMapsContext";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSocketConnection } from "@/hooks/useSocketConnection";
import { useNotifications } from "@/hooks/useNotifications";
import { soundService } from "@/utils/soundService";
import { logger } from "@/utils/logger";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, setUser, setLoading, checkAdminRole } = useAuthStore();
  
  // Initialiser la connexion Socket.IO pour recevoir les événements en temps réel
  const { isConnected } = useSocketConnection();
  
  // Activer les notifications en temps réel
  useNotifications();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLoading(false);
        return router.push("/login");
      }

      setUser(data.session.user);

      const isAdmin = await checkAdminRole();
      if (!isAdmin) {
        setLoading(false);
        return router.push("/login");
      }

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Les fonctions du store sont stables, pas besoin de les inclure

  // Initialiser le soundService dès le chargement et précharger les sons
  useEffect(() => {
    if (user && !loading && typeof window !== 'undefined') {
      // Initialiser le service de sons (essaie de précharger automatiquement)
      soundService.initialize().catch((error) => {
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[DashboardLayout] Erreur initialisation soundService:', error);
        }
      });
      
      // Forcer le préchargement dès qu'il y a une interaction (backup si auto-preload échoue)
      const handleFirstInteraction = () => {
        soundService.forcePreload().catch(() => {
          // Ignorer les erreurs silencieusement
        });
        
        // Nettoyer les listeners après la première interaction
        ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
          window.removeEventListener(event, handleFirstInteraction);
        });
      };
      
      // Écouter la première interaction pour forcer le préchargement (backup)
      ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
        window.addEventListener(event, handleFirstInteraction, { once: true, passive: true });
      });
      
      // Précharger le module soundService pour éviter le délai d'import dynamique
      // Cela garantit que le module est prêt quand une commande arrive
      import('@/utils/soundService').catch(() => {
        // Ignorer les erreurs silencieusement
      });
    }
  }, [user, loading]);

  // Logger l'état de connexion socket pour déboguer
  useEffect(() => {
    if (user && !loading) {
      logger.debug('[DashboardLayout] État connexion socket:', {
        isConnected,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isConnected, user, loading]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <SkeletonLoader width={200} height={40} borderRadius={8} />
        <SkeletonLoader width={300} height={20} borderRadius={4} />
      </div>
    );
  }

  if (!user) return null;

  const containerStyle: React.CSSProperties = {
    display: "flex",
    height: "100vh",
    backgroundColor: "var(--background)",
  };

  const contentWrapperStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const scrollableStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
  };

  const innerContainerStyle: React.CSSProperties = {
    paddingLeft: "16px",
    paddingRight: "24px",
    paddingTop: "16px",
    paddingBottom: "16px",
    minHeight: "100%",
  };

  const maxWidthContainerStyle: React.CSSProperties = {
    maxWidth: "1152px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  // Vérifier si on est sur la page tracking pour ajuster le layout
  const isTrackingPage = pathname?.includes("/tracking");

  return (
    <DateFilterProvider>
      <GoogleMapsProvider>
        <div style={containerStyle}>
          <Sidebar />
          <div style={contentWrapperStyle}>
            <div style={scrollableStyle}>
              {isTrackingPage ? (
                <main style={{ height: "100%", padding: 0 }}>{children}</main>
              ) : (
                <div style={innerContainerStyle}>
                  <div style={maxWidthContainerStyle}>
                    <Header />
                    <main>{children}</main>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </GoogleMapsProvider>
    </DateFilterProvider>
  );
}
