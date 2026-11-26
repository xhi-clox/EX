'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Clock, FileText, FileQuestion } from 'lucide-react';
import { useProjects } from '@/hooks/use-projects';
import { subjectTone } from '@/lib/project-utils';

export function RecentActivity() {
  const { projects, isLoaded } = useProjects();

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex animate-pulse gap-3 py-3.5">
            <div className="size-9 shrink-0 rounded-lg bg-[#eef4f2]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-[#eef4f2]" />
              <div className="h-2.5 w-24 rounded bg-[#eef4f2]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] px-4 py-8 text-center">
        <p className="text-sm font-semibold text-[#4c686b]">No activity yet</p>
        <p className="mt-1 text-xs text-[#829697]">
          Create a paper and your recent edits will appear here.
        </p>
        <Link
          href="/projects"
          className="mt-3 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
        >
          Go to projects →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {projects.slice(0, 10).map((project) => {
        const tone = subjectTone(project.subject);
        return (
          <Link
            key={project.id}
            href={`/editor?project=${project.id}`}
            className="flex gap-3 border-b border-[#dfeae7] py-3.5 transition-colors last:border-b-0 hover:bg-[#f5faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5aa99d]"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#fbe8e4] text-[#c65d4d]">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-xs font-semibold leading-relaxed text-[#294b50]">
                You updated <span className="font-bold">{project.name}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                  {project.subject}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#5d7778]">
                  <FileQuestion className="size-3" />
                  {project.questionCount ?? 0} question
                  {(project.questionCount ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#5d7778]">
                <Clock className="size-3" />
                {formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true })}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
