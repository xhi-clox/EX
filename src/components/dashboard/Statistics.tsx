import { FileText, Bot, HelpCircle, ArrowUp } from 'lucide-react';

const stats = [
  {
    name: 'Total Papers',
    value: '42',
    Icon: FileText,
    trend: "+12%"
  },
  {
    name: 'AI Generated',
    value: '18',
    Icon: Bot,
    trend: "+8%"
  },
  {
    name: 'Total Questions',
    value: '327',
    Icon: HelpCircle,
    trend: "+24%"
  },
];

export function Statistics() {
  return (
    <div className="flex flex-col gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="group bg-gradient-to-br from-card to-card-hover rounded-lg p-5 flex items-center gap-4 border border-border relative overflow-hidden transition-all duration-300 hover:translate-x-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] hover:border-primary">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
              <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-gradient-to-br from-[rgba(139,92,246,0.2)] to-[rgba(236,72,153,0.2)] text-primary-light border border-[rgba(139,92,246,0.3)] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                  <stat.Icon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                  <div className="text-2xl font-extrabold mb-1 bg-gradient-to-r from-text-primary to-primary-light bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-sm font-medium text-text-secondary">{stat.name}</div>
                  <div className="text-xs font-semibold text-success flex items-center gap-1 mt-1">
                      <ArrowUp className="size-3" />
                      <span>{stat.trend} this month</span>
                  </div>
              </div>
          </div>
        ))}
    </div>
  );
}
