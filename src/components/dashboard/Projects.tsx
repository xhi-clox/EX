'use client';

import { useProjects } from '@/hooks/use-projects';
import { useRouter } from 'next/navigation';
import { MoreVertical, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function Projects() {
  const { projects, isLoaded } = useProjects();
  const router = useRouter();

  const handleProjectClick = (projectId: string) => {
    router.push(`/editor?project=${projectId}`);
  };

  if (!isLoaded) {
    return (
      <div className="rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] p-8 text-center">
        <p className="text-[#4c686b]">Loading papers...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] p-8 text-center">
        <p className="text-[#4c686b]">You don&apos;t have any projects yet.</p>
        <p className="text-sm text-[#829697]">
          Use the &quot;Quick Actions&quot; to create a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {projects.map((project) => (
        <div
          key={project.id}
          className="cursor-pointer rounded-xl border border-[#dce9e5] border-l-4 border-l-[#75bdb0] bg-[#f7fbf9] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a9d6ce] hover:border-l-[#0f766e] hover:bg-white hover:shadow-[0_8px_20px_rgba(23,52,58,0.07)]"
          onClick={() => handleProjectClick(project.id)}
        >
          <div className="mb-2.5 flex items-start justify-between">
            <h3 className="truncate text-[13px] font-bold text-[#102f35]">{project.name}</h3>
            <button aria-label={`More options for ${project.name}`} className="text-[#8aa0a0] transition-colors hover:text-[#0f766e]">
                <MoreVertical className="size-[18px]" />
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-[#e3f2ee] px-2 py-1 text-[11px] font-bold text-[#397d73]">{project.subject}</span>
            <span className="rounded-md bg-[#edf1f0] px-2 py-1 text-[11px] font-bold text-[#6b8081]">Class {project.class}</span>
          </div>

           <div className="flex items-center justify-between border-t border-[#e4ecea] pt-3">
             <div className="flex items-center text-[11px] font-medium text-[#5d7778]">
               <Clock className="mr-1.5 size-3.5 text-[#4a9b8d]" />
                <span>Updated {formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true })}</span>
             </div>
             <div className='flex items-center gap-2 text-[11px] font-bold text-[#5d7778]'>
              <div className='h-1.5 w-14 overflow-hidden rounded-full bg-[#e1ebe8]'>
                <div className='h-full rounded-full bg-[#75bdb0]' style={{width: '75%'}}></div>
                </div>
                75%
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}
