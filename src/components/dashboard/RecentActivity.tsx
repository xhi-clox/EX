'use client';

import { Upload, UserPlus, Edit, Clock } from 'lucide-react';

const activities = [
    {
        description: 'You published "Advanced Calculus Midterm"',
        time: '2 hours ago',
        Icon: Upload
    },
    {
        description: 'New user registered for your "Organic Chemistry" course',
        time: 'Yesterday',
        Icon: UserPlus
    },
    {
        description: 'You started a new draft for "Physics I Final"',
        time: '3 days ago',
        Icon: Edit
    }
];


export function RecentActivity() {
  return (
    <div className="flex flex-col gap-4">
      {activities.map((activity, index) => (
          <div key={index} className="flex gap-3.5 pb-4 border-b border-border last:border-b-0 last:pb-0 transition-all hover:pl-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[rgba(139,92,246,0.2)] to-[rgba(236,72,153,0.2)] text-primary-light border border-[rgba(139,92,246,0.3)] flex-shrink-0 transition-transform group-hover:scale-110">
                  <activity.Icon className="size-5"/>
              </div>
              <div className='flex-1'>
                  <p className="text-sm font-medium mb-1.5 text-text-primary">{activity.description}</p>
                  <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                      <Clock className="size-3" /> {activity.time}
                  </p>
              </div>
          </div>
      ))}
    </div>
  );
}
