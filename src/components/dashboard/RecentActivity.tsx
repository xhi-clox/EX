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
    <div className="flex flex-col gap-1">
      {activities.map((activity, index) => (
          <div key={index} className="flex gap-3 border-b border-[#dfeae7] py-3.5 transition-colors last:border-b-0 hover:bg-[#f5faf8]">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#fbe8e4] text-[#c65d4d]">
                  <activity.Icon className="size-5"/>
              </div>
              <div className='flex-1'>
                  <p className="mb-1 text-xs font-semibold leading-relaxed text-[#294b50]">{activity.description}</p>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#5d7778]">
                      <Clock className="size-3" /> {activity.time}
                  </p>
              </div>
          </div>
      ))}
    </div>
  );
}
