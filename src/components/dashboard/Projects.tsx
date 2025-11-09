'use client';

import { useProjects } from '@/hooks/use-projects';
import { useRouter } from 'next/navigation';
import { MoreVertical, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function Projects() {
  const { projects } = useProjects();
  const router = useRouter();

  const handleProjectClick = (projectId: string) => {
    router.push(`/editor?project=${projectId}`);
  };

  if (projects.length === 0) {
    return (
      <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
        <p className="text-muted-foreground">You don't have any projects yet.</p>
        <p className="text-sm text-muted-foreground">
          Use the "Quick Actions" to create a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-card rounded-lg p-5 cursor-pointer transition-all duration-300 border border-border border-l-4 border-l-primary hover:border-l-accent hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
          onClick={() => handleProjectClick(project.id)}
        >
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-base text-foreground truncate">{project.name}</h3>
            <button className="text-text-tertiary hover:text-text-primary transition-colors">
                <MoreVertical className="size-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-[rgba(139,92,246,0.15)] text-primary-light py-1.5 px-3 rounded-full text-xs font-semibold border border-[rgba(139,92,246,0.3)]">{project.subject}</span>
            <span className="bg-[rgba(139,92,246,0.15)] text-primary-light py-1.5 px-3 rounded-full text-xs font-semibold border border-[rgba(139,92,246,0.3)]">Class {project.class}</span>
          </div>

          <div className="border-t border-border pt-3 flex justify-between items-center">
             <div className="flex items-center text-text-tertiary text-sm">
                <Clock className="size-4 mr-1.5 text-primary" />
                <span>Updated {formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true })}</span>
             </div>
             <div className='flex items-center gap-2 text-xs text-text-tertiary'>
                <div className='w-16 h-1 bg-surface rounded-full overflow-hidden'>
                    <div className='h-full bg-gradient-to-r from-primary to-accent' style={{width: '75%'}}></div>
                </div>
                75%
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}
