'use client';

import type { Project } from '@/types';

const PROJECTS_STORAGE_KEY = 'examMakerProjects';
const MIGRATION_FLAG = 'neonLocalMigrationDone_v1';

let migrationPromise: Promise<void> | null = null;

async function runMigration(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(MIGRATION_FLAG) === '1') return;

  const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
  let localProjects: Project[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localProjects = parsed;
    } catch (error) {
      console.error('Could not parse local projects for migration', error);
    }
  }

  if (localProjects.length === 0) {
    window.localStorage.setItem(MIGRATION_FLAG, '1');
    return;
  }

  const listResponse = await fetch('/api/projects', { cache: 'no-store' });
  if (!listResponse.ok) throw new Error('Could not load projects for migration');

  const serverProjects: Project[] = await listResponse.json();
  const serverIds = new Set(serverProjects.map((project) => project.id));

  const remaining: Project[] = [];
  let failed = false;

  for (const localProject of localProjects) {
    try {
      if (!localProject?.id || !localProject?.name) continue;

      if (!serverIds.has(localProject.id)) {
        const createResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: localProject.id,
            name: localProject.name,
            subject: localProject.subject,
            class: localProject.class,
          }),
        });
        if (!createResponse.ok && createResponse.status !== 409) {
          throw new Error(`Could not create project (${createResponse.status})`);
        }
        serverIds.add(localProject.id);
      }

      const paperKey = `paper_${localProject.id}`;
      const paperRaw = window.localStorage.getItem(paperKey);
      if (paperRaw) {
        const infoResponse = await fetch(
          `/api/projects/${encodeURIComponent(localProject.id)}`,
          { cache: 'no-store' }
        );
        if (!infoResponse.ok) throw new Error('Could not read project');

        const info = await infoResponse.json();
        if (!info?.paper) {
          const saveResponse = await fetch(
            `/api/projects/${encodeURIComponent(localProject.id)}/paper`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: paperRaw,
            }
          );
          if (!saveResponse.ok) throw new Error('Could not upload paper');
        }
        window.localStorage.removeItem(paperKey);
      }
    } catch (error) {
      console.error('Failed to migrate local project', localProject?.id, error);
      failed = true;
      remaining.push(localProject);
    }
  }

  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(remaining));
  if (!failed) window.localStorage.setItem(MIGRATION_FLAG, '1');
}

export function migrateLocalDataIfNeeded(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((error) => {
      console.error('Local data migration failed', error);
      migrationPromise = null;
    });
  }
  return migrationPromise;
}
