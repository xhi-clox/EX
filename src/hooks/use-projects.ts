
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types';

const PROJECTS_STORAGE_KEY = 'examMakerProjects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (storedProjects) {
        setProjects(JSON.parse(storedProjects));
      }
    } catch (error) {
      console.error('Failed to load projects from localStorage', error);
    }
    setIsLoaded(true);
  }, []);

  const saveProjects = useCallback((updatedProjects: Project[]) => {
    try {
      // Sort by lastUpdated date descending before saving
      const sortedProjects = updatedProjects.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      setProjects(sortedProjects);
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(sortedProjects));
    } catch (error) {
      console.error('Failed to save projects to localStorage', error);
    }
  }, []);

  const addProject = (projectData: Omit<Project, 'id' | 'lastUpdated'>): Project => {
    const newProject: Project = {
      ...projectData,
      id: `proj_${Date.now()}`,
      lastUpdated: new Date().toISOString(),
    };
    const updatedProjects = [newProject, ...projects];
    saveProjects(updatedProjects);
    return newProject;
  };
  
  const getProject = useCallback((id: string): Project | undefined => {
    return projects.find(p => p.id === id);
  }, [projects]);


  const updateProject = (id: string, updates: Partial<Omit<Project, 'id'>>) => {
    const updatedProjects = projects.map(p =>
      p.id === id ? { ...p, ...updates, lastUpdated: new Date().toISOString() } : p
    );
    saveProjects(updatedProjects);
  };

  const deleteProject = (id: string) => {
    const updatedProjects = projects.filter(p => p.id !== id);
    saveProjects(updatedProjects);
    // Also remove the associated paper data from localStorage
    try {
        localStorage.removeItem(`paper_${id}`);
    } catch (error) {
        console.error(`Failed to remove paper data for project ${id}`, error);
    }
  };

  return {
    projects,
    isLoaded,
    addProject,
    getProject,
    updateProject,
    deleteProject,
  };
}
