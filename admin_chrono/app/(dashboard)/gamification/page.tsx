'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Award } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

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
  rating: number
}

export default function GamificationPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week')
  const [zone, setZone] = useState<string>('')

  // Classement
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['gamification', 'leaderboard', period, zone],
    queryFn: async () => {
      // Récupérer le token depuis Supabase
      if (!supabase) {
        throw new Error('Supabase non configuré')
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        throw new Error('Non authentifié')
      }

      const params = new URLSearchParams({ period })
      if (zone) params.append('zone', zone)
      
      const response = await fetch(`/api/gamification/leaderboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Erreur chargement classement')
      return response.json()
    },
  })

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        Performance
      </h1>

      {/* Filtres */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'week' | 'month' | 'all')}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
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
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', flex: 1, maxWidth: '300px' }}
        />
      </div>

      {/* Classement */}
      <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy style={{ width: '20px', height: '20px', color: '#F59E0B' }} />
          Classement des livreurs
        </h2>
        
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>Chargement...</div>
        ) : !leaderboard?.leaderboard || leaderboard.leaderboard.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
            <p style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>Aucun livreur dans le classement</p>
            <p style={{ fontSize: '14px', color: '#9CA3AF' }}>
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
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Rang</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Livreur</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Score</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Livraisons</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.leaderboard.map((entry: LeaderboardEntry, index: number) => (
                  <tr key={entry.driverId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px', fontWeight: index < 3 ? 'bold' : 'normal' }}>
                      {index === 0 && <Trophy style={{ width: '16px', height: '16px', color: '#F59E0B', display: 'inline', marginRight: '4px' }} />}
                      {index === 1 && <Award style={{ width: '16px', height: '16px', color: '#6B7280', display: 'inline', marginRight: '4px' }} />}
                      {index === 2 && <Award style={{ width: '16px', height: '16px', color: '#CD7F32', display: 'inline', marginRight: '4px' }} />}
                      {entry.rank}
                    </td>
                    <td style={{ padding: '12px' }}>{entry.driverName}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{Math.round(entry.score)}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{entry.deliveries}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{entry.rating.toFixed(1)}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

