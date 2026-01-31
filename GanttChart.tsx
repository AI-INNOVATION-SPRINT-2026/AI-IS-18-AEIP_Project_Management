import React, { useMemo } from 'react';
import { Task, User } from './types';

interface GanttChartProps {
    tasks: Task[];
    users: User[];
    onTaskUpdate?: (task: Task) => void;
}

const CELL_WIDTH = 40; // Pixels per hour
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 50;

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, users }) => {
    // 1. Calculate Time Range
    // 1. Calculate Time Range & Auto-Schedule
    const { visualTasks, minTime, maxTime, totalHours } = useMemo(() => {
        if (tasks.length === 0) return { visualTasks: [], minTime: Date.now(), maxTime: Date.now() + 86400000, totalHours: 24 };

        const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));
        const visualStartDates = new Map<string, number>();

        // Recursive function to calculate start time based on dependencies
        const getVisualStart = (taskId: string, visited: Set<string> = new Set()): number => {
            if (visited.has(taskId)) return Date.now(); // Cycle detection fallback
            if (visualStartDates.has(taskId)) return visualStartDates.get(taskId)!;

            visited.add(taskId);
            const task = taskMap.get(taskId);
            if (!task) return Date.now();

            // Default to task's own start or creation time (ensure number)
            let startTime = typeof task.startDate === 'number' ? task.startDate : (task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now());

            // If dependencies exist, start AFTER the max end time of dependencies
            if (task.dependencies && task.dependencies.length > 0) {
                let maxDependencyEnd = 0;
                task.dependencies.forEach(depId => {
                    const depTask = taskMap.get(depId);
                    if (depTask) {
                        const depStart = getVisualStart(depId, new Set(visited));
                        const depDuration = (depTask.estimatedDuration || 60) * 60000;
                        maxDependencyEnd = Math.max(maxDependencyEnd, depStart + depDuration);
                    }
                });

                if (maxDependencyEnd > 0) {
                    // Add a small buffer (e.g., 30 mins) between tasks for visual clarity
                    startTime = Math.max(startTime, maxDependencyEnd + 30 * 60000);
                }
            }

            visualStartDates.set(taskId, startTime);
            return startTime;
        };

        // Calculate all start times
        const processedTasks = tasks.map(t => {
            const vStart = getVisualStart(t.id);
            return { ...t, startDate: vStart };
        });

        const min = Math.min(...processedTasks.map(t => t.startDate));
        const max = Math.max(...processedTasks.map(t =>
            Math.max(t.deadline, t.startDate + (t.estimatedDuration || 60) * 60000)
        ));

        console.log('📊 Gantt Calc:', {
            tasksCount: tasks.length,
            minTime: new Date(min).toISOString(),
            maxTime: new Date(max).toISOString(),
            rawMin: min,
            rawMax: max
        });

        // Add buffer
        const start = min - 3600000 * 2; // -2 hours
        const end = max + 3600000 * 4; // +4 hours
        const hours = Math.ceil((end - start) / 3600000);

        return { visualTasks: processedTasks, minTime: start, maxTime: end, totalHours: hours };
    }, [tasks]);

    // 2. Generate Time Helpers
    const timeToX = (time: number) => {
        return ((time - minTime) / 3600000) * CELL_WIDTH;
    };

    const hoursArray = Array.from({ length: totalHours }, (_, i) => {
        const time = minTime + i * 3600000;
        return new Date(time);
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <span>📊</span> Adaptive Gantt Chart
                </h3>
                <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> Planned</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> Actual</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Critical Path</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative">
                <div style={{ minWidth: `${totalHours * CELL_WIDTH + 200}px` }}>
                    {/* Header */}
                    <div className="flex sticky top-0 bg-slate-100 z-20 border-b border-slate-200" style={{ height: HEADER_HEIGHT }}>
                        <div className="w-48 shrink-0 border-r border-slate-200 p-2 font-bold text-xs text-slate-500 flex items-center bg-slate-100 sticky left-0 z-30">
                            Task Name
                        </div>
                        {hoursArray.map((date, i) => (
                            <div key={i} className="border-r border-slate-200 text-[10px] text-slate-400 p-1 flex items-center justify-center font-mono" style={{ width: CELL_WIDTH }}>
                                {date.getHours()}:00
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="relative">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                            <div className="w-48 shrink-0 border-r border-slate-100 bg-transparent"></div>
                            {hoursArray.map((_, i) => (
                                <div key={i} className="border-r border-slate-100 h-full" style={{ width: CELL_WIDTH }}></div>
                            ))}
                        </div>

                        {visualTasks.map(task => {
                            const start = task.startDate || Date.now();
                            const duration = task.estimatedDuration || 60; // minutes
                            const width = (duration / 60) * CELL_WIDTH;
                            const left = timeToX(start) + 192; // 192 is w-48
                            const assignee = users.find(u => u.id === task.assigneeId);

                            // Check if critical (simplified logic for UI)
                            const isCritical = task.priority === 'HIGH' && task.deadline - (start + duration * 60000) < 3600000 * 4;

                            return (
                                <div key={task.id} className="flex border-b border-slate-100 hover:bg-slate-50 relative group" style={{ height: ROW_HEIGHT }}>
                                    {/* Label */}
                                    <div className="w-48 shrink-0 border-r border-slate-200 p-3 flex flex-col justify-center sticky left-0 bg-white z-10 group-hover:bg-slate-50">
                                        <p className="text-xs font-bold text-slate-700 truncate">{task.title}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{assignee?.name || 'Unassigned'}</p>
                                    </div>

                                    {/* Bar */}
                                    <div className="absolute top-3 h-6 rounded-md shadow-sm border border-white/20 cursor-pointer transition-all hover:scale-y-110 z-0 text-[9px] flex items-center px-1 font-bold text-white overflow-hidden whitespace-nowrap"
                                        style={{
                                            left: `${left}px`,
                                            width: `${Math.max(width, 2)}px`,
                                            backgroundColor: isCritical ? '#ef4444' : '#3b82f6'
                                        }}
                                        title={`${task.title} (${duration}m)`}
                                    >
                                        {width > 30 && task.title}
                                    </div>

                                    {/* Deadline Indicator */}
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/30 border-l border-red-500/50 border-dashed"
                                        style={{ left: `${timeToX(task.deadline) + 192}px` }}
                                        title="Deadline"
                                    ></div>
                                </div>
                            );
                        })}
                    </div>

                    {/* SVG Overlay for Dependencies (Simplified for MVP: just drawing lines if logical) */}
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                        {visualTasks.map((task, rowIndex) => (
                            task.dependencies?.map(depId => {
                                const depTask = visualTasks.find(t => t.id === depId);
                                const depIndex = visualTasks.findIndex(t => t.id === depId);
                                if (!depTask || depIndex === -1) return null;

                                // Simple S-curve connection
                                const startX = timeToX((depTask.startDate || 0) + (depTask.estimatedDuration || 0) * 60000) + 192;
                                const startY = depIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                                const endX = timeToX(task.startDate || 0) + 192;
                                const endY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                                return (
                                    <path
                                        key={`${depId}-${task.id}`}
                                        d={`M ${startX} ${startY} C ${startX + 20} ${startY}, ${endX - 20} ${endY}, ${endX} ${endY}`}
                                        fill="none"
                                        stroke="#cbd5e1"
                                        strokeWidth="2"
                                        markerEnd="url(#arrowhead)"
                                    />
                                );
                            })
                        ))}
                        <defs>
                            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
                            </marker>
                        </defs>
                    </svg>
                </div>
            </div>
        </div>
    );
};