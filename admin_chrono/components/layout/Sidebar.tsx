"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {LayoutDashboard,MapPin,Package,MessageSquare,FileText,Wallet,Calendar,Users,Settings,Truck,TrendingUp,Trophy,ChevronDown,ChevronRight,CreditCard,Coins,Tag,AlertTriangle,} from "lucide-react";
import Image from "next/image";
import logoImage from "@/assets/logo.png";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  items: NavItem[];
}

const mainNavigation: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tracking", icon: MapPin, label: "Tracking Orders" },
  { href: "/orders", icon: Package, label: "Orders" },
  { href: "/message", icon: MessageSquare, label: "Message" },
];

const navigationSections: NavSection[] = [
  {
    id: "analyses",
    label: "Analyses & Rapports",
    icon: TrendingUp,
    items: [
      { href: "/analytics", icon: TrendingUp, label: "Analytics" },
      { href: "/reports", icon: FileText, label: "Reports" },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    icon: Wallet,
    items: [
      { href: "/finances", icon: CreditCard, label: "Transactions Clients" },
      { href: "/finances", icon: Coins, label: "Commissions Livreurs" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion",
    icon: Users,
    items: [
      { href: "/users", icon: Users, label: "Users" },
      { href: "/drivers", icon: Truck, label: "Drivers" },
      { href: "/gamification", icon: Trophy, label: "Performance" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    items: [
      { href: "/planning", icon: Calendar, label: "Planning" },
      { href: "/promo-codes", icon: Tag, label: "Promo-codes" },
      { href: "/disputes", icon: AlertTriangle, label: "Réclamations" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; phone?: string; first_name?: string | null; last_name?: string | null } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['analyses', 'gestion', 'administration']));

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('🔄 [Sidebar] Loading profile for user:', user.id);
      const { data: userData, error } = await supabase
        .from('users')
        .select('avatar_url, phone, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(' [Sidebar] User not found in users table, using user_metadata');
          setAvatarUrl(null);
        setUserProfile({
          full_name: user?.user_metadata?.full_name || undefined,
          phone: undefined,
          first_name: undefined,
          last_name: undefined,
        });
        } else {
          console.warn(' [Sidebar] Error loading profile from users table:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          setAvatarUrl(null);
        setUserProfile({
          full_name: user?.user_metadata?.full_name || undefined,
          phone: undefined,
          first_name: undefined,
          last_name: undefined,
        });
        }
      } else if (userData) {
        console.log(' [Sidebar] Profile loaded from database:', {
          avatar_url: userData.avatar_url,
          avatar_url_type: typeof userData.avatar_url,
          avatar_url_length: userData.avatar_url?.length,
          phone: userData.phone,
          user_id: user.id,
        });
        let newAvatarUrl = userData.avatar_url || null;
        console.log(' [Sidebar] Raw avatar URL from DB:', newAvatarUrl);
        
        // Corriger l'URL si elle contient un double "avatars/avatars"
        if (newAvatarUrl && newAvatarUrl.includes('/avatars/avatars/')) {
          newAvatarUrl = newAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          console.log('🔧 [Sidebar] Corrected URL from double avatars:', newAvatarUrl);
        }
        
        // Vérifier que l'URL est valide
        if (newAvatarUrl && !newAvatarUrl.startsWith('http')) {
          console.warn(' [Sidebar] Avatar URL does not start with http:', newAvatarUrl);
        }
        
        console.log(' [Sidebar] Final avatar URL to set:', newAvatarUrl);
        // Mettre à jour directement l'URL (la vérification se fera via onLoad/onError de l'img)
        setAvatarUrl(newAvatarUrl);
        
        setUserProfile({
          full_name: user?.user_metadata?.full_name || undefined,
          phone: userData.phone || undefined,
          first_name: userData.first_name || undefined,
          last_name: userData.last_name || undefined,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(' [Sidebar] Unexpected error loading profile:', {
        message: errorMessage,
        error,
      });
      setAvatarUrl(null);
        setUserProfile({
          full_name: user?.user_metadata?.full_name || undefined,
          phone: undefined,
          first_name: undefined,
          last_name: undefined,
        });
    }
  }, [user]);

  useEffect(() => {
    requestAnimationFrame(() => {
      loadProfile();
    });
  }, [loadProfile]);

  useEffect(() => {
    const handleAvatarUpdate = (event: CustomEvent) => {
      const { avatarUrl: newAvatarUrl } = event.detail;
      console.log('📢 [Sidebar] Received avatar-updated event:', { newAvatarUrl });
      if (newAvatarUrl) {
        let correctedUrl = newAvatarUrl;
        if (newAvatarUrl.includes('/avatars/avatars/')) {
          correctedUrl = newAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          console.log(' [Sidebar] Corrected URL from:', newAvatarUrl, 'to:', correctedUrl);
        }
        console.log(' [Sidebar] Setting avatar URL immediately:', correctedUrl);
        setAvatarUrl(correctedUrl);
        loadProfile();
      } else {
        console.warn(' [Sidebar] No avatar URL in event detail');
      }
    };

    const handleProfileUpdate = (event: CustomEvent) => {
      const { fullName, phone, avatarUrl: newAvatarUrl } = event.detail;
      console.log(' [Sidebar] Received profile-updated event:', { fullName, phone, newAvatarUrl });
      if (fullName) {
        setUserProfile(prev => ({ ...prev, full_name: fullName }));
      }
      if (phone !== undefined) {
        setUserProfile(prev => ({ ...prev, phone }));
      }
      if (newAvatarUrl) {
        let correctedUrl = newAvatarUrl;
        if (newAvatarUrl.includes('/avatars/avatars/')) {
          correctedUrl = newAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          console.log(' [Sidebar] Corrected URL from:', newAvatarUrl, 'to:', correctedUrl);
        }
        console.log(' [Sidebar] Setting avatar URL from profile-updated:', correctedUrl);
        setAvatarUrl(correctedUrl);
      } else {
        setAvatarUrl(null);
      }
      loadProfile();
    };

    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    window.addEventListener('profile-updated', handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener);
    };
  }, [loadProfile]);

  const collapsedWidth = 72
  const expandedWidth = 290
  const iconSlotSize = 44
  const collapsedIconOffset = Math.max((collapsedWidth - iconSlotSize) / 2, 0)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
        setMenuPosition(null);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Mettre à jour la position du menu quand le sidebar se redimensionne
  useEffect(() => {
    if (showProfileMenu && profileMenuRef.current) {
      const rect = profileMenuRef.current.getBoundingClientRect();
      const sidebarWidth = isExpanded ? expandedWidth : collapsedWidth;
      setMenuPosition({
        top: rect.top + rect.height / 2,
        left: rect.left + sidebarWidth + 16,
      });
    }
  }, [isExpanded, showProfileMenu, expandedWidth, collapsedWidth]);

  const getUserInitials = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${(userProfile.last_name[0] || '').toUpperCase()}${(userProfile.first_name[0] || '').toUpperCase()}`;
    }
    if (userProfile?.full_name) {
      const names = userProfile.full_name.split(' ');
      if (names.length >= 2) {
        return (names[names.length - 1][0] + names[0][0]).toUpperCase();
      }
      return userProfile.full_name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const getUserName = () => {
  
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.last_name} ${userProfile.first_name}`;
    }
    if (userProfile?.full_name) {
      return userProfile.full_name;
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Admin';
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const sidebarStyle: React.CSSProperties = {
    height: '100vh',
    width: isExpanded ? expandedWidth : collapsedWidth,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: isExpanded ? 'flex-start' : 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: isExpanded ? 24 : 0,
    paddingRight: isExpanded ? 16 : 0,
    borderTopRightRadius: '32px',
    borderBottomRightRadius: '32px',
    boxShadow: '4px 0 20px rgba(0,0,0,0.05)',
    position: 'relative',
    overflow: 'hidden',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const logoContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    paddingTop: 28,
    paddingBottom: 20,
    marginBottom: 0,
    transition: 'transform 0.2s ease',
    position: 'sticky',
    top: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    flexShrink: 0,
  }

  const logoImageContainerStyle: React.CSSProperties = {
    width: 60,
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const logoTextStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '-0.025em',
    opacity: isExpanded ? 1 : 0,
    transform: `translateX(${isExpanded ? 0 : -10}px)`,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    display: isExpanded ? 'block' : 'none',
  }

  const navStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isExpanded ? 'flex-start' : 'center',
    justifyContent: 'flex-start',
    gap: isExpanded ? 12 : 20,
    flex: 1,
    width: '100%',
    paddingTop: 8,
    paddingBottom: 8,
    overflowY: 'auto',
    overflowX: 'hidden',
    minHeight: 0,
    scrollbarWidth: 'thin',
  }

  const getNavButtonStyle = (active: boolean): React.CSSProperties => ({
    width: isExpanded ? '100%' : collapsedWidth,
    height: 62,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: isExpanded ? 14 : 0,
    paddingLeft: isExpanded ? 16 : collapsedIconOffset,
    paddingRight: isExpanded ? 16 : collapsedIconOffset,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: active ? '#8B5CF6' : 'transparent',
    color: active ? '#FFFFFF' : '#6B7280',
    boxShadow: active
      ? (isExpanded ? '0 4px 12px rgba(139,92,246,0.4)' : '0 6px 20px rgba(139,92,246,0.35)')
      : 'none',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '14px',
  })

  const iconWrapperStyle: React.CSSProperties = {
    width: iconSlotSize,
    height: iconSlotSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  const getNavLabelStyle = (active: boolean): React.CSSProperties => ({
    opacity: isExpanded ? 1 : 0,
    transform: `translateX(${isExpanded ? 0 : -8}px)`,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    color: active ? '#FFFFFF' : '#111827',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    textOverflow: 'clip',
  })

  const avatarContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    paddingTop: isExpanded ? 24 : 16,
    paddingBottom: 28,
    paddingLeft: isExpanded ? 12 : 0,
    paddingRight: isExpanded ? 12 : 0,
    position: 'sticky',
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    flexShrink: 0,
    boxSizing: 'border-box',
  }

  const avatarWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    overflow: 'visible',
  }

  const avatarImageWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '48px',
    height: '48px',
    minWidth: '48px',
    minHeight: '48px',
    maxWidth: '48px',
    maxHeight: '48px',
    marginBottom: 8,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '50%',
    boxSizing: 'border-box',
    isolation: 'isolate',
    aspectRatio: '1 / 1',
    contain: 'layout style paint',
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  const avatarButtonStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.2s',
    width: '100%',
    maxWidth: '100%',
    position: 'relative',
    zIndex: 1,
  }

  // Calculer le style de l'avatar dynamiquement pour qu'il se mette à jour
  const avatarStyle: React.CSSProperties = useMemo(() => {
    console.log('🎨 [Sidebar] Computing avatarStyle with avatarUrl:', avatarUrl);
    const style: React.CSSProperties = {
      width: '48px',
      height: '48px',
      minWidth: '48px',
      minHeight: '48px',
      maxWidth: '48px',
      maxHeight: '48px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontWeight: 700,
      fontSize: '14px',
      marginBottom: '8px',
      transition: 'all 0.2s',
      boxShadow: showProfileMenu ? '0 4px 12px rgba(139,92,246,0.4)' : 'none',
      transform: showProfileMenu ? 'scale(1.1)' : 'scale(1)',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      aspectRatio: '1 / 1',
    };
    
    if (avatarUrl) {
      style.backgroundColor = 'transparent';
      style.backgroundImage = `url("${avatarUrl}")`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
    } else {
      style.backgroundColor = '#9333EA';
      style.backgroundImage = 'none';
    }
    
    return style;
  }, [avatarUrl, showProfileMenu])
  
  // Log pour déboguer les changements d'avatarUrl
  useEffect(() => {
    console.log('🔄 [Sidebar] avatarUrl changed:', avatarUrl);
  }, [avatarUrl]);

  const avatarNameStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    opacity: isExpanded ? 1 : 0,
    transform: `translateX(${isExpanded ? 0 : -10}px)`,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    textAlign: isExpanded ? 'left' : 'center',
    marginTop: 4,
    marginBottom: 0,
    paddingBottom: 0,
  }

  const profileMenuStyle: React.CSSProperties = {
    position: 'fixed',
    top: menuPosition ? `${menuPosition.top}px` : '0',
    left: menuPosition ? `${menuPosition.left}px` : '0',
    transform: menuPosition ? 'translateY(-50%)' : 'none',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '1px solid #E5E7EB',
    minWidth: '220px',
    zIndex: 10000,
    padding: '0',
    display: showProfileMenu && menuPosition ? 'block' : 'none',
  }

  const profileMenuHeaderStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #E5E7EB',
  }

  const profileMenuUserNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  }

  const profileMenuUserEmailStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6B7280',
  }

  const profileMenuItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background-color 0.2s',
    textDecoration: 'none',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    backgroundColor: 'transparent',
  }

  const profileMenuDividerStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: '#E5E7EB',
    margin: '0',
  }

  return (
    <div
      style={sidebarStyle}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div style={logoContainerStyle}>
        <div style={logoImageContainerStyle}>
          <Image
            src={logoImage}
            alt="Chrono Logo"
            width={60}
            height={60}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
        <p style={logoTextStyle}>
          tracking
        </p>
      </div>

      <nav style={navStyle}>
        {/* Navigation principale */}
        {mainNavigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              style={getNavButtonStyle(active)}
            >
              <span style={iconWrapperStyle}>
                <Icon size={20} />
              </span>
              {isExpanded && (
                <span style={getNavLabelStyle(active)}>{item.label}</span>
              )}
            </Link>
          );
        })}

        {/* Sections repliables */}
        {isExpanded && navigationSections.map((section) => {
          const SectionIcon = section.icon;
          const isExpanded = expandedSections.has(section.id);
          const hasActiveItem = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + "/")
          );

          return (
            <div key={section.id} style={{ width: '100%', marginTop: '8px' }}>
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedSections);
                  if (newExpanded.has(section.id)) {
                    newExpanded.delete(section.id);
                  } else {
                    newExpanded.add(section.id);
                  }
                  setExpandedSections(newExpanded);
                }}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 16,
                  paddingRight: 12,
                  backgroundColor: hasActiveItem ? '#F3F4F6' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = hasActiveItem ? '#F3F4F6' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <SectionIcon size={18} color={hasActiveItem ? '#8B5CF6' : '#6B7280'} />
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: hasActiveItem ? '#8B5CF6' : '#6B7280',
                    whiteSpace: 'nowrap',
                  }}>
                    {section.label}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} color="#6B7280" />
                ) : (
                  <ChevronRight size={16} color="#6B7280" />
                )}
              </button>

              {isExpanded && (
                <div style={{
                  marginTop: '4px',
                  marginLeft: '16px',
                  paddingLeft: '16px',
                  borderLeft: '2px solid #E5E7EB',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  {section.items.map((item, index) => {
                    const ItemIcon = item.icon;
                    let active = pathname === item.href || pathname.startsWith(item.href + "/");
                    
                    // Détection spéciale pour les pages Finance/Commissions
                    if (item.href === "/finances") {
                      if (item.label === "Transactions Clients") {
                        active = pathname === "/finance" || pathname.startsWith("/finance/");
                      } else if (item.label === "Commissions Livreurs") {
                        active = pathname === "/commissions" || pathname.startsWith("/commissions/");
                      }
                    }

                    // Clé unique basée sur l'index et le label pour éviter les doublons
                    const uniqueKey = `${section.id}-${item.label}-${index}`;
                    const actualHref = item.label === "Transactions Clients" ? "/finance" : item.label === "Commissions Livreurs" ? "/commissions" : item.href;

                    return (
                      <Link
                        key={uniqueKey}
                        href={actualHref}
                        style={{
                          ...getNavButtonStyle(active),
                          height: 44,
                          paddingLeft: 12,
                          marginLeft: 0,
                        }}
                      >
                        <span style={iconWrapperStyle}>
                          <ItemIcon size={18} />
                        </span>
                        <span style={getNavLabelStyle(active)}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Afficher les sections en mode collapsed comme des icônes simples */}
        {!isExpanded && navigationSections.map((section) => {
          const SectionIcon = section.icon;
          const hasActiveItem = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + "/")
          );

          return (
            <div key={section.id} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedSections);
                  if (newExpanded.has(section.id)) {
                    newExpanded.delete(section.id);
                  } else {
                    newExpanded.add(section.id);
                  }
                  setExpandedSections(newExpanded);
                }}
                style={{
                  width: collapsedWidth,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hasActiveItem ? '#F3F4F6' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = hasActiveItem ? '#F3F4F6' : 'transparent';
                }}
              >
                <SectionIcon size={20} color={hasActiveItem ? '#8B5CF6' : '#6B7280'} />
              </button>
            </div>
          );
        })}
      </nav>

      <div style={avatarContainerStyle}>
        <div style={avatarWrapperStyle} ref={profileMenuRef}>
          <button
            style={avatarButtonStyle}
            onClick={() => {
              if (profileMenuRef.current) {
                const rect = profileMenuRef.current.getBoundingClientRect();
                const sidebarWidth = isExpanded ? expandedWidth : collapsedWidth;
                setMenuPosition({
                  top: rect.top + rect.height / 2,
                  left: rect.left + sidebarWidth + 16,
                });
              }
              setShowProfileMenu(!showProfileMenu);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              if (!showProfileMenu) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <div style={avatarImageWrapperStyle}>
              {avatarUrl ? (
                <>
                  {console.log('[Sidebar] Rendering avatar with URL:', avatarUrl)}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      key={avatarUrl} 
                      src={avatarUrl}
                      alt="Avatar"
                      width={48}
                      height={48}
                      unoptimized={true}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block',
                        backgroundColor: 'transparent',
                      }}
                      onLoad={() => {
                        console.log(' [Sidebar] Avatar image loaded successfully:', avatarUrl);
                      }}
                      onError={(e) => {
                        console.error(' [Sidebar] Avatar image failed to load:', avatarUrl);
                        console.error('Error event:', e);
                        // Si l'image ne charge pas, réinitialiser avatarUrl pour afficher les initiales
                        setAvatarUrl(null);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={avatarStyle}>
                  {getUserInitials()}
                </div>
              )}
            </div>
            {isExpanded && (
              <p style={avatarNameStyle}>{getUserName()}</p>
            )}
          </button>

          {showProfileMenu && menuPosition && (
            <div style={profileMenuStyle}>
              <div style={profileMenuHeaderStyle}>
                <div style={profileMenuUserNameStyle}>{getUserName()}</div>
                <div style={profileMenuUserEmailStyle}>{user?.email || ''}</div>
              </div>
              <Link
                href="/settings"
                style={profileMenuItemStyle}
                onClick={() => setShowProfileMenu(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>Mon profil</span>
              </Link>
              <Link
                href="/settings"
                style={profileMenuItemStyle}
                onClick={() => setShowProfileMenu(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>Paramètres</span>
              </Link>
              <div style={profileMenuDividerStyle} />
              <button
                style={{
                  ...profileMenuItemStyle,
                  color: '#DC2626',
                }}
                onClick={handleSignOut}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
