'use client';

import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/use-projects';
import type { Project } from '@/types';
import { FileText, ImageUp, Sparkles } from 'lucide-react';

const actions = [
  {
    title: 'New blank paper',
    description: 'Start from an empty paper and add your own questions.',
    href: '/editor',
    Icon: FileText,
    tone: 'bg-[#e3f2ee] text-[#0f766e] group-hover:bg-[#d1ebe5]',
    type: 'project' as const,
  },
  {
    title: 'Generate from topic',
    description: 'Describe a topic and let AI draft the question paper.',
    href: '/ai/suggest',
    Icon: Sparkles,
    tone: 'bg-[#f0e9fb] text-[#6d4fa3] group-hover:bg-[#e6dcf7]',
    type: 'project' as const,
  },
  {
    title: 'Import from image',
    description: 'Scan a printed or handwritten question paper with OCR.',
    href: '/editor/image',
    Icon: ImageUp,
    tone: 'bg-[#fbe8e4] text-[#c65d4d] group-hover:bg-[#f6ddd8]',
    type: 'project' as const,
  },
];

export function QuickActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const router = useRouter();
  const { addProject } = useProjects();

  const handleActionClick = (href: string) => {
    setNextStep(href);
    setIsModalOpen(true);
  };

  const handleCreateProject = async (project: Omit<Project, 'id' | 'lastUpdated'>) => {
    const newProject = await addProject(project);
    setIsModalOpen(false);
    if (nextStep) {
      router.push(`${nextStep}?project=${newProject.id}`);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => handleActionClick(action.href)}
            className="group relative flex items-start gap-3.5 overflow-hidden rounded-xl border border-[#dce9e5] bg-[#f7fbf9] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9bcfc4] hover:bg-white hover:shadow-[0_8px_20px_rgba(23,52,58,0.07)]"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${action.tone}`}
            >
              <action.Icon className="size-[18px]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-bold text-[#17343a]">{action.title}</h3>
              <p className="text-xs leading-relaxed text-[#4f6d6f]">{action.description}</p>
            </div>
          </button>
        ))}
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </>
  );
}
