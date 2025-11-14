"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Package,
  MessageSquare,
  FileText,
  Wallet,
  Calendar,
  Users,
  Settings,
} from "lucide-react";
import Image from "next/image";
import logoImage from "@/assets/logo.png";

const navigation = [
  { href: "/dashboard", icon: LayoutDashboard },
  { href: "/tracking", icon: MapPin },
  { href: "/orders", icon: Package },
  { href: "/message", icon: MessageSquare },
  { href: "/reports", icon: FileText },
  { href: "/finance", icon: Wallet },
  { href: "/planning", icon: Calendar },
  { href: "/users", icon: Users },
  { href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const sidebarStyle: React.CSSProperties = {
    height: '100vh',
    width: '110px',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '40px',
    paddingBottom: '40px',
    borderTopRightRadius: '32px',
    borderBottomRightRadius: '32px',
    boxShadow: '4px 0 20px rgba(0,0,0,0.05)',
    position: 'relative',
  }

  const logoContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 10,
  }

  const logoImageContainerStyle: React.CSSProperties = {
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const logoTextStyle: React.CSSProperties = {
    marginTop: '12px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '-0.025em',
  }

  const navStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    flex: 1,
    width: '100%',
  }

  const getNavButtonStyle = (active: boolean): React.CSSProperties => ({
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    backgroundColor: active ? '#8B5CF6' : 'transparent',
    color: active ? '#FFFFFF' : '#6B7280',
    transform: active ? 'scale(1.1)' : 'scale(1)',
    boxShadow: active ? '0 4px 12px rgba(139,92,246,0.4)' : 'none',
    textDecoration: 'none',
  })

  const avatarContainerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    backgroundColor: '#9333EA',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '14px',
    marginBottom: '8px',
  }

  const avatarNameStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: '#374151',
  }

  return (
    <div style={sidebarStyle}>
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
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              style={getNavButtonStyle(active)}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = '#F3F4F6'
                  e.currentTarget.style.color = '#111827'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#6B7280'
                }
              }}
            >
              <Icon size={20} strokeWidth={1.7} />
            </Link>
          );
        })}
      </nav>

      <div style={avatarContainerStyle}>
        <div style={avatarStyle}>
          M
        </div>
        <p style={avatarNameStyle}>Moriarty</p>
      </div>
    </div>
  );
}
