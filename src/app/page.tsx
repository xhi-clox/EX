import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentPapers } from '@/components/dashboard/RecentPapers';
import { Statistics } from '@/components/dashboard/Statistics';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Projects } from '@/components/dashboard/Projects';
import { FileText, Clock, BarChart2, History, Folder, Bolt } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 md:ml-[260px] p-6">
        <AppHeader />
        <div className="grid grid-cols-12 gap-6 mt-7">
          <div className="col-span-12 lg:col-span-4">
            <section className="bg-surface backdrop-blur-2xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-border h-full">
              <h2 className="text-xl font-bold mb-5 flex items-center gap-3">
                <Bolt className="text-primary" /> Quick Actions
              </h2>
              <QuickActions />
            </section>
          </div>
          <div className="col-span-12 lg:col-span-8">
              <section className="bg-surface backdrop_blur-2xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-border h-full">
                  <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                          <Folder className="text-primary" /> Projects
                      </h2>
                      <a href="#" className="text-primary text-sm font-semibold hover:text-primary-light transition-colors">View All</a>
                  </div>
                  <Projects />
            </section>
          </div>
          <div className="col-span-12 lg:col-span-8">
              <section className="bg-surface backdrop-blur-2xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-border h-full">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <FileText className="text-primary" /> Recent Papers
                    </h2>
                    <a href="#" className="text-primary text-sm font-semibold hover:text-primary-light transition-colors">View All</a>
                </div>
                <RecentPapers />
            </section>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <section className="bg-surface backdrop-blur-2xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-border h-full">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-3">
                    <BarChart2 className="text-primary" /> Statistics
                </h2>
                <Statistics />
            </section>
          </div>
          <div className="col-span-12">
              <section className="bg-surface backdrop-blur-2xl rounded-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-border h-full">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <History className="text-primary" /> Recent Activity
                    </h2>
                    <a href="#" className="text-primary text-sm font-semibold hover:text-primary-light transition-colors">View All</a>
                </div>
                <RecentActivity />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
