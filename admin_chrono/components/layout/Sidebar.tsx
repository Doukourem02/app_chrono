"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {LayoutDashboard,MapPin,Package,MessageSquare,FileText,Wallet,Calendar,Users,Truck,TrendingUp,Trophy,ChevronDown,ChevronRight,CreditCard,Coins,Tag,AlertTriangle,Car,Wrench,Shield,Sliders,} from "lucide-react";
import Image from "next/image";
import logoImage from "@/assets/logo.png";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import { themeColors } from "@/utils/theme";
import { useThemeStore } from "@/stores/themeStore";
import { useTranslation } from "@/hooks/useTranslation";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  key?: string; // Clé pour les traductions
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  items: NavItem[];
}

// Les labels seront traduits dynamiquement dans le composant
const mainNavigationKeys = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/tracking", icon: MapPin, key: "tracking" },
  { href: "/orders", icon: Package, key: "orders" },
  { href: "/message", icon: MessageSquare, key: "message" },
];

const navigationSectionsKeys = [
  {
    id: "analyses",
    key: "analyses",
    icon: TrendingUp,
    items: [
      { href: "/analytics", icon: TrendingUp, key: "analytics" },
      { href: "/reports", icon: FileText, key: "reports" },
    ],
  },
  {
    id: "finances",
    key: "finances",
    icon: Wallet,
    items: [
      { href: "/finances", icon: CreditCard, key: "clientTransactions" },
      { href: "/finances", icon: Coins, key: "driverCommissions" },
    ],
  },
  {
    id: "gestion",
    key: "gestion",
    icon: Users,
    items: [
      { href: "/users", icon: Users, key: "users" },
      { href: "/drivers", icon: Truck, key: "drivers" },
      { href: "/gamification", icon: Trophy, key: "performance" },
    ],
  },
  {
    id: "maintenance",
    key: "maintenance",
    icon: Car,
    items: [
      { href: "/maintenance", icon: Car, key: "overview" },
      { href: "/maintenance/vehicles", icon: Truck, key: "vehicles" },
      { href: "/maintenance/repairs", icon: Wrench, key: "repairs" },
      { href: "/maintenance/documents", icon: FileText, key: "documents" },
      { href: "/maintenance/budget", icon: Wallet, key: "budget" },
    ],
  },
  {
    id: "administration",
    key: "administration",
    icon: Shield,
    items: [
      { href: "/planning", icon: Calendar, key: "planning" },
      { href: "/promo-codes", icon: Tag, key: "promoCodes" },
      { href: "/disputes", icon: AlertTriangle, key: "disputes" },
      { href: "/settings", icon: Sliders, key: "settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isDarkMode = theme === 'dark';
  const t = useTranslation();
  
  // Construire la navigation avec les traductions
  const mainNavigation: NavItem[] = mainNavigationKeys.map(item => ({
    ...item,
    label: t(`sidebar.mainNav.${item.key}`)
  }));
  
  const navigationSections: NavSection[] = navigationSectionsKeys.map(section => ({
    ...section,
    label: t(`sidebar.sections.${section.key}.title`),
    items: section.items.map(item => ({
      ...item,
      label: t(`sidebar.sections.${section.key}.${item.key}`)
    }))
  }));
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; phone?: string; first_name?: string | null; last_name?: string | null } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; transform?: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['analyses', 'gestion', 'administration']));
  const isOpeningMenuRef = useRef(false);
  const menuJustOpenedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      logger.debug('🔄 [Sidebar] Loading profile for user:', user.id);
      const { data: userData, error } = await supabase
        .from('users')
        .select('avatar_url, phone, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug('[Sidebar] User not found in users table, using user_metadata');
          setAvatarUrl(null);
        setUserProfile({
          full_name: user?.user_metadata?.full_name || undefined,
          phone: undefined,
          first_name: undefined,
          last_name: undefined,
        });
        } else {
          logger.warn('[Sidebar] Error loading profile from users table:', {
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
        logger.debug('[Sidebar] Profile loaded from database:', {
          avatar_url: userData.avatar_url,
          avatar_url_type: typeof userData.avatar_url,
          avatar_url_length: userData.avatar_url?.length,
          phone: userData.phone,
          user_id: user.id,
        });
        let newAvatarUrl = userData.avatar_url || null;
        logger.debug('[Sidebar] Raw avatar URL from DB:', newAvatarUrl);
        
        // Corriger l'URL si elle contient un double "avatars/avatars"
        if (newAvatarUrl && newAvatarUrl.includes('/avatars/avatars/')) {
          newAvatarUrl = newAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          logger.debug('🔧 [Sidebar] Corrected URL from double avatars:', newAvatarUrl);
        }
        
        // Vérifier que l'URL est valide
        if (newAvatarUrl && !newAvatarUrl.startsWith('http')) {
          logger.warn('[Sidebar] Avatar URL does not start with http:', newAvatarUrl);
        }
        
        logger.debug('[Sidebar] Final avatar URL to set:', newAvatarUrl);
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
      logger.warn('[Sidebar] Unexpected error loading profile:', {
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
  }, [user, setAvatarUrl, setUserProfile]);

  useEffect(() => {
    requestAnimationFrame(() => {
      loadProfile();
    });
  }, [loadProfile]);

  useEffect(() => {
    const handleAvatarUpdate = (event: CustomEvent) => {
      const { avatarUrl: newAvatarUrl } = event.detail;
      logger.debug('📢 [Sidebar] Received avatar-updated event:', { newAvatarUrl });
      if (newAvatarUrl) {
        let correctedUrl = newAvatarUrl;
        if (newAvatarUrl.includes('/avatars/avatars/')) {
          correctedUrl = newAvatarUrl.replace('/avatars/avatars/', '/avatars/');
          logger.debug('[Sidebar] Corrected URL from:', newAvatarUrl, 'to:', correctedUrl);
        }
        logger.debug('[Sidebar] Setting avatar URL immediately:', correctedUrl);
        setAvatarUrl(correctedUrl);
        loadProfile();
      } else {
        logger.warn('[Sidebar] No avatar URL in event detail');
      }
    };

    const handleProfileUpdate = (event: CustomEvent) => {
      const { fullName, phone, avatarUrl: newAvatarUrl } = event.detail;
      logger.debug('[Sidebar] Received profile-updated event:', { fullName, phone, newAvatarUrl });
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
          logger.debug('[Sidebar] Corrected URL from:', newAvatarUrl, 'to:', correctedUrl);
        }
        logger.debug('[Sidebar] Setting avatar URL from profile-updated:', correctedUrl);
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
  const expandedWidth = 340
  const iconSlotSize = 44
  const collapsedIconOffset = Math.max((collapsedWidth - iconSlotSize) / 2, 0)

  useEffect(() => {
    if (!showProfileMenu || !menuPosition) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Ignorer si on est en train d'ouvrir le menu ou si le menu vient d'être ouvert
      if (isOpeningMenuRef.current || menuJustOpenedRef.current) {
        logger.debug('[Sidebar] Ignoring click outside - menu is opening or just opened');
        return;
      }
      
      const target = event.target as Node;
      const clickedElement = target as HTMLElement;
      
      // Vérifier si le clic est dans le bouton (en vérifiant le conteneur et le bouton lui-même)
      const buttonElement = profileMenuRef.current?.querySelector('button');
      const isClickInsideButton = profileMenuRef.current?.contains(target) || 
                                  buttonElement?.contains(target) ||
                                  clickedElement === buttonElement;
      
      // Vérifier si le clic est dans le menu
      const isClickInsideMenu = profileDropdownRef.current?.contains(target);
      
      logger.debug('[Sidebar] Click outside check:', {
        isClickInsideButton,
        isClickInsideMenu,
        isOpening: isOpeningMenuRef.current,
        justOpened: menuJustOpenedRef.current,
        target: clickedElement?.tagName,
      });
      
      // Ne fermer le menu que si le clic est vraiment en dehors du bouton ET du menu
      if (!isClickInsideButton && !isClickInsideMenu) {
        logger.debug('[Sidebar] Closing profile menu - click outside');
        setShowProfileMenu(false);
        setMenuPosition(null);
      } else {
        logger.debug('[Sidebar] Click is inside button or menu - keeping menu open');
      }
    };

    // Ajouter le listener après un délai pour laisser le onClick se terminer
    // et éviter que le clic sur le bouton ne ferme immédiatement le menu
    const timeoutId = setTimeout(() => {
      logger.debug('[Sidebar] Adding click outside listener');
      // Utiliser 'mousedown' avec capture pour détecter les clics en dehors
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 800);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu, menuPosition]);

  // Mettre à jour la position du menu quand le sidebar se redimensionne
  // Utiliser un debounce pour éviter les recalculs trop fréquents
  useEffect(() => {
    if (!showProfileMenu || !profileMenuRef.current) return;
    
    const updateMenuPosition = () => {
      if (!profileMenuRef.current) return;
      
      const rect = profileMenuRef.current.getBoundingClientRect();
      const sidebarWidth = isExpanded ? expandedWidth : collapsedWidth;
      
      // Hauteur estimée du menu (header + 3 items + padding)
      const menuHeight = 200; // Approximatif : header (~60px) + 3 items (~120px) + padding
      const windowHeight = window.innerHeight;
      const buttonCenterY = rect.top + rect.height / 2;
      
      // Vérifier si le menu dépasse en bas de l'écran
      const menuBottomIfCentered = buttonCenterY + menuHeight / 2;
      const shouldPositionAbove = menuBottomIfCentered > windowHeight - 20; // 20px de marge
      
      let top: number;
      let transform: string;
      
      if (shouldPositionAbove) {
        // Positionner le menu au-dessus du bouton
        top = rect.top - menuHeight - 8; // 8px d'espace entre le bouton et le menu
        transform = 'none';
      } else {
        // Centrer le menu verticalement
        top = buttonCenterY;
        transform = 'translateY(-50%)';
      }
      
      setMenuPosition(prev => {
        // Ne mettre à jour que si la position a vraiment changé (évite les re-renders inutiles)
        if (prev && Math.abs(prev.top - top) < 1 && prev.left === rect.left + sidebarWidth + 16 && prev.transform === transform) {
          return prev;
        }
        return {
          top,
          left: rect.left + sidebarWidth + 16,
          transform,
        };
      });
    };
    
    // Debounce pour éviter les recalculs trop fréquents
    const timeoutId = setTimeout(updateMenuPosition, 50);
    
    return () => {
      clearTimeout(timeoutId);
    };
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
    backgroundColor: themeColors.cardBg,
    borderRight: `1px solid ${themeColors.cardBorder}`,
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
    backgroundColor: themeColors.cardBg,
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
    color: themeColors.textPrimary,
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
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: isExpanded ? 'flex-start' : 'center',
    gap: isExpanded ? 12 : 0,
    paddingLeft: collapsedIconOffset, // TOUJOURS le même padding pour garder les icônes alignées
    paddingRight: isExpanded ? 16 : collapsedIconOffset,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: active ? themeColors.purplePrimary : 'transparent',
    color: active ? '#FFFFFF' : themeColors.textSecondary,
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
    minWidth: iconSlotSize,
    minHeight: iconSlotSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    flexGrow: 0,
  }

  const getNavLabelStyle = (active: boolean): React.CSSProperties => ({
    opacity: isExpanded ? 1 : 0,
    transform: `translateX(${isExpanded ? 0 : -8}px)`,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    color: active ? '#FFFFFF' : themeColors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'visible',
    textOverflow: 'clip',
    display: 'flex',
    alignItems: 'center',
    lineHeight: '1.5',
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
    backgroundColor: themeColors.cardBg,
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
    zIndex: 1000, // Augmenté pour être au-dessus du Header
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
    zIndex: 1000, // Augmenté pour être au-dessus du Header
  }

  // Calculer le style de l'avatar dynamiquement pour qu'il se mette à jour
  const avatarStyle: React.CSSProperties = useMemo(() => {
    logger.debug('🎨 [Sidebar] Computing avatarStyle with avatarUrl:', avatarUrl);
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
    logger.debug('🔄 [Sidebar] avatarUrl changed:', avatarUrl);
  }, [avatarUrl]);

  // Log pour déboguer le menu de profil
  useEffect(() => {
    logger.debug('🔍 [Sidebar] Profile menu state:', {
      showProfileMenu,
      menuPosition,
      shouldDisplay: showProfileMenu && menuPosition !== null,
    });
  }, [showProfileMenu, menuPosition]);

  const avatarNameStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: themeColors.textPrimary,
    opacity: isExpanded ? 1 : 0,
    transform: `translateX(${isExpanded ? 0 : -10}px)`,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    textAlign: isExpanded ? 'left' : 'center',
    marginTop: 4,
    marginBottom: 0,
    paddingBottom: 0,
  }

  const profileMenuStyle: React.CSSProperties = useMemo(() => ({
    position: 'fixed',
    top: menuPosition ? `${menuPosition.top}px` : '0',
    left: menuPosition ? `${menuPosition.left}px` : '0',
    transform: menuPosition?.transform || 'none',
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: `1px solid ${themeColors.cardBorder}`,
    minWidth: '220px',
    maxHeight: typeof window !== 'undefined' ? `${window.innerHeight - 40}px` : 'auto',
    overflowY: 'auto',
    zIndex: 999999, // Très élevé pour être au-dessus de tout
    padding: '0',
    display: 'block', // Toujours afficher quand le composant est rendu
    pointerEvents: 'auto',
  }), [menuPosition])

  const profileMenuHeaderStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  const profileMenuUserNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: themeColors.textPrimary,
    marginBottom: '4px',
  }

  const profileMenuUserEmailStyle: React.CSSProperties = {
    fontSize: '13px',
    color: themeColors.textSecondary,
  }

  const profileMenuItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '14px',
    color: themeColors.textPrimary,
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
    backgroundColor: themeColors.cardBorder,
    margin: '0',
  }

  return (
    <div
      style={sidebarStyle}
      onMouseEnter={() => {
        // Ne pas développer le sidebar si le menu de profil est ouvert
        if (!showProfileMenu) {
          setIsExpanded(true);
        }
      }}
      onMouseLeave={() => {
        // Ne pas rétrécir le sidebar si le menu de profil est ouvert
        if (!showProfileMenu) {
          setIsExpanded(false);
        }
      }}
    >
      <div style={logoContainerStyle}>
        <div style={logoImageContainerStyle}>
          <Image
            src={logoImage}
            alt="Chrono Logo"
            width={60}
            height={60}
            style={{ 
              objectFit: 'contain',
              mixBlendMode: isDarkMode ? 'lighten' : 'normal',
              filter: isDarkMode ? 'brightness(1.1)' : 'none',
            }}
            priority
          />
        </div>
        <p style={logoTextStyle}>
          {t('sidebar.logo')}
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
                  paddingLeft: collapsedIconOffset, // Même padding que les items principaux pour alignement vertical
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
                  <span style={iconWrapperStyle}>
                    <SectionIcon size={18} color={hasActiveItem ? '#8B5CF6' : '#6B7280'} />
                  </span>
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
                    let active = false;
                    
                    // Détection spéciale pour les pages Finance/Commissions
                    if (item.href === "/finances") {
                      if (item.key === "clientTransactions") {
                        active = pathname === "/finance" || pathname.startsWith("/finance/");
                      } else if (item.key === "driverCommissions") {
                        active = pathname === "/commissions" || pathname.startsWith("/commissions/");
                      }
                    } else {
                      // Pour les autres routes, vérifier d'abord les correspondances exactes
                      if (pathname === item.href) {
                        active = true;
                      } else if (pathname.startsWith(item.href + "/")) {
                        // Vérifier qu'il n'y a pas d'autre item de la même section avec un href plus spécifique qui correspond
                        // Un item est "plus spécifique" si son href est plus long et commence par l'href de l'item actuel + "/"
                        const hasMoreSpecificMatch = section.items.some(otherItem => {
                          if (otherItem.href === item.href) return false; // Ignorer l'item actuel
                          // Si l'autre item a un href qui est plus long et commence par l'href de l'item actuel
                          if (otherItem.href.startsWith(item.href + "/")) {
                            // Vérifier si le pathname correspond à cet autre item (exactement ou avec un "/" après)
                            return pathname === otherItem.href || pathname.startsWith(otherItem.href + "/");
                          }
                          return false;
                        });
                        active = !hasMoreSpecificMatch;
                      }
                    }

                    // Clé unique basée sur l'index et la clé pour éviter les doublons
                    const uniqueKey = `${section.id}-${item.key}-${index}`;
                    const actualHref = item.key === "clientTransactions" ? "/finance" : item.key === "driverCommissions" ? "/commissions" : item.href;

                    return (
                      <Link
                        key={uniqueKey}
                        href={actualHref}
                        style={{
                          ...getNavButtonStyle(active),
                          height: 40,
                          paddingLeft: collapsedIconOffset + 16, // Aligné avec les items principaux + indentation
                          marginLeft: 0,
                          minHeight: 40,
                        }}
                      >
                        <span style={{...iconWrapperStyle, width: 32, height: 32, minWidth: 32, minHeight: 32}}>
                          <ItemIcon size={16} />
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
            onClick={(e) => {
              e.stopPropagation(); // Empêcher la propagation du clic
              e.preventDefault(); // Empêcher le comportement par défaut
              
              // Si le menu est déjà ouvert, le fermer
              if (showProfileMenu) {
                setShowProfileMenu(false);
                setMenuPosition(null);
                isOpeningMenuRef.current = false;
                menuJustOpenedRef.current = false;
                return;
              }
              
              // Marquer qu'on est en train d'ouvrir le menu IMMÉDIATEMENT
              isOpeningMenuRef.current = true;
              
              // Ouvrir le menu et calculer la position
              if (profileMenuRef.current) {
                const rect = profileMenuRef.current.getBoundingClientRect();
                const sidebarWidth = isExpanded ? expandedWidth : collapsedWidth;
                
                // Hauteur estimée du menu (header + 3 items + padding)
                const menuHeight = 200; // Approximatif : header (~60px) + 3 items (~120px) + padding
                const windowHeight = window.innerHeight;
                const buttonTop = rect.top;
                const buttonBottom = rect.bottom;
                
                // Calculer les positions possibles
                const spaceAbove = buttonTop;
                const spaceBelow = windowHeight - buttonBottom;
                const menuTopIfAbove = buttonTop - menuHeight - 8; // 8px d'espace
                const menuTopIfBelow = buttonBottom + 8; // 8px d'espace
                
                let top: number;
                let transform: string;
                
                // Déterminer la meilleure position pour garder le menu visible
                if (menuTopIfAbove >= 0 && spaceAbove >= menuHeight) {
                  // Assez d'espace au-dessus : positionner au-dessus
                  top = menuTopIfAbove;
                  transform = 'none';
                } else if (spaceBelow >= menuHeight) {
                  // Assez d'espace en dessous : positionner en dessous
                  top = menuTopIfBelow;
                  transform = 'none';
                } else if (spaceAbove >= spaceBelow) {
                  // Plus d'espace au-dessus : positionner au-dessus même si ça dépasse un peu
                  top = Math.max(8, buttonTop - menuHeight - 8); // Minimum 8px du haut
                  transform = 'none';
                } else {
                  // Plus d'espace en dessous : positionner en dessous même si ça dépasse un peu
                  top = Math.min(windowHeight - menuHeight - 8, menuTopIfBelow); // Maximum jusqu'au bas
                  transform = 'none';
                }
                
                // Définir la position et ouvrir le menu en même temps
                const newPosition = {
                  top,
                  left: rect.left + sidebarWidth + 16,
                  transform,
                };
                
                logger.debug('[Sidebar] Opening profile menu with position:', newPosition);
                
                // Marquer que le menu vient d'être ouvert
                menuJustOpenedRef.current = true;
                
                // Utiliser requestAnimationFrame pour s'assurer que le state est mis à jour
                requestAnimationFrame(() => {
                  setMenuPosition(newPosition);
                  setShowProfileMenu(true);
                  
                  // Réinitialiser les flags après un délai pour laisser le menu s'afficher
                  setTimeout(() => {
                    isOpeningMenuRef.current = false;
                    menuJustOpenedRef.current = false;
                    logger.debug('[Sidebar] Menu opening flags reset');
                  }, 1000);
                });
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation(); // Empêcher la propagation du mousedown
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
                  {logger.debug('[Sidebar] Rendering avatar with URL:', avatarUrl)}
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
                        logger.debug('[Sidebar] Avatar image loaded successfully:', avatarUrl);
                      }}
                      onError={(e) => {
                        logger.error('[Sidebar] Avatar image failed to load:', avatarUrl);
                        logger.error('Error event:', e);
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

          {typeof window !== 'undefined' && showProfileMenu && menuPosition && createPortal(
            <div 
              ref={profileDropdownRef} 
              style={profileMenuStyle}
              onClick={(e) => {
                e.stopPropagation(); // Empêcher la fermeture quand on clique dans le menu
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // Empêcher aussi le mousedown
              }}
            >
              <div style={profileMenuHeaderStyle}>
                <div style={profileMenuUserNameStyle}>{getUserName()}</div>
                <div style={profileMenuUserEmailStyle}>{user?.email || ''}</div>
              </div>
              <Link
                href="/profile"
                style={profileMenuItemStyle}
                onClick={() => setShowProfileMenu(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>{t('sidebar.profile.myProfile')}</span>
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
                <span>{t('sidebar.profile.settings')}</span>
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
                <span>{t('sidebar.profile.logout')}</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
