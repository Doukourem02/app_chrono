'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Camera, Save, User, Mail, Phone } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fonction pour charger le profil utilisateur
  const loadProfile = React.useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      // Charger depuis la table users (sans full_name car cette colonne n'existe pas)
      const { data: userData, error } = await supabase
        .from('users')
        .select('avatar_url, phone')
        .eq('id', user.id)
        .single()

      // PGRST116 = "No rows returned" - l'utilisateur n'existe pas encore dans la table users
      // C'est normal, on utilise les données de user_metadata comme fallback
      if (error) {
        if (error.code === 'PGRST116') {
          // Utilisateur n'existe pas dans la table users, utiliser user_metadata
          console.debug('User not found in users table, using user_metadata')
          setFullName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
          setAvatarUrl(null)
          setPhone('')
        } else {
          // Autre erreur (permissions, réseau, etc.)
          console.warn('Error loading profile from users table:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          })
          // Fallback sur user_metadata même en cas d'erreur
          setFullName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
          setAvatarUrl(null)
          setPhone('')
        }
      } else if (userData) {
        // Données trouvées dans la table users
        console.log('✅ [Settings] Profile loaded from database:', {
          avatar_url: userData.avatar_url,
          avatar_url_type: typeof userData.avatar_url,
          avatar_url_length: userData.avatar_url?.length,
          phone: userData.phone,
          user_id: user.id,
        });
        const dbAvatarUrl = userData.avatar_url || null;
        console.log('🖼️ [Settings] Raw avatar URL from DB:', dbAvatarUrl);
        
        // Corriger l'URL si elle contient un double "avatars/avatars"
        let correctedAvatarUrl = dbAvatarUrl;
        if (dbAvatarUrl && dbAvatarUrl.includes('/avatars/avatars/')) {
          correctedAvatarUrl = dbAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          console.log('🔧 [Settings] Corrected URL from double avatars:', correctedAvatarUrl);
        }
        
        // Vérifier que l'URL est valide
        if (correctedAvatarUrl && !correctedAvatarUrl.startsWith('http')) {
          console.warn('⚠️ [Settings] Avatar URL does not start with http:', correctedAvatarUrl);
        }
        
        console.log('🖼️ [Settings] Final avatar URL to set:', correctedAvatarUrl);
        setAvatarUrl(correctedAvatarUrl);
        // full_name n'existe pas dans la table users, utiliser user_metadata
        setFullName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
        setPhone(userData.phone || '')
      } else {
        // Pas de données, utiliser user_metadata
        setFullName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
        setAvatarUrl(null)
        setPhone('')
      }
    } catch (error) {
      // Erreur inattendue
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error('Unexpected error loading profile:', {
        message: errorMessage,
        stack: errorStack,
        error,
      })
      // Fallback sur user_metadata
      setFullName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
      setAvatarUrl(null)
      setPhone('')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Charger le profil au montage et quand l'utilisateur change
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Recharger le profil quand on revient sur la page (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        loadProfile()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadProfile, user])

  // Écouter les événements de mise à jour depuis d'autres composants
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const { avatarUrl: newAvatarUrl, fullName: newFullName, phone: newPhone } = event.detail
      if (newAvatarUrl !== undefined) {
        setAvatarUrl(newAvatarUrl)
      }
      if (newFullName !== undefined) {
        setFullName(newFullName)
      }
      if (newPhone !== undefined) {
        setPhone(newPhone)
      }
      // Recharger le profil complet pour être sûr
      loadProfile()
    }

    window.addEventListener('profile-updated', handleProfileUpdate as EventListener)
    window.addEventListener('avatar-updated', handleProfileUpdate as EventListener)

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener)
      window.removeEventListener('avatar-updated', handleProfileUpdate as EventListener)
    }
  }, [loadProfile])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) {
      alert('Vous devez être connecté pour uploader une image')
      return
    }

    // Vérifier la session Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.error('Session error:', sessionError)
      alert('Erreur de session. Veuillez vous reconnecter.')
      return
    }
    console.log('✅ Session valide:', { userId: session.user.id, email: session.user.email })

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }

    // Vérifier la taille (max 50MB pour correspondre au bucket Supabase)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2)
      alert(`L'image est trop grande (${sizeInMB}MB). Taille maximale: 50MB. Veuillez choisir une image plus petite.`)
      return
    }

    setUploading(true)

    // Fonction pour compresser l'image si nécessaire
    const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<File> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
          const img = new Image()
          img.src = event.target?.result as string
          img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height

            // Redimensionner si nécessaire
            if (width > maxWidth || height > maxHeight) {
              if (width > height) {
                if (width > maxWidth) {
                  height = (height * maxWidth) / width
                  width = maxWidth
                }
              } else {
                if (height > maxHeight) {
                  width = (width * maxHeight) / height
                  height = maxHeight
                }
              }
            }

            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('Impossible de créer le contexte canvas'))
              return
            }

            ctx.drawImage(img, 0, 0, width, height)

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Erreur lors de la compression'))
                  return
                }
                const compressedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              },
              file.type,
              quality
            )
          }
          img.onerror = () => reject(new Error('Erreur lors du chargement de l\'image'))
        }
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'))
      })
    }

    try {
      // Compresser l'image si elle dépasse 2MB
      let fileToUpload = file
      if (file.size > 2 * 1024 * 1024) {
        try {
          fileToUpload = await compressImage(file, 1920, 1920, 0.85)
          const originalSize = (file.size / 1024 / 1024).toFixed(2)
          const compressedSize = (fileToUpload.size / 1024 / 1024).toFixed(2)
          console.log(`Image compressée: ${originalSize}MB → ${compressedSize}MB`)
        } catch (error) {
          console.warn('Erreur lors de la compression, utilisation du fichier original:', error)
          // Continuer avec le fichier original si la compression échoue
        }
      }

      // Créer un nom de fichier unique
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Vérifier à nouveau la session avant l'upload
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) {
        alert('Votre session a expiré. Veuillez vous reconnecter.')
        return
      }

      console.log('📤 Upload attempt:', {
        filePath,
        fileSize: fileToUpload.size,
        userId: user.id,
        sessionExists: !!currentSession,
      })

      // Utiliser l'API route pour uploader (bypass RLS avec service role key)
      const formData = new FormData()
      formData.append('file', fileToUpload)

      const token = currentSession.access_token
      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Upload error:', result)
        if (result.error.includes('Bucket not found') || result.error.includes('not found')) {
          alert(
            'Le bucket "avatars" n\'existe pas.\n\n' +
            'Pour le créer, exécutez dans le terminal:\n' +
            'npm run create-avatars-bucket\n\n' +
            'Ou créez-le manuellement dans Supabase Dashboard → Storage → New bucket\n' +
            'Nom: avatars | Public: Oui | Taille max: 50MB'
          )
        } else {
          alert('Erreur lors de l\'upload: ' + (result.error || 'Erreur inconnue'))
        }
        return
      }

      const publicUrl = result.url

      // Mettre à jour le profil dans la table users via l'API route (bypass RLS)
      console.log('📤 Calling update-avatar-url API...')
      const updateResponse = await fetch('/api/update-avatar-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          avatarUrl: publicUrl,
        }),
      })

      console.log('📤 Update API response status:', updateResponse.status, updateResponse.statusText)

      let updateResult: { error?: string; message?: string; hint?: string } = {}
      let responseText = ''
      
      try {
        responseText = await updateResponse.text()
        console.log('📤 Update API response text:', responseText)
        
        if (responseText) {
          updateResult = JSON.parse(responseText)
        }
      } catch (jsonError) {
        console.error('❌ Error parsing JSON response:', jsonError)
        console.error('❌ Response text that failed to parse:', responseText)
        setAvatarUrl(publicUrl)
        alert(
          'L\'image a été uploadée avec succès, mais la mise à jour du profil a échoué.\n\n' +
          'Erreur de réponse du serveur. Vérifiez la console pour plus de détails.\n\n' +
          'L\'image est disponible à: ' + publicUrl
        )
        return
      }

      console.log('📤 Update result parsed:', updateResult)

      if (!updateResponse.ok) {
        console.error('❌ Error updating profile:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          result: updateResult,
          responseText: responseText,
        })
        // L'upload a réussi, mais la mise à jour du profil a échoué
        // On affiche quand même l'avatar car il est uploadé
        setAvatarUrl(publicUrl)
        const errorMessage = updateResult?.error || updateResult?.message || responseText || 'Erreur inconnue'
        const hint = updateResult?.hint ? `\n\n💡 ${updateResult.hint}` : ''
        alert(
          'L\'image a été uploadée avec succès, mais la mise à jour du profil a échoué.\n\n' +
          `Erreur (${updateResponse.status}): ${errorMessage}${hint}\n\n` +
          'L\'image est disponible à: ' + publicUrl
        )
        return
      }

      // Recharger le profil pour mettre à jour l'affichage
      const { data: userData } = await supabase
        .from('users')
        .select('avatar_url, phone')
        .eq('id', user.id)
        .single()

      if (userData) {
        setAvatarUrl(userData.avatar_url || publicUrl)
      } else {
        setAvatarUrl(publicUrl)
      }

      // Notifier le Sidebar et autres composants que l'avatar a été mis à jour
      const finalAvatarUrl = userData?.avatar_url || publicUrl
      console.log('📢 [Settings] Dispatching avatar-updated event with URL:', finalAvatarUrl)
      window.dispatchEvent(new CustomEvent('avatar-updated', {
        detail: { avatarUrl: finalAvatarUrl }
      }))

      alert('Photo de profil mise à jour avec succès!')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert('Erreur lors de l\'upload de l\'image: ' + errorMessage)
    } finally {
      setUploading(false)
      // Réinitialiser l'input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)

    try {
      // Vérifier si l'utilisateur existe dans la table users
      const { error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (checkError && checkError.code === 'PGRST116') {
        // L'utilisateur n'existe pas, le créer (full_name n'existe pas dans users)
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              email: user.email || '',
              phone: phone || null,
              role: 'admin',
              created_at: new Date().toISOString(),
            },
          ])

        if (insertError) {
          console.error('Error creating user profile:', insertError)
          alert('Erreur lors de la création du profil. Veuillez réessayer.')
          return
        }
      } else if (checkError) {
        console.error('Error checking user profile:', checkError)
        alert('Erreur lors de la vérification du profil')
        return
      } else {
        // L'utilisateur existe, mettre à jour (full_name n'existe pas dans users, on met à jour seulement phone)
        const { error: updateError } = await supabase
          .from('users')
          .update({
            phone: phone || null,
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('Error saving profile:', updateError)
          alert('Erreur lors de la sauvegarde')
          return
        }
      }

      // Mettre à jour aussi les metadata de l'utilisateur
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
        },
      })

      if (metadataError) {
        console.warn('Error updating metadata (non-critical):', metadataError)
      }

      // Recharger le profil pour mettre à jour l'affichage
      const { data: updatedUser } = await supabase
        .from('users')
        .select('phone, avatar_url')
        .eq('id', user.id)
        .single()

      if (updatedUser) {
        // full_name n'existe pas dans la table users, utiliser user_metadata
        setFullName(user?.user_metadata?.full_name || fullName || '')
        setPhone(updatedUser.phone || '')
        if (updatedUser.avatar_url) {
          setAvatarUrl(updatedUser.avatar_url)
        }
      }

      // Notifier le Sidebar que le profil a été mis à jour
      window.dispatchEvent(new CustomEvent('profile-updated', {
        detail: { 
          fullName: user?.user_metadata?.full_name || fullName,
          phone: updatedUser?.phone || phone,
          avatarUrl: updatedUser?.avatar_url || avatarUrl
        }
      }))

      alert('Profil mis à jour avec succès')
    } catch (error) {
      console.error('Error saving profile:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert('Erreur lors de la sauvegarde: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getUserInitials = () => {
    if (fullName) {
      const names = fullName.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      }
      return fullName.charAt(0).toUpperCase()
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase()
    }
    return ''
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const avatarSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    paddingBottom: '24px',
    borderBottom: '1px solid #E5E7EB',
  }

  const avatarContainerStyle: React.CSSProperties = {
    position: 'relative',
    cursor: 'pointer',
  }

  const avatarStyle: React.CSSProperties = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: avatarUrl ? 'transparent' : '#8B5CF6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    fontWeight: 600,
    color: '#FFFFFF',
    border: '4px solid #FFFFFF',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundImage: avatarUrl ? `url("${avatarUrl}")` : 'none',
  }

  const cameraButtonStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '0',
    right: '0',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#8B5CF6',
    border: '3px solid #FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  }

  const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const inputStyle: React.CSSProperties = {
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
  }

  const buttonStyle: React.CSSProperties = {
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    borderRadius: '12px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
          Chargement du profil...
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Mon profil</h1>
          <p style={subtitleStyle}>Gérez vos informations personnelles et votre photo de profil</p>
        </div>

      <div style={cardStyle}>
        <div style={avatarSectionStyle}>
          <div style={avatarContainerStyle} onClick={handleAvatarClick}>
            <div style={avatarStyle}>
              {!avatarUrl && getUserInitials()}
            </div>
            <div style={cameraButtonStyle}>
              {uploading ? (
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid #FFFFFF', 
                  borderTopColor: 'transparent', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block',
                }} />
              ) : (
                <Camera size={16} style={{ color: '#FFFFFF' }} />
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
            Cliquez sur l&apos;avatar pour changer votre photo
          </p>
        </div>

        <div style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              <User size={16} style={{ color: '#6B7280' }} />
              Nom complet
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Votre nom complet"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B5CF6'
                e.target.style.backgroundColor = '#FFFFFF'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E7EB'
                e.target.style.backgroundColor = '#F9FAFB'
              }}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              <Mail size={16} style={{ color: '#6B7280' }} />
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              style={{
                ...inputStyle,
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                cursor: 'not-allowed',
              }}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              <Phone size={16} style={{ color: '#6B7280' }} />
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 XX XX XX XX XX"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B5CF6'
                e.target.style.backgroundColor = '#FFFFFF'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E7EB'
                e.target.style.backgroundColor = '#F9FAFB'
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...buttonStyle,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.backgroundColor = '#7C3AED'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.backgroundColor = '#8B5CF6'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            {saving ? (
              <>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid #FFFFFF', 
                  borderTopColor: 'transparent', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block',
                }} />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} />
                Enregistrer les modifications
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
