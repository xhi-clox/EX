'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Folder,
  Sparkles,
  BarChart2,
  Settings,
  User,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { Logo } from '../icons/Logo';
import { cn } from '@/lib/utils';

const navSections = [
    {
        title: "Main",
        items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/question-bank', label: 'Question Bank', icon: BookOpen },
            { href: '/papers', label: 'Papers', icon: FileText },
            { href: '/projects', label: 'Projects', icon: Folder },
        ]
    },
    {
        title: "Tools",
        items: [
            { href: '/ai-generator', label: 'AI Generator', icon: Sparkles },
            { href: '/analytics', label: 'Analytics', icon: BarChart2 },
            { href: '/settings', label: 'Settings', icon: Settings },
        ]
    },
    {
        title: "Account",
        items: [
            { href: '/profile', label: 'Profile', icon: User },
            { href: '/help', label: 'Help & Support', icon: HelpCircle },
            { href: '/logout', label: 'Logout', icon: LogOut },
        ]
    }
]

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] bg-surface border-r border-border fixed h-full py-6 sidebar-scrollbar overflow-y-auto hidden md:block">
        <div className="px-6 pb-6 border-b border-border mb-6">
            <div className="flex items-center gap-3 text-lg font-bold">
                <Logo />
                <span>ExamPro</span>
            </div>
        </div>
        
        {navSections.map(section => (
            <div key={section.title} className="mb-8">
                <h3 className="text-xs font-semibold uppercase text-text-tertiary tracking-wider px-6 pb-3">{section.title}</h3>
                <nav>
                    {section.items.map(item => (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 py-3 px-6 text-text-secondary font-medium border-l-4 transition-colors",
                                pathname === item.href 
                                    ? "text-primary bg-[rgba(139,92,246,0.1)] border-primary" 
                                    : "border-transparent hover:text-primary hover:bg-[rgba(139,92,246,0.05)]"
                            )}
                        >
                            <item.icon className="size-5" />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>
        ))}
    </aside>
  );
}
