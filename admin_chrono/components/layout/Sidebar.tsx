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
import clsx from "clsx";
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

  return (
    <div
      className="
        h-screen
        w-[110px]
        bg-white
        border-r border-gray-200
        flex flex-col
        items-center
        pt-10
        pb-10
        rounded-r-[32px]
        shadow-[4px_0_20px_rgba(0,0,0,0.05)]
        relative
      "
    >
      {/* LOGO en haut */}
      <div className="absolute top-10 flex flex-col items-center z-10">
        <div className="w-[60px] h-[60px] flex items-center justify-center">
          <Image
            src={logoImage}
            alt="Chrono Logo"
            width={60}
            height={60}
            className="object-contain"
            priority
          />
        </div>
        <p className="mt-3 text-[13px] font-semibold text-gray-700 tracking-tight">
          tracking
        </p>
      </div>

      {/* NAV : icônes centrées verticalement */}
      <nav className="flex flex-col items-center justify-center gap-6 flex-1 w-full">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-200",
                active
                  ? "bg-[#8B5CF6] text-white scale-[1.10] shadow-[0_4px_12px_rgba(139,92,246,0.4)]"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-[20px] h-[20px]" strokeWidth={1.7} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
