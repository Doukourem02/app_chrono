"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { SkeletonLoader } from "@/components/animations";

const loading = () => (
  <div style={{ padding: 24 }}>
    <SkeletonLoader width="100%" height={48} borderRadius={8} />
    <div style={{ marginTop: 16 }}>
      <SkeletonLoader width="100%" height={200} borderRadius={12} />
    </div>
  </div>
);

/**
 * Chaque entrée pointe vers le même module que les anciennes routes /dashboard, /orders, etc.
 * Ils ne sont plus rendus comme routes séparées : un seul parent les affiche/masque.
 */
export const workspacePanelComponents: Record<string, ComponentType<object>> = {
  dashboard: dynamic(() => import("@/app/(dashboard)/dashboard/page"), {
    ssr: false,
    loading,
  }),
  tracking: dynamic(() => import("@/app/(dashboard)/tracking/page"), {
    ssr: false,
    loading,
  }),
  orders: dynamic(() => import("@/app/(dashboard)/orders/page"), {
    ssr: false,
    loading,
  }),
  message: dynamic(() => import("@/app/(dashboard)/message/page"), {
    ssr: false,
    loading,
  }),
  analytics: dynamic(() => import("@/app/(dashboard)/analytics/page"), {
    ssr: false,
    loading,
  }),
  reports: dynamic(() => import("@/app/(dashboard)/reports/page"), {
    ssr: false,
    loading,
  }),
  finance: dynamic(() => import("@/app/(dashboard)/finance/page"), {
    ssr: false,
    loading,
  }),
  finances: dynamic(() => import("@/app/(dashboard)/finances/page"), {
    ssr: false,
    loading,
  }),
  commissions: dynamic(() => import("@/app/(dashboard)/commissions/page"), {
    ssr: false,
    loading,
  }),
  users: dynamic(() => import("@/app/(dashboard)/users/page"), {
    ssr: false,
    loading,
  }),
  drivers: dynamic(() => import("@/app/(dashboard)/drivers/page"), {
    ssr: false,
    loading,
  }),
  gamification: dynamic(() => import("@/app/(dashboard)/gamification/page"), {
    ssr: false,
    loading,
  }),
  maintenance: dynamic(() => import("@/app/(dashboard)/maintenance/page"), {
    ssr: false,
    loading,
  }),
  planning: dynamic(() => import("@/app/(dashboard)/planning/page"), {
    ssr: false,
    loading,
  }),
  "promo-codes": dynamic(() => import("@/app/(dashboard)/promo-codes/page"), {
    ssr: false,
    loading,
  }),
  disputes: dynamic(() => import("@/app/(dashboard)/disputes/page"), {
    ssr: false,
    loading,
  }),
  settings: dynamic(() => import("@/app/(dashboard)/settings/page"), {
    ssr: false,
    loading,
  }),
  profile: dynamic(() => import("@/app/(dashboard)/profile/page"), {
    ssr: false,
    loading,
  }),
  ratings: dynamic(() => import("@/app/(dashboard)/ratings/page"), {
    ssr: false,
    loading,
  }),
};
