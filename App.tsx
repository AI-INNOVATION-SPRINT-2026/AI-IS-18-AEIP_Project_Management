
import React, { useState, useEffect, useMemo } from 'react';
import {
  Task, TaskStatus, User, DecisionLog, ActionType, UserRole
} from './types';
import {
  INITIAL_TASKS, USERS, DEPARTMENTS, TEAMS
} from './mockData';
import { runMonitoringCycle } from './agentService';
import { Icons } from './constants';
import { Auth } from './Auth';
import { ProjectManager } from './ProjectManager';
import { initMemories } from './vectorStore';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastRun, setLastRun] = useState<number>(Date.now());

  // Restore session and load tasks from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('AEIP_CURRENT_USER');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Load tasks from localStorage or use initial tasks
    const savedTasks = localStorage.getItem('AEIP_TASKS');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem('AEIP_TASKS', JSON.stringify(INITIAL_TASKS));
    }

    // Initialize RAG Service with mock data
    initMemories();
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('AEIP_TASKS', JSON.stringify(tasks));
    }
  }, [tasks]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('AEIP_CURRENT_USER', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('AEIP_CURRENT_USER');
  };

  // Autonomous loop simulator
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      setIsMonitoring(true);
      await runMonitoringCycle(
        tasks,
        USERS, // Note: In a real app we'd pass the full dynamic user list here
        (log) => setLogs(prev => [log, ...prev]),
        (updatedTasks) => setTasks(updatedTasks)
      );
      setLastRun(Date.now());
      setIsMonitoring(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [tasks, currentUser]);

  // Filter tasks based on role
  const filteredTasks = useMemo(() => {
    if (!currentUser) return [];
    switch (currentUser.role) {
      case UserRole.ADMIN:
        return tasks;
      case UserRole.MANAGER:
      case UserRole.TEAM_LEAD:
        // Show tasks for team or if lead is explicitly assigned
        return tasks.filter(t => t.teamId === currentUser.teamId);
      case UserRole.ASSIGNEE:
        return tasks.filter(t => t.assigneeId === currentUser.id);
      default:
        return [];
    }
  }, [tasks, currentUser]);

  const selectedTask = useMemo(() =>
    tasks.find(t => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );

  const selectedLogs = useMemo(() =>
    logs.filter(l => l.taskId === selectedTaskId),
    [logs, selectedTaskId]
  );

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-green-100 text-green-700';
      case TaskStatus.AT_RISK: return 'bg-yellow-100 text-yellow-700';
      case TaskStatus.OVERDUE: return 'bg-red-100 text-red-700';
      case TaskStatus.ESCALATED: return 'bg-purple-100 text-purple-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case ActionType.REMIND: return '🔔';
      case ActionType.RISK_ALERT: return '⚠️';
      case ActionType.ESCALATE: return '⬆️';
      case ActionType.CRITICAL_ESCALATE: return '🚨';
      default: return '✅';
    }
  };

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const assigneeId = formData.get('assigneeId') as string || currentUser.id;

    // Get the assignee's team and dept info
    const storedUsersStr = localStorage.getItem('AEIP_USERS');
    const allUsers = storedUsersStr ? JSON.parse(storedUsersStr) : USERS;
    const assignee = allUsers.find((u: User) => u.id === assigneeId) || currentUser;

    const newTask: Task = {
      id: `TASK-${Date.now()}`,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      status: TaskStatus.CREATED,
      priority: formData.get('priority') as any,
      deadline: Date.now() + parseInt(formData.get('deadline') as string) * 60 * 1000,
      assigneeId: assigneeId,
      teamId: assignee.teamId,  // Use assignee's teamId, not creator's
      deptId: assignee.deptId,   // Use assignee's deptId, not creator's
      orgId: 'ORG-001',
      riskScore: 0,
      lastAction: ActionType.NONE,
      updatedAt: Date.now()
    };
    setTasks(prev => [newTask, ...prev]);
    e.currentTarget.reset();
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, status: newStatus, updatedAt: Date.now() }
        : task
    ));
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const userDept = DEPARTMENTS.find(d => d.id === currentUser.deptId);
  const canManage = currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_LEAD;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-slate-900 text-white p-6 shrink-0 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">AE</div>
          <div>
            <h1 className="text-lg font-bold leading-none">AEIP</h1>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">Enterprise Intelligence</span>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <div className="flex items-center gap-3 px-3 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg font-medium cursor-pointer">
            <Icons.Dashboard />
            <span>Overview</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition">
            <Icons.Task />
            <span>{currentUser.role === UserRole.ASSIGNEE ? 'My Workflows' : 'Team Execution'}</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition">
            <Icons.Alert />
            <span>Risk Center</span>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-6 p-3 bg-slate-800/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">{currentUser.name.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">{currentUser.role}</p>
            </div>
          </div>

          <div className="text-xs uppercase text-slate-500 mb-2 font-bold tracking-widest">System Engine</div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-indigo-400 animate-pulse' : 'bg-green-400'}`}></div>
            <span className="text-slate-300">Agentic Monitor: {isMonitoring ? 'Processing...' : 'Operational'}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Next Cycle: {new Date(lastRun + 15000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 py-2 border border-slate-700 rounded-lg text-xs font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition"
          >
            Logout session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto bg-slate-50">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>{userDept?.name || 'Global Administration'}</span>
              <span>•</span>
              <span>{TEAMS.find(t => t.id === currentUser.teamId)?.name || 'General Org'}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Operational Intelligence Console</h2>
            <p className="text-slate-500 text-sm">Welcome back, {currentUser.name}. Monitoring {filteredTasks.length} active threads.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white px-3 py-2 rounded-lg border flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Personal Reliability</p>
                <p className="text-sm font-bold text-slate-700">{(currentUser.reliabilityScore * 100).toFixed(0)}%</p>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                {currentUser.reliabilityScore > 0.9 ? 'S+' : 'A'}
              </div>
            </div>
          </div>
        </header>

        <ProjectManager currentUser={currentUser} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Actions & Tasks */}
          <div className="xl:col-span-2 space-y-8">

            {/* Context-Aware Action Panel */}
            {canManage ? (
              <div className="glass-panel p-6 rounded-2xl bg-white shadow-sm border-slate-200/60">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  Delegate New Workflow
                </h3>
                <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Workflow Target</label>
                    <input name="title" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium" placeholder="e.g. Critical Bug Fix: Payment Gateway" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                    <textarea name="description" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium" placeholder="Brief description of the task..." rows={1} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Urgency</label>
                    <select name="priority" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                      <option value="LOW">Low Latency</option>
                      <option value="MEDIUM">Standard</option>
                      <option value="HIGH">Critical Path</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">TTL (Minutes)</label>
                    <input name="deadline" type="number" defaultValue="10" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium" />
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                    <select name="assigneeId" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                      <option value="">Auto-Assign (Based on Reliability)</option>
                      {(() => {
                        const storedUsersStr = localStorage.getItem('AEIP_USERS');
                        const allUsers = storedUsersStr ? JSON.parse(storedUsersStr) : USERS;
                        return allUsers.filter((u: User) => u.deptId === currentUser.deptId || currentUser.role === UserRole.ADMIN).map((u: User) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ));
                      })()}
                    </select>
                    <button type="submit" className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-600 transition shadow-lg shadow-slate-800/10">Deploy</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Current Load</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{filteredTasks.length}</p>
                  <p className="text-[10px] text-green-500 font-medium mt-1">Within optimal capacity</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">AI-Triggered Reminders</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{filteredTasks.filter(t => t.lastAction === ActionType.REMIND).length}</p>
                  <p className="text-[10px] text-indigo-500 font-medium mt-1">No critical alerts pending</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-sm">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase">Estimated Recovery</p>
                  <p className="text-2xl font-bold text-indigo-800 mt-1">94%</p>
                  <p className="text-[10px] text-indigo-400 font-medium mt-1">Based on historical RAG patterns</p>
                </div>
              </div>
            )}

            {/* Main Task Feed */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Icons.Task />
                  Operational Monitor
                </h3>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-white border text-[10px] font-bold rounded text-slate-500">REAL-TIME</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-6 py-4">Context</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">TTL</th>
                      <th className="px-6 py-4">Execution Risk</th>
                      <th className="px-6 py-4">Agentic Response</th>
                      {currentUser.role === UserRole.ASSIGNEE && <th className="px-6 py-4">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map(task => (
                      <tr
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${selectedTaskId === task.id ? 'bg-indigo-50' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{task.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${task.priority === 'HIGH' ? 'text-red-600 border-red-100 bg-red-50' : 'text-slate-500 border-slate-200'}`}>
                              {task.priority}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                              @{USERS.find(u => u.id === task.assigneeId)?.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          {task.deadline < Date.now() ? (
                            <span className="text-red-500 font-bold">LATE</span>
                          ) : (
                            `${Math.ceil((task.deadline - Date.now()) / (1000 * 60))}m`
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden w-20">
                              <div
                                className={`h-full transition-all duration-500 ${task.riskScore > 75 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : task.riskScore > 40 ? 'bg-amber-400' : 'bg-green-400'}`}
                                style={{ width: `${task.riskScore}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${task.riskScore > 75 ? 'text-red-500' : 'text-slate-400'}`}>
                              {task.riskScore}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getActionIcon(task.lastAction)}</span>
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                              {task.lastAction === ActionType.NONE ? 'Scanning' : task.lastAction.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        {currentUser.role === UserRole.ASSIGNEE && task.assigneeId === currentUser.id && (
                          <td className="px-6 py-4">
                            <select
                              className="px-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                              value={task.status}
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={TaskStatus.CREATED}>Created</option>
                              <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                              <option value={TaskStatus.SUBMITTED}>Submitted</option>
                              <option value={TaskStatus.COMPLETED}>Completed</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                          No active monitoring threads found in your current scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: AI Trace Panel */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 min-h-[600px] sticky top-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-indigo-600">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Icons.Brain />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Decision Trace</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-slate-400">ACTIVE</span>
                </div>
              </div>

              {!selectedTaskId ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 border border-dashed border-slate-200">
                    <Icons.Task />
                  </div>
                  <p className="text-sm font-bold text-slate-400">Select an execution thread</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">View the underlying RAG context and agentic reasoning.</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <section>
                    <label className="text-[10px] uppercase font-black text-slate-300 tracking-[0.2em] mb-3 block">RAG Memory Recall</label>
                    <div className="space-y-2">
                      {selectedLogs[0]?.retrievedMemories.map((m, idx) => (
                        <div key={idx} className="p-3 text-[11px] bg-indigo-50/40 text-indigo-700 border-l-4 border-indigo-400 rounded-r-xl font-medium leading-relaxed">
                          <span className="opacity-40 mr-1 text-xs">#</span> {m}
                        </div>
                      )) || <div className="text-[11px] text-slate-400 italic">Contextualizing behavioral history...</div>}
                    </div>
                  </section>

                  <section>
                    <label className="text-[10px] uppercase font-black text-slate-300 tracking-[0.2em] mb-3 block">SLM reasoning logic</label>
                    <div className="p-5 bg-slate-900 text-indigo-100 rounded-2xl text-[12px] leading-relaxed font-mono relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition">
                        <Icons.Brain />
                      </div>
                      <span className="text-indigo-400 mr-2">$</span>
                      {selectedLogs[0]?.explanation || "Initializing neural explanation layer..."}
                    </div>
                  </section>

                  <section>
                    <label className="text-[10px] uppercase font-black text-slate-300 tracking-[0.2em] mb-3 block">Escalation Path</label>
                    <div className="relative pl-8 pt-2">
                      <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-indigo-100"></div>
                      {(selectedLogs[0]?.escalationPath || [USERS.find(u => u.id === selectedTask?.assigneeId)?.name || 'Unassigned']).map((step, idx, arr) => (
                        <div key={idx} className="relative mb-6 last:mb-0 flex items-center gap-4 group">
                          <div className={`absolute -left-[23px] w-4 h-4 rounded-full border-4 border-white z-10 shadow-sm transition-all duration-300 ${idx === 0 ? 'bg-green-500' : idx < arr.length - 1 ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                          <div>
                            <span className={`text-[11px] font-bold block ${idx < arr.length - 1 ? 'text-slate-800' : 'text-slate-400'}`}>
                              {step}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">
                              {idx === 0 ? 'ACTIVE EXECUTOR' : idx === arr.length - 1 ? 'PENDING TARGET' : 'INTERMEDIARY'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 text-[11px] text-amber-700 flex gap-4">
              <div className="shrink-0 text-lg">🛡️</div>
              <p className="leading-normal">
                <strong>Data Privacy Protocol:</strong> Reasoning is performed on tokenized behavioral abstractions. No direct user content is exposed to third-party LLM providers.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
