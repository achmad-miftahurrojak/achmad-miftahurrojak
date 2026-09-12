'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListTodo, CalendarDays, Newspaper, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { NAV_ITEMS } from './sidebar'

const BOTTOM_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tugas', icon: ListTodo },
  { href: '/schedule', label: 'Jadwal', icon: CalendarDays },
  { href: '/content', label: 'Konten', icon: Newspaper },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { data: user } = useUser()
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && (item.roles as readonly string[]).includes(user.role)))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t bg-background lg:hidden">
      {BOTTOM_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[11px]',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <Menu className="h-5 w-5" />
          Menu
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <div className="grid grid-cols-3 gap-3 py-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 text-xs font-medium',
                  pathname.startsWith(item.href) ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
