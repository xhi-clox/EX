'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';

const recentPapers = [
  {
    id: 'paper-1',
    title: 'Advanced Calculus Midterm',
    status: 'Completed',
    lastUpdated: '2 days ago',
  },
  {
    id: 'paper-2',
    title: 'Organic Chemistry Final',
    status: 'Draft',
    lastUpdated: '5 hours ago',
  },
  {
    id: 'paper-3',
    title: 'English Literature Quiz',
    status: 'Completed',
    lastUpdated: '1 week ago',
  },
];

export function RecentPapers() {
  return (
    <div>
        <div className="mb-5">
            <select className="bg-card border border-border rounded-md py-2 px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]">
                <option>Sort by: Last Updated</option>
                <option>Sort by: Name</option>
                <option>Sort by: Status</option>
            </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border">
              <TableHead className="text-text-tertiary font-semibold uppercase tracking-wider">Paper Name</TableHead>
              <TableHead className="text-text-tertiary font-semibold uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-text-tertiary font-semibold uppercase tracking-wider">Last Updated</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentPapers.map((paper) => (
              <TableRow key={paper.id} className="border-border hover:bg-[rgba(139,92,246,0.08)] cursor-pointer">
                <TableCell className="font-semibold text-foreground">{paper.title}</TableCell>
                <TableCell>
                  {paper.status === 'Completed' ? (
                    <Badge variant="outline" className="bg-[rgba(16,185,129,0.15)] text-success border-[rgba(16,185,129,0.3)] gap-1.5 capitalize font-bold text-xs py-1 px-3 rounded-full before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-success">
                        Completed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-[rgba(245,158,11,0.15)] text-warning border-[rgba(245,158,11,0.3)] gap-1.5 capitalize font-bold text-xs py-1 px-3 rounded-full before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-warning">
                        Draft
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-text-secondary">{paper.lastUpdated}</TableCell>
                <TableCell className="text-right">
                  <button className="text-text-tertiary hover:text-text-primary transition-colors">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
