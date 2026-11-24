'use client';

import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/use-projects';
import type { Project } from '@/types';
import { FileText, Sparkles } from 'lucide-react';

const actions = [
    {
      title: "New Blank Paper",
      description: "Start creating an exam paper from scratch.",
      href: "/editor",
      Icon: FileText,
      type: 'project'
    },
    {
      title: "Generate from Topic",
      description: "AI-powered paper generation from a topic.",
      href: "/ai/suggest",
      Icon: Sparkles,
      type: 'project'
    },
];

export function QuickActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const router = useRouter();
  const { addProject } = useProjects();

  const handleActionClick = (type: string, href: string) => {
    if (type === 'project') {
      setNextStep(href);
      setIsModalOpen(true);
    } else {
      router.push(href);
    }
  };

  const handleCreateProject = async (project: Omit<Project, 'id' | 'lastUpdated'>) => {
    try {
      const newProject = await addProject(project);
      setIsModalOpen(false);
      if (nextStep) {
        router.push(`${nextStep}?project=${newProject.id}`);
      }
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => handleActionClick(action.type, action.href)}
            className="group relative flex items-start gap-3.5 overflow-hidden rounded-xl border border-[#dce9e5] bg-[#f7fbf9] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9bcfc4] hover:bg-white hover:shadow-[0_8px_20px_rgba(23,52,58,0.07)]"
          >
             <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e3f2ee] text-[#0f766e] transition-colors group-hover:bg-[#d1ebe5]">
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
