'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Star, Package, CheckCircle, TrendingUp, Users } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { themeColors } from '@/utils/theme'

const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  : null

interface LeaderboardEntry {
  driverId: string
  driverName: string
  score: number
  rank: number
  deliveries: number
  totalOrders: number
  successRate: number
  rating: number
}

interface PerformanceKPIs {
  totalCompleted: number
  totalOrders: number
  successRate: number
  avgRating: number
  activeDrivers: number
}

const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32']

export default function GamificationPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week')
  const [zone, setZone] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['gamification', 'leaderboard', period, zone],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Non authentifié')

      const params = new URLSearchParams({ period })
      if (zone) params.append('zone', zone)

      const response = await fetch(`/api/gamification/leaderboard?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erreur chargement classement')
      return response.json() as Promise<{ leaderboard: LeaderboardEntry[]; kpis: PerformanceKPIs }>
    },
  })

  const leaderboard: LeaderboardEntry[] = data?.leaderboard || []
  const kpis: PerformanceKPIs = data?.kpis || { totalCompleted: 0, totalOrders: 0, successRate: 0, avgRating: 0, activeDrivers: 0 }
  const top3 = leaderboard.slice(0, 3)

  const periodLabel = period === 'week' ? 'cette semaine' : period === 'month' ? 'ce mois' : 'de tout le temps'

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: themeColors.textPrimary }}>
        Performance
      </h1>

      {/* Filtres */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'week' | 'month' | 'all')}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${themeColors.cardBorder}`,
            backgroundColor: themeColors.cardBg,
            color: themeColors.textPrimary,
          }}
        >
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="all">Tout le temps</option>
        </select>
        <input
          type="text"
          placeholder="Filtrer par zone..."
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${themeColors.cardBorder}`,
            flex: 1,
            maxWidth: '300px',
            backgroundColor: themeColors.cardBg,
            color: themeColors.textPrimary,
          }}
        />
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ padding: '20px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Package style={{ width: '18px', height: '18px', color: '#3B82F6' }} />
            <span style={{ fontSize: '13px', color: themeColors.textSecondary }}>Livraisons complétées</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: themeColors.textPrimary }}>
            {isLoading ? '...' : kpis.totalCompleted}
          </div>
          <div style={{ fontSize: '12px', color: themeColors.textTertiary, marginTop: '4px' }}>{periodLabel}</div>
        </div>

        <div style={{ padding: '20px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle style={{ width: '18px', height: '18px', color: '#10B981' }} />
            <span style={{ fontSize: '13px', color: themeColors.textSecondary }}>Taux de réussite</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: themeColors.textPrimary }}>
            {isLoading ? '...' : `${kpis.successRate}%`}
          </div>
          <div style={{ fontSize: '12px', color: themeColors.textTertiary, marginTop: '4px' }}>{kpis.totalOrders} commandes assignées</div>
        </div>

        <div style={{ padding: '20px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Star style={{ width: '18px', height: '18px', color: '#FBBF24' }} />
            <span style={{ fontSize: '13px', color: themeColors.textSecondary }}>Note moyenne</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: themeColors.textPrimary }}>
            {isLoading ? '...' : kpis.avgRating > 0 ? `${kpis.avgRating}/5` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: themeColors.textTertiary, marginTop: '4px' }}>évaluations clients</div>
        </div>

        <div style={{ padding: '20px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#8B5CF6' }} />
            <span style={{ fontSize: '13px', color: themeColors.textSecondary }}>Livreurs actifs</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: themeColors.textPrimary }}>
            {isLoading ? '...' : kpis.activeDrivers}
          </div>
          <div style={{ fontSize: '12px', color: themeColors.textTertiary, marginTop: '4px' }}>{periodLabel}</div>
        </div>
      </div>

      {/* Podium Top 3 */}
      {!isLoading && top3.length > 0 && (
        <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '24px', color: themeColors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy style={{ width: '18px', height: '18px', color: '#F59E0B' }} />
            Top 3 livreurs
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '24px' }}>
            {/* 2ème place à gauche */}
            {top3[1] && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '22px', border: `3px solid ${MEDAL_COLORS[1]}` }}>
                  🥈
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: themeColors.textPrimary }}>{top3[1].driverName}</div>
                <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginTop: '2px' }}>{top3[1].deliveries} livraisons</div>
                <div style={{ fontSize: '12px', color: MEDAL_COLORS[1], fontWeight: 600, marginTop: '2px' }}>Score: {Math.round(top3[1].score)}</div>
                <div style={{ marginTop: '8px', height: '60px', backgroundColor: MEDAL_COLORS[1], borderRadius: '6px 6px 0 0', opacity: 0.8 }} />
              </div>
            )}
            {/* 1ère place au centre — plus haute */}
            {top3[0] && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '28px', border: `3px solid ${MEDAL_COLORS[0]}` }}>
                  🥇
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: themeColors.textPrimary }}>{top3[0].driverName}</div>
                <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginTop: '2px' }}>{top3[0].deliveries} livraisons</div>
                <div style={{ fontSize: '13px', color: MEDAL_COLORS[0], fontWeight: 700, marginTop: '2px' }}>Score: {Math.round(top3[0].score)}</div>
                <div style={{ marginTop: '8px', height: '90px', backgroundColor: MEDAL_COLORS[0], borderRadius: '6px 6px 0 0', opacity: 0.8 }} />
              </div>
            )}
            {/* 3ème place à droite */}
            {top3[2] && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '22px', border: `3px solid ${MEDAL_COLORS[2]}` }}>
                  🥉
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: themeColors.textPrimary }}>{top3[2].driverName}</div>
                <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginTop: '2px' }}>{top3[2].deliveries} livraisons</div>
                <div style={{ fontSize: '12px', color: MEDAL_COLORS[2], fontWeight: 600, marginTop: '2px' }}>Score: {Math.round(top3[2].score)}</div>
                <div style={{ marginTop: '8px', height: '40px', backgroundColor: MEDAL_COLORS[2], borderRadius: '6px 6px 0 0', opacity: 0.8 }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Classement complet */}
      <div style={{ padding: '20px', backgroundColor: themeColors.cardBg, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `1px solid ${themeColors.cardBorder}` }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: themeColors.textPrimary }}>
          <TrendingUp style={{ width: '18px', height: '18px', color: themeColors.purplePrimary }} />
          Classement complet
        </h2>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: themeColors.textSecondary }}>Chargement...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: themeColors.textSecondary }}>
            <p style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 600, color: themeColors.textPrimary }}>Aucun livreur dans le classement</p>
            <p style={{ fontSize: '14px', color: themeColors.textTertiary }}>
              {period === 'week'
                ? 'Aucune livraison complétée cette semaine'
                : period === 'month'
                ? 'Aucune livraison complétée ce mois'
                : 'Aucune livraison complétée'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.grayLight }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Rang</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Livreur</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Score</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Livraisons</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Taux réussite</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr key={entry.driverId} style={{ borderBottom: `1px solid ${themeColors.cardBorder}`, backgroundColor: index < 3 ? `${MEDAL_COLORS[index]}10` : 'transparent' }}>
                    <td style={{ padding: '12px', fontWeight: index < 3 ? 700 : 500, color: index < 3 ? MEDAL_COLORS[index] : themeColors.textPrimary }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && <span style={{ color: themeColors.textSecondary, fontWeight: 400 }}>#{entry.rank}</span>}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: themeColors.textPrimary }}>{entry.driverName}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: themeColors.textPrimary }}>{Math.round(entry.score)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>{entry.deliveries}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: entry.successRate >= 80 ? '#D1FAE5' : entry.successRate >= 60 ? '#FEF3C7' : '#FEE2E2',
                        color: entry.successRate >= 80 ? '#065F46' : entry.successRate >= 60 ? '#92400E' : '#991B1B',
                      }}>
                        {entry.successRate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <Star style={{ width: '14px', height: '14px', color: '#FBBF24', fill: '#FBBF24' }} />
                        {entry.rating > 0 ? entry.rating.toFixed(1) : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Légende score */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: themeColors.textTertiary }}>
          * Score = nombre de livraisons × note moyenne
        </div>
      )}
    </div>
  )
}
