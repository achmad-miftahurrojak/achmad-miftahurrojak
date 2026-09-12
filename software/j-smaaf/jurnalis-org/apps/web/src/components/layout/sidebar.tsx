'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderKanban, ListTodo, CalendarDays, Newspaper, PenSquare,
  Wallet, Lightbulb, Image, BarChart3, Trophy, Users, BookOpen, Settings, HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { EDITORIAL_ACCESS, FINANCE_READ, ANALYTICS_ACCESS, ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: readonly string[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tugas', icon: ListTodo },
  { href: '/projects', label: 'Proyek', icon: FolderKanban },
  { href: '/schedule', label: 'Jadwal', icon: CalendarDays },
  { href: '/content', label: 'Konten', icon: Newspaper },
  { href: '/editorial', label: 'Editorial', icon: PenSquare, roles: EDITORIAL_ACCESS },
  { href: '/finance', label: 'Keuangan', icon: Wallet, roles: FINANCE_READ },
  { href: '/pitches', label: 'Pitch Board', icon: Lightbulb },
  { href: '/assets', label: 'Aset', icon: Image },
  { href: '/performance', label: 'Kinerja', icon: Trophy },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ANALYTICS_ACCESS },
  { href: '/sop/manage', label: 'SOP', icon: BookOpen },
  { href: '/alumni/profile', label: 'Profil Alumni', icon: Users, roles: ['alumni'] },
  { href: '/storage', label: 'Storage', icon: HardDrive, roles: ANALYTICS_ACCESS },
  { href: '/users', label: 'Pengguna', icon: Users, roles: ADMIN_OR_KETUA },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: user } = useUser()

  const items = NAV_ITEMS.filter((item) => !item.roles || (user && (item.roles as readonly string[]).includes(user.role)))

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          Jurnalis Org
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
