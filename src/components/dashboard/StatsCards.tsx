
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, BrainCircuit, Users } from 'lucide-react';

const stats = [
  {
    name: 'Total Papers',
    value: '42',
    Icon: FileText,
  },
  {
    name: 'AI Generated',
    value: '15',
    Icon: BrainCircuit,
  },
  {
    name: 'Total Questions',
    value: '530',
    Icon: Users,
  },
];

export function Statistics() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
        {stats.map((stat) => (
          <Card key={stat.name} className="shadow-lg text-center p-5">
              <stat.Icon className="size-7 text-primary mx-auto mb-2" />
              <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.name}</div>
          </Card>
        ))}
    </div>
  );
}
