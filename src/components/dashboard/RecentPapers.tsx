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
        <div className="mb-4">
          <select className="cursor-pointer rounded-lg border border-[#dfe9e7] bg-[#f7faf9] px-3 py-2 text-xs font-semibold text-[#587174] outline-none transition-colors focus:border-[#75bdb0] focus:ring-4 focus:ring-[#e1f2ee]">
                <option>Sort by: Last Updated</option>
                <option>Sort by: Name</option>
                <option>Sort by: Status</option>
            </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#e4ecea] hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8aa0a0]">Paper Name</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8aa0a0]">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8aa0a0]">Last Updated</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentPapers.map((paper) => (
              <TableRow key={paper.id} className="cursor-pointer border-[#edf2f0] transition-colors hover:bg-[#f7faf9]">
                <TableCell className="font-semibold text-[#29484d]">{paper.title}</TableCell>
                <TableCell>
                  {paper.status === 'Completed' ? (
                    <Badge variant="outline" className="gap-1.5 rounded-md border-[#bde2d6] bg-[#eaf7f2] px-2 py-1 text-[10px] font-bold capitalize text-[#327d68] before:size-1.5 before:rounded-full before:bg-[#4ca783] before:content-['']">
                        Completed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 rounded-md border-[#f1d7aa] bg-[#fff6e7] px-2 py-1 text-[10px] font-bold capitalize text-[#a66b1d] before:size-1.5 before:rounded-full before:bg-[#d9912e] before:content-['']">
                        Draft
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#829697]">{paper.lastUpdated}</TableCell>
                <TableCell className="text-right">
                  <button aria-label={`More options for ${paper.title}`} className="text-[#8aa0a0] transition-colors hover:text-[#0f766e]">
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
