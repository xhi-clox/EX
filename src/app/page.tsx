'use client';

import { useState } from 'react';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Projects } from '@/components/dashboard/Projects';
import { History, Folder, Bolt } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';

export default function Home() {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f3f7f6] text-[#17343a] lg:h-screen lg:overflow-hidden">
      <AppSidebar onCollapseChange={setSidebarHidden} />
      <main className={`flex-1 px-5 py-5 transition-[margin] duration-200 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-8 lg:py-7 ${sidebarHidden ? 'md:ml-0' : 'md:ml-[260px]'}`}>
        <div className="shrink-0">
          <AppHeader />
        </div>
        <div className="mt-6 grid grid-cols-12 items-stretch gap-5 lg:min-h-0 lg:flex-1">
          {/* Each card below owns its own scrollbar */}
          <div className="col-span-12 flex flex-col gap-5 lg:col-span-4 lg:min-h-0">
            <section className="flex shrink-0 flex-col rounded-2xl border border-[#d7e5e1] bg-white p-6 shadow-[0_10px_30px_rgba(23,52,58,0.05)] lg:max-h-[60%] lg:min-h-0">
              <div className="shrink-0">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b8385]">Create</p>
                <h2 className="mb-6 flex items-center gap-2.5 text-xl font-bold tracking-[-0.02em] text-[#17343a]">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#e3f2ee] text-[#0f766e]"><Bolt className="size-4" /></span>
                  Quick actions
                </h2>
              </div>
              <div className="app-scrollbar-light min-h-0 flex-1 overscroll-contain lg:overflow-y-auto lg:pr-1">
                <QuickActions />
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#d7e5e1] bg-white p-6 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
                <div className="mb-6 flex shrink-0 items-center justify-between">
                    <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.02em] text-[#17343a]">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-[#fbe8e4] text-[#c65d4d]"><History className="size-4" /></span>
                        Recent activity
                    </h2>
                    <a href="#" className="text-sm font-bold text-[#0f766e] transition-colors hover:text-[#115e59]">View all</a>
                </div>
                <div className="app-scrollbar-light min-h-0 flex-1 overscroll-contain lg:overflow-y-auto lg:pr-1">
                  <RecentActivity />
                </div>
            </section>
          </div>

          {/* Papers panel owns its own scrollbar */}
          <div className="col-span-12 lg:col-span-8 lg:min-h-0">
                <section className="flex h-full min-h-[calc(100vh-180px)] flex-col rounded-2xl border border-[#d7e5e1] bg-white p-6 shadow-[0_10px_30px_rgba(23,52,58,0.05)] lg:min-h-0">
                  <div className="mb-6 flex shrink-0 items-center justify-between">
                      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.02em] text-[#17343a]">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-[#fff1dc] text-[#c77b22]"><Folder className="size-4" /></span>
                      Papers
                      </h2>
                      <a href="#" className="text-sm font-bold text-[#0f766e] transition-colors hover:text-[#115e59]">View all</a>
                  </div>
                  <div className="app-scrollbar-light min-h-0 flex-1 overscroll-contain lg:overflow-y-auto lg:pr-2">
                    <Projects />
                  </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
