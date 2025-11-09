'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CreateProjectModal } from './CreateProjectModal';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/use-projects';
import type { Project } from '@/types';
import { Book, FileText, Sparkles } from 'lucide-react';

const actions = [
    {
      title: "Question Bank",
      description: "Access and manage your question bank.",
      href: "/question-bank",
      Icon: Book,
      type: 'link'
    },
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
  const { addProject, isLoaded } = useProjects();

  const handleActionClick = (type: string, href: string) => {
    if (type === 'project') {
      setNextStep(href);
      setIsModalOpen(true);
    } else {
      router.push(href);
    }
  };

  const handleCreateProject = (project: Omit<Project, 'id' | 'lastUpdated'>) => {
    const newProject = addProject(project);
    setIsModalOpen(false);
    if (nextStep) {
        router.push(`${nextStep}?project=${newProject.id}`);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => handleActionClick(action.type, action.href)}
            className="group text-left p-6 rounded-lg bg-gradient-to-br from-card to-card-hover border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] hover:border-primary relative overflow-hidden flex items-start gap-4"
          >
             <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
             <div className="p-3 rounded-lg bg-[rgba(139,92,246,0.1)] transition-transform duration-300 group-hover:scale-110">
                <action.Icon className="w-7 h-7 bg-clip-text text-transparent bg-gradient-to-br from-primary to-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base text-foreground mb-1.5">{action.title}</h3>
              <p className="text-sm text-secondary leading-normal">{action.description}</p>
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
