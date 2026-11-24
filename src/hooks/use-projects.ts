'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/types';
import { migrateLocalDataIfNeeded } from '@/lib/local-migration';

async function requestProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load projects (${response.status})`);
  return response.json();
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const projectsRef = useRef<Project[]>([]);

  const applyProjects = useCallback((nextProjects: Project[]) => {
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyProjects(sortProjects(await requestProjects()));
    } catch (error) {
      console.error('Failed to load projects from Neon', error);
    } finally {
      setIsLoaded(true);
    }
  }, [applyProjects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateLocalDataIfNeeded();
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const addProject = useCallback(
    async (projectData: Omit<Project, 'id' | 'lastUpdated'>): Promise<Project> => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Could not create project (${response.status})`);
      }
      const newProject: Project = await response.json();
      applyProjects(sortProjects([newProject, ...projectsRef.current]));
      return newProject;
    },
    [applyProjects]
  );

  const getProject = useCallback((id: string): Project | undefined => {
    return projectsRef.current.find(project => project.id === id);
  }, []);

  const updateProject = useCallback(
    async (id: string, updates: Partial<Omit<Project, 'id'>>): Promise<void> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Could not update project (${response.status})`);
      }
      const updatedProject: Project = await response.json();
      applyProjects(
        sortProjects(
          projectsRef.current.map(project => (project.id === id ? updatedProject : project))
        )
      );
    },
    [applyProjects]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 404) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Could not delete project (${response.status})`);
      }
      applyProjects(projectsRef.current.filter(project => project.id !== id));
    },
    [applyProjects]
  );

  return {
    projects,
    isLoaded,
    addProject,
    getProject,
    updateProject,
    deleteProject,
    refresh,
  };
}
