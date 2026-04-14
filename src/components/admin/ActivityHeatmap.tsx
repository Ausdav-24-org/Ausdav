import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditAction } from '@/types/admin';

interface ActivityHeatmapProps {
  auditLogs: AuditAction[];
}

export function ActivityHeatmap({ auditLogs }: ActivityHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Create a 24-hour by 7-day heatmap
    const data: Record<number, Record<number, number>> = {};

    // Initialize grid (weekday x hour)
    for (let day = 0; day < 7; day++) {
      data[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        data[day][hour] = 0;
      }
    }

    // Count activities by hour and day
    auditLogs.forEach((log) => {
      const date = new Date(log.created_at);
      const hour = date.getHours();
      const day = date.getDay();
      data[day][hour]++;
    });

    return data;
  }, [auditLogs]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get max value for color scaling
  const maxValue = Math.max(...Object.values(heatmapData).map((day) => Math.max(...Object.values(day))));

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-muted';
    const intensity = count / maxValue;
    if (intensity < 0.25) return 'bg-blue-900/30';
    if (intensity < 0.5) return 'bg-blue-700/50';
    if (intensity < 0.75) return 'bg-blue-500/70';
    return 'bg-blue-400/90';
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="text-lg">Activity Heatmap (by Hour & Day)</CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Shows when most activities occur. Darker = more activity
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour labels */}
            <div className="flex gap-1 mb-2 ml-16">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="w-8 text-xs text-muted-foreground text-center font-medium"
                >
                  {hour}
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {dayNames.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-14 text-xs font-medium text-muted-foreground">{day}</div>
                {hours.map((hour) => (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`w-8 h-8 rounded text-xs flex items-center justify-center transition-all hover:ring-2 hover:ring-primary cursor-help ${getColor(heatmapData[dayIndex][hour])}`}
                    title={`${day} ${hour}:00 - ${heatmapData[dayIndex][hour]} activities`}
                  >
                    {heatmapData[dayIndex][hour] > 0 && (
                      <span className="text-white font-bold text-[10px]">
                        {heatmapData[dayIndex][hour]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Legend</p>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted"></div>
              <span>No activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-900/30"></div>
              <span>Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500/70"></div>
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-400/90"></div>
              <span>Peak</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
