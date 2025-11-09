'use client';

import { Bell, Settings, Search } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="bg-surface rounded-lg p-6 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-border flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1.5 bg-gradient-to-r from-text-primary to-primary-light bg-clip-text text-transparent">
            Welcome back, Professor!
          </h1>
        </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search papers, projects..."
            className="bg-card border border-border rounded-lg w-72 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
          />
        </div>
        <button className="bg-card border border-border rounded-lg size-11 flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors relative">
            <Bell className="size-5" />
            <span className="absolute -top-1 -right-1 bg-danger text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center border-2 border-surface">3</span>
        </button>
        <button className="bg-card border border-border rounded-lg size-11 flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary transition-colors">
            <Settings className="size-5" />
        </button>
      </div>
    </header>
  );
}
