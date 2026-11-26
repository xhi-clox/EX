'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project } from '@/types';
import { migrateLocalDataIfNeeded } from '@/lib/local-migration';

const PROJECTS_CHANGED_EVENT = 'exampro:projects-changed';
export type ProjectGroup = { id: string; name: string; parentId: string | null };

export function getProjectGroupPath(groupId: string, groups: ProjectGroup[]): string {
  const path: string[] = [];
  let group = groups.find((candidate) => candidate.id === groupId);
  while (group) {
    path.unshift(group.name);
    group = group.parentId
      ? groups.find((candidate) => candidate.id === group?.parentId)
      : undefined;
  }
  return path.join(' / ');
}

function notifyProjectsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
}

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
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const projectsRef = useRef<Project[]>([]);

  const applyProjects = useCallback((nextProjects: Project[]) => {
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextProjects, groupsResponse] = await Promise.all([
        requestProjects(),
        fetch('/api/groups', { cache: 'no-store' }),
      ]);
      applyProjects(sortProjects(nextProjects));
      if (groupsResponse.ok) setGroups(await groupsResponse.json());
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

  // Every component that calls useProjects owns a small cache. Keep those
  // caches in sync after a create/rename/delete/duplicate anywhere in the app.
  useEffect(() => {
    const handleChange = () => {
      void refresh();
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, handleChange);
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
      notifyProjectsChanged();
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
      notifyProjectsChanged();
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
      notifyProjectsChanged();
    },
    [applyProjects]
  );

  const duplicateProject = useCallback(
    async (id: string): Promise<Project> => {
      const detailResponse = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      if (!detailResponse.ok) {
        throw new Error(`Could not read project (${detailResponse.status})`);
      }

      const detail = (await detailResponse.json()) as {
        project: Project;
        paper: Record<string, unknown> | null;
      };

      const copyName = `${detail.project.name} (copy)`.slice(0, 120);
      const newProject = await addProject({
        name: copyName,
        subject: detail.project.subject,
        class: detail.project.class,
        groupId: detail.project.groupId ?? null,
      });

      if (detail.paper) {
        const paperCopy = {
          ...detail.paper,
          id: newProject.id,
          examTitle:
            typeof detail.paper.examTitle === 'string' && detail.paper.examTitle.trim()
              ? `${detail.paper.examTitle} (copy)`
              : copyName,
        };

        const saveResponse = await fetch(
          `/api/projects/${encodeURIComponent(newProject.id)}/paper`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paperCopy),
          }
        );

        if (!saveResponse.ok) {
          // Do not leave a half-created copy behind.
          await fetch(`/api/projects/${encodeURIComponent(newProject.id)}`, {
            method: 'DELETE',
          }).catch(() => undefined);
          applyProjects(
            projectsRef.current.filter((project) => project.id !== newProject.id)
          );
          throw new Error('Could not copy the paper.');
        }

        await refresh();
        notifyProjectsChanged();
      }

      return newProject;
    },
    [addProject, applyProjects, refresh]
  );

  const deleteAllProjects = useCallback(async (): Promise<number> => {
    const response = await fetch('/api/projects', { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Could not delete papers (${response.status})`);
    }
    const payload = (await response.json()) as { deleted?: number };
    applyProjects([]);
    notifyProjectsChanged();
    return payload.deleted ?? 0;
  }, [applyProjects]);

  const createGroup = useCallback(async (name: string, parentId: string | null = null): Promise<ProjectGroup> => {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Could not create group.');
    const group = payload as ProjectGroup;
    setGroups((current) => [...current, group].sort((a, b) => a.name.localeCompare(b.name)));
    return group;
  }, []);

  const renameGroup = useCallback(async (id: string, name: string, parentId?: string | null): Promise<void> => {
    const response = await fetch(`/api/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...(parentId !== undefined ? { parentId } : {}) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Could not rename group.');
    setGroups((current) =>
      current.map((group) => (group.id === id ? (payload as ProjectGroup) : group))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    await refresh();
  }, [refresh]);

  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Could not delete group.');
    setGroups((current) => current.filter((group) => group.id !== id));
    await refresh();
  }, [refresh]);

  return {
    projects,
    groups,
    isLoaded,
    addProject,
    getProject,
    updateProject,
    deleteProject,
    duplicateProject,
    deleteAllProjects,
    createGroup,
    renameGroup,
    deleteGroup,
    refresh,
  };
}
