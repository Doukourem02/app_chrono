"use client";

import { ScreenTransition, SkeletonLoader } from "@/components/animations";
import StatusKPICard from "@/components/orders/StatusKPICard";
import { adminApiService } from "@/lib/adminApiService";
import { adminSocketService } from "@/lib/adminSocketService";
import { formatDeliveryId } from "@/utils/formatDeliveryId";
import { logger } from "@/utils/logger";
import { themeColors } from "@/utils/theme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
const parseDateToISO = (value?: string) => {
  if (!value) return undefined;
  const parts = value.split(/[\/\-]/);
  if (parts.length === 3) {
    const [first, second, third] = parts;
    if (first.length === 2 && second.length === 2 && third.length === 4) {
      return `${third}-${second}-${first}`;
    }
    if (first.length === 4) {
      return `${first}-${second}-${third}`;
    }
  }
  return undefined;
};

const statusConfig: Record<
  string,
  { label: string; backgroundColor: string; color: string }
> = {
  pending: {
    label: "Pending",
    backgroundColor: "#FFEDD5",
    color: "#EA580C",
  },
  accepted: {
    label: "Accepted",
    backgroundColor: "#DBEAFE",
    color: "#2563EB",
  },
  enroute: {
    label: "On Progress",
    backgroundColor: "#DBEAFE",
    color: "#2563EB",
  },
  picked_up: {
    label: "Picked Up",
    backgroundColor: "#F3E8FF",
    color: "#9333EA",
  },
  completed: {
    label: "Delivered",
    backgroundColor: "#D1FAE5",
    color: "#16A34A",
  },
  declined: {
    label: "Declined",
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
  },
  cancelled: {
    label: "Cancelled",
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
  },
};

type TabType = "all" | "onProgress" | "successful" | "onHold" | "canceled";

interface Order {
  id: string;
  deliveryId: string;
  date: string;
  departure: string;
  destination: string;
  status: string;
  is_phone_order?: boolean;
  is_b2b_order?: boolean; // Indicateur pour les commandes B2B créées depuis le planning
}

export default function OrdersPage() {
  const searchParams = useSearchParams();

  // Initialiser activeTab en fonction du paramètre URL
  const getInitialTab = (): TabType => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      const statusToTabMap: Record<string, TabType> = {
        pending: "onProgress",
        accepted: "onProgress",
        enroute: "onProgress",
        picked_up: "onProgress",
        completed: "successful",
        cancelled: "canceled",
        canceled: "canceled",
        declined: "canceled",
        onProgress: "onProgress",
        successful: "successful",
        onHold: "onHold",
        all: "all",
      };
      return statusToTabMap[statusParam.toLowerCase()] || "onProgress";
    }
    return "onProgress";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const lastStatusParamRef = useRef<string | null>(null);

  // Fonction pour annuler une commande
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette commande ?")) {
      return;
    }

    try {
      const result = await adminApiService.cancelOrder(
        orderId,
        "admin_cancelled"
      );
      if (result.success) {
        // Rafraîchir la liste des commandes
        queryClient.invalidateQueries({ queryKey: ["orders", activeTab] });
        alert("Commande annulée avec succès");
      } else {
        alert(
          `Erreur: ${result.message || "Impossible d'annuler la commande"}`
        );
      }
    } catch (error) {
      logger.error("[OrdersPage] Error cancelling order:", error);
      alert("Erreur lors de l'annulation de la commande");
    }
  };

  // Mettre à jour activeTab quand le paramètre URL change
  useEffect(() => {
    const statusParam = searchParams.get("status");
    // Ne mettre à jour que si le paramètre a vraiment changé
    if (statusParam !== lastStatusParamRef.current) {
      lastStatusParamRef.current = statusParam;
      if (statusParam) {
        const statusToTabMap: Record<string, TabType> = {
          pending: "onProgress",
          accepted: "onProgress",
          enroute: "onProgress",
          picked_up: "onProgress",
          completed: "successful",
          cancelled: "canceled",
          canceled: "canceled",
          declined: "canceled",
          onProgress: "onProgress",
          successful: "successful",
          onHold: "onHold",
          all: "all",
        };
        const tab = statusToTabMap[statusParam.toLowerCase()];
        if (tab) {
          // Utiliser requestAnimationFrame pour éviter les warnings ESLint
          requestAnimationFrame(() => {
            setActiveTab(tab);
          });
        }
      }
    }
  }, [searchParams]);

  const {
    data: ordersData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["orders", activeTab],
    queryFn: async () => {
      const result = await adminApiService.getOrdersByStatus(
        activeTab === "all" ? undefined : activeTab
      );
      return result;
    },
    refetchInterval: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: false,
    enabled: true,
    // Gérer les erreurs silencieusement (logger uniquement)
    throwOnError: false,
  });

  // Logger les erreurs mais ne pas les afficher à l'utilisateur
  React.useEffect(() => {
    if (isError && error) {
      // Logger l'erreur (visible uniquement dans les logs, pas à l'utilisateur)
      logger.error("[OrdersPage] Error loading orders:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        activeTab,
      });
    }
  }, [isError, error, activeTab]);

  const orders: Order[] = useMemo(() => {
    return (ordersData?.data as Order[]) || [];
  }, [ordersData?.data]);
  const counts = ordersData?.counts || {
    all: 0,
    onProgress: 0,
    successful: 0,
    onHold: 0,
    canceled: 0,
    changes: {
      all: 0,
      onProgress: 0,
      successful: 0,
      onHold: 0,
      canceled: 0,
    },
  };

  // Lire le paramètre orderId pour mettre en évidence la commande
  const highlightedOrderId = searchParams.get("orderId");

  // Calculer targetOrderId et targetPage avec useMemo pour éviter les setState dans useEffect
  const { targetOrderId, targetPage } = useMemo(() => {
    if (!highlightedOrderId || isLoading || orders.length === 0) {
      return { targetOrderId: null, targetPage: currentPage };
    }

    // Chercher par ID exact d'abord
    let orderIndex = orders.findIndex(
      (order) => order.id === highlightedOrderId
    );

    // Si pas trouvé, essayer de chercher par les 4 derniers caractères (au cas où il y aurait une différence de format)
    if (orderIndex === -1) {
      const highlightedIdClean = highlightedOrderId
        .replace(/-/g, "")
        .toUpperCase();
      const highlightedIdEnd = highlightedIdClean.slice(-4);
      orderIndex = orders.findIndex((order) => {
        const orderIdClean = order.id.replace(/-/g, "").toUpperCase();
        const orderIdEnd = orderIdClean.slice(-4);
        return orderIdEnd === highlightedIdEnd;
      });
    }

    if (orderIndex !== -1) {
      const foundOrder = orders[orderIndex];
      const calculatedPage = Math.floor(orderIndex / itemsPerPage) + 1;
      return { targetOrderId: foundOrder.id, targetPage: calculatedPage };
    }

    return { targetOrderId: null, targetPage: currentPage };
  }, [highlightedOrderId, orders, itemsPerPage, isLoading, currentPage]);

  // Mettre à jour la page si nécessaire
  const lastTargetPageRef = useRef<number | null>(null);
  useEffect(() => {
    // Ne mettre à jour que si targetPage a vraiment changé et est différent de currentPage
    if (
      targetPage !== lastTargetPageRef.current &&
      targetPage !== currentPage &&
      targetPage > 0
    ) {
      lastTargetPageRef.current = targetPage;
      // Utiliser requestAnimationFrame pour éviter les warnings ESLint
      requestAnimationFrame(() => {
        setCurrentPage(targetPage);
      });
    }
  }, [targetPage, currentPage]);

  // Scroller vers la commande une fois que la pagination est mise à jour
  useEffect(() => {
    if (targetOrderId && !isLoading && currentPage > 0) {
      // Attendre que React ait rendu la nouvelle page
      const scrollTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(`order-${targetOrderId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            // Ne pas retirer le paramètre orderId de l'URL - laisser la commande mise en évidence
            // Le paramètre sera retiré seulement si l'utilisateur clique sur une autre commande ou change de page
          } else {
            // Si l'élément n'est pas trouvé, réessayer après un délai supplémentaire
            setTimeout(() => {
              const retryElement = document.getElementById(
                `order-${targetOrderId}`
              );
              if (retryElement) {
                retryElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 600);
          }
        });
      }, 300);

      return () => clearTimeout(scrollTimeout);
    }
  }, [targetOrderId, currentPage, isLoading]);

  React.useEffect(() => {
    // Ne réinitialiser la page que si on ne cherche pas une commande spécifique
    if (!highlightedOrderId) {
      setCurrentPage(1);
    }
  }, [activeTab, highlightedOrderId]);

  React.useEffect(() => {
    const unsubscribe = adminSocketService.on("order:status:update", () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const totalPages = Math.max(1, Math.ceil(orders.length / itemsPerPage));
  const paginatedOrders = orders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: 700,
    color: themeColors.textPrimary,
    marginTop: "0",
  };

  const tabsContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "32px",
    borderBottom: `1px solid ${themeColors.cardBorder}`,
    paddingBottom: "8px",
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: "14px",
    fontWeight: 500,
    color: isActive ? themeColors.purplePrimary : themeColors.textSecondary,
    backgroundColor: "transparent",
    border: "none",
    borderBottom: isActive ? `2px solid ${themeColors.purplePrimary}` : "2px solid transparent",
    paddingBottom: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  const kpiCardsContainerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "24px",
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All delivery" },
    { key: "onProgress", label: "On Progress Delivery" },
    { key: "successful", label: "Successfull" },
    { key: "onHold", label: "On hold delivery" },
    { key: "canceled", label: "Canceled Delivery" },
  ];

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
        <div style={kpiCardsContainerStyle}>
          <StatusKPICard
            type="onProgress"
            count={counts.onProgress}
            change={counts.changes?.onProgress || 0}
          />
          <StatusKPICard
            type="successful"
            count={counts.successful}
            change={counts.changes?.successful || 0}
          />
          <StatusKPICard
            type="onHold"
            count={counts.onHold}
            change={counts.changes?.onHold || 0}
          />
          <StatusKPICard
            type="canceled"
            count={counts.canceled}
            change={counts.changes?.canceled || 0}
          />
        </div>

        <h1 style={titleStyle}>Rapport de livraison</h1>

        <div style={tabsContainerStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={tabStyle(activeTab === tab.key)}
              onMouseEnter={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = themeColors.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = themeColors.textSecondary;
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div
            style={{
              padding: "48px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{ padding: "48px", textAlign: "center", color: themeColors.textSecondary }}
          >
            Aucune commande trouvée
          </div>
        ) : (
          <div
            style={{
              backgroundColor: themeColors.cardBg,
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: `1px solid ${themeColors.cardBorder}`,
            }}
          >
            <div
              style={{
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p style={{ color: themeColors.textSecondary, fontSize: "14px" }}>
                {orders.length} commande(s) trouvée(s)
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Delivery ID
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Date
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Departure
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Destination
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: themeColors.textSecondary,
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order: Order, idx: number) => {
                    const status = statusConfig[order.status] || {
                      label: order.status,
                      backgroundColor: themeColors.grayLight,
                      color: themeColors.textSecondary,
                    };

                    // Vérifier si cette commande doit être mise en évidence
                    // Comparer par ID exact d'abord, puis par les 4 derniers caractères si pas de match exact
                    let isHighlighted = false;
                    if (highlightedOrderId) {
                      // Comparaison exacte
                      if (highlightedOrderId === order.id) {
                        isHighlighted = true;
                      } else {
                        // Comparaison par les 4 derniers caractères (sans tirets)
                        const highlightedIdClean = highlightedOrderId
                          .replace(/-/g, "")
                          .toUpperCase();
                        const orderIdClean = order.id
                          .replace(/-/g, "")
                          .toUpperCase();
                        const highlightedIdEnd = highlightedIdClean.slice(-4);
                        const orderIdEnd = orderIdClean.slice(-4);
                        if (
                          highlightedIdEnd === orderIdEnd &&
                          highlightedIdEnd.length === 4
                        ) {
                          isHighlighted = true;
                        }
                      }
                    }

                    // Gérer le clic sur une commande pour retirer la mise en évidence
                    const handleOrderClick = () => {
                      if (highlightedOrderId) {
                        const url = new URL(window.location.href);
                        url.searchParams.delete("orderId");
                        window.history.replaceState({}, "", url.toString());
                      }
                    };

                    return (
                      <tr
                        key={order.id || idx}
                        id={`order-${order.id}`}
                        onClick={handleOrderClick}
                        style={{
                          borderBottom: `1px solid ${themeColors.cardBorder}`,
                          transition: "background-color 0.2s, box-shadow 0.2s",
                          backgroundColor: isHighlighted
                            ? `${themeColors.purplePrimary}20`
                            : "transparent",
                          boxShadow: isHighlighted
                            ? `0 0 0 2px ${themeColors.purplePrimary}`
                            : "none",
                          borderLeft: isHighlighted
                            ? `4px solid ${themeColors.purplePrimary}`
                            : "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          if (!isHighlighted) {
                            e.currentTarget.style.backgroundColor = themeColors.grayLight;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isHighlighted) {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          } else {
                            e.currentTarget.style.backgroundColor = `${themeColors.purplePrimary}20`;
                          }
                        }}
                      >
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: "13px",
                                color: themeColors.textPrimary,
                                fontWeight: 500,
                              }}
                            >
                              {formatDeliveryId(
                                order.deliveryId,
                                parseDateToISO(order.date) || order.date
                              )}
                            </span>
                            {/* Badge pour différencier les types de commandes */}
                            {order.is_b2b_order === true && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: '#E0E7FF',
                                  color: '#4338CA',
                                  textTransform: 'uppercase',
                                }}
                                title="Commande B2B créée depuis le planning"
                              >
                                B2B
                              </span>
                            )}
                            {order.is_phone_order === true && !order.is_b2b_order && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: '#FEF3C7',
                                  color: '#92400E',
                                  textTransform: 'uppercase',
                                }}
                                title="Commande téléphonique créée depuis le dashboard"
                              >
                                Téléphonique
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ fontSize: "14px", color: themeColors.textPrimary }}>
                            {order.date}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{ fontSize: "14px", color: themeColors.textPrimary }}
                            title={order.departure}
                          >
                            {order.departure.length > 30
                              ? `${order.departure.substring(0, 30)}...`
                              : order.departure}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{ fontSize: "14px", color: themeColors.textPrimary }}
                            title={order.destination}
                          >
                            {order.destination.length > 30
                              ? `${order.destination.substring(0, 30)}...`
                              : order.destination}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              paddingLeft: "12px",
                              paddingRight: "12px",
                              paddingTop: "4px",
                              paddingBottom: "4px",
                              backgroundColor: status.backgroundColor,
                              color: status.color,
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          {[
                            "pending",
                            "accepted",
                            "enroute",
                            "picked_up",
                          ].includes(order.status.toLowerCase()) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelOrder(order.id);
                              }}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#EF4444",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#DC2626";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#EF4444";
                              }}
                            >
                              Annuler
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {orders.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: `1px solid ${themeColors.cardBorder}`,
                }}
              >
                <p style={{ color: themeColors.textSecondary, fontSize: "14px" }}>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, orders.length)} of{" "}
                  {orders.length} entries
                </p>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: "8px",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      opacity: currentPage === 1 ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== 1) {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <ChevronLeft size={20} style={{ color: themeColors.textSecondary }} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          paddingLeft: "12px",
                          paddingRight: "12px",
                          paddingTop: "4px",
                          paddingBottom: "4px",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: 500,
                          backgroundColor:
                            currentPage === pageNum ? themeColors.purplePrimary : "transparent",
                          color:
                            currentPage === pageNum ? "#FFFFFF" : themeColors.textPrimary,
                          border: "none",
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor = themeColors.grayLight;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                    style={{
                      padding: "8px",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor:
                        currentPage >= totalPages ? "not-allowed" : "pointer",
                      opacity: currentPage >= totalPages ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage < totalPages) {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <ChevronRight size={20} style={{ color: themeColors.textSecondary }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScreenTransition>
  );
}
