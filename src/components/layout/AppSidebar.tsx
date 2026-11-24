'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Folder,
  Settings,
  User,
  HelpCircle,
  LogOut,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';
import { Logo } from '../icons/Logo';
import { cn } from '@/lib/utils';

const navSections = [
    {
        title: "Main",
        items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/projects', label: 'Projects', icon: Folder },
        ]
    },
    {
        title: "Account",
        items: [
            { href: '/settings', label: 'Settings', icon: Settings },
            { href: '/profile', label: 'Profile', icon: User },
            { href: '/help', label: 'Help & Support', icon: HelpCircle },
            { href: '/logout', label: 'Logout', icon: LogOut },
        ]
    }
]

interface AppSidebarProps {
    onCollapseChange?: (collapsed: boolean) => void;
}

export function AppSidebar({ onCollapseChange }: AppSidebarProps) {
  const pathname = usePathname();
    const [hidden, setHidden] = useState(false);

    const toggleHidden = () => {
        setHidden(current => {
            const next = !current;
            onCollapseChange?.(next);
            return next;
        });
    };

    if (hidden) {
        return (
            <button
                type="button"
                aria-label="Show sidebar"
                title="Show sidebar"
                onClick={toggleHidden}
                className="fixed left-3 top-6 z-50 hidden size-9 items-center justify-center rounded-xl border border-[#315b60] bg-[#12363c] text-[#d3e4e1] shadow-lg transition-colors hover:bg-[#1d4a50] hover:text-white md:flex"
            >
                <PanelLeftOpen className="size-4" />
            </button>
        );
    }

  return (
        <aside className="fixed hidden h-full w-[260px] overflow-y-auto bg-[#12363c] py-6 text-white shadow-[8px_0_30px_rgba(23,52,58,0.08)] sidebar-scrollbar md:block">
                <div className="mb-8 border-b border-white/10 px-6 pb-6">
                        <div className="flex items-center gap-3 text-lg font-bold tracking-[-0.02em]">
                <Logo />
                                <span>ExamPro</span>
            </div>
        </div>

                <button
                    type="button"
                    aria-label="Hide sidebar"
                    title="Hide sidebar"
                    onClick={toggleHidden}
                    className="absolute right-3 top-7 flex size-7 items-center justify-center rounded-lg text-[#b5ccca] transition-colors hover:bg-white/10 hover:text-white"
                >
                    <PanelLeftClose className="size-4" />
                </button>
        
        {navSections.map(section => (
            <div key={section.title} className="mb-8">
                <h3 className="px-6 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#83a6a5]">{section.title}</h3>
                <nav>
                    {section.items.map(item => (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 border-l-4 py-3 text-sm font-semibold text-[#b5ccca] transition-colors",
                                'px-6',
                                pathname === item.href 
                                    ? "border-[#70c7b6] bg-white/10 text-white"
                                    : "border-transparent hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon className="size-[18px]" />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>
        ))}
    </aside>
  );
}
