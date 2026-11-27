
import type { LucideIcon } from "lucide-react";
import type { Paper as PaperData } from '@/app/editor/page';


export interface Paper {
    id: string;
    title: string;
    subject: string;
    grade: string;
    lastUpdated: string;
}

export interface Stat {
    name: string;
    value: string;
    Icon: LucideIcon;
    color: string;
    bgColor: string;
}

export interface Project {
  id: string;
  name: string;
  class: string;
  subject: string;
  lastUpdated: string;
  /** Whether the paper has been marked as finished. */
  completed?: boolean;
  /** Number of saved questions, including sub-questions. */
  questionCount?: number;
  /** Sum of saved question marks (falls back to the paper total). */
  totalMarks?: number;
  /** Whether the project has a saved paper document. */
  hasPaper?: boolean;
  groupId?: string | null;
  groupName?: string | null;
  paper?: PaperData;
}

    