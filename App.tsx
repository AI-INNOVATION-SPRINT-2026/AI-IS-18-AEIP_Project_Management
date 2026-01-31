
import React, { useState, useEffect, useMemo } from 'react';
import {
  Task, TaskStatus, User, DecisionLog, ActionType, UserRole, Project
} from './types';
import {
  INITIAL_TASKS, USERS, DEPARTMENTS, TEAMS
} from './mockData';
import { runMonitoringCycle } from './agentService';
import { Icons, ALL_SKILLS } from './constants';
import { Auth } from './Auth';
import { ProjectManager } from './ProjectManager';
import { initMemories } from './vectorStore';
import { autoAssignTask, getSkillMatchPercentage } from './assignmentService';
import { SkillManager } from './SkillManager';
import { GanttChart } from './GanttChart';
import { userAPI, taskAPI, projectAPI } from './api/client';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'GANTT'>('LIST');
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastRun, setLastRun] = useState<number>(Date.now());
  const [showSkillManager, setShowSkillManager] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('AEIP_CURRENT_USER', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('AEIP_CURRENT_USER');
  };

  // Load data from MongoDB API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Restore session from localStorage
        const savedUser = localStorage.getItem('AEIP_CURRENT_USER');
        if (savedUser) {
          setCurrentUser(JSON.parse(savedUser));
        }

        // Load users from MongoDB
        const loadedUsers = await userAPI.getAll();
        setUsers(loadedUsers);
        console.log('👥 Loaded users from MongoDB:', loadedUsers.length, 'users');

        // Load tasks from MongoDB
        const loadedTasks = await taskAPI.getAll();
        setTasks(loadedTasks);
        console.log('📋 Loaded tasks from MongoDB:', loadedTasks.length, 'tasks');

        // Load projects from MongoDB
        const loadedProjects = await projectAPI.getAll();
        setProjects(loadedProjects);
        console.log('📁 Loaded projects from MongoDB:', loadedProjects.length, 'projects');

      } catch (error) {
        console.error('Failed to load data from MongoDB:', error);
        console.log('⚠️ Using fallback mock data');
        // Fallback to mock data if API fails
        setUsers(USERS);
        setTasks(INITIAL_TASKS);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Initialize RAG Service with mock data
    initMemories();
  }, []);

  // Autonomous loop simulator
  const isMonitoringRef = React.useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      if (isMonitoringRef.current) {
        console.log('⏳ Skipping monitoring cycle - previous cycle still active');
        return;
      }

      try {
        isMonitoringRef.current = true;
        setIsMonitoring(true);

        await runMonitoringCycle(
          tasks,
          users,
          (log) => setLogs(prev => [log, ...prev]),
          (updatedTasks) => {
            setTasks(updatedTasks);
            localStorage.setItem('AEIP_TASKS', JSON.stringify(updatedTasks));
          }
        );

        setLastRun(Date.now());
      } catch (err) {
        console.error("Monitoring cycle error:", err);
      } finally {
        setIsMonitoring(false);
        isMonitoringRef.current = false;
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [tasks, currentUser, users]);

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
        // Show tasks assigned to user OR belonging to projects user is a member of
        const userProjectIds = projects
          .filter(p => p.memberIds.includes(currentUser.id))
          .map(p => p.id);

        return tasks.filter(t =>
          t.assigneeId === currentUser.id ||
          (t.projectId && userProjectIds.includes(t.projectId))
        );
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

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

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

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);

    // Get selected skills from form
    const skillsSelect = e.currentTarget.querySelector('select[name="requiredSkills"]') as HTMLSelectElement;
    const selectedSkills = skillsSelect ? Array.from(skillsSelect.selectedOptions).map(opt => opt.value) : [];

    // Get assignee from dropdown (optional - backend will auto-assign if not provided)
    const manualAssigneeId = formData.get('assigneeId') as string;

    try {
      // Prepare task data
      const taskData = {
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || 'Task created via workflow delegation',
        priority: formData.get('priority') as string,
        deadline: Date.now() + parseInt(formData.get('deadline') as string) * 60 * 1000,
        teamId: currentUser.teamId,
        deptId: currentUser.deptId,
        orgId: 'ORG-001',
        projectId: formData.get('projectId') as string || undefined,
        requiredSkills: selectedSkills.length > 0 ? selectedSkills : undefined,
        assigneeId: manualAssigneeId || undefined // Let backend auto-assign if empty
      };

      console.log('📤 Creating task with data:', taskData);

      // Create task via MongoDB API (backend handles auto-assignment)
      const newTask = await taskAPI.create(taskData);

      console.log('✅ Task created:', newTask);

      // Add to local state
      setTasks([newTask, ...tasks]);
      // Reset form safely
      const form = e.currentTarget;
      if (form) form.reset();
    } catch (error: any) {
      console.error('Failed to create task:', error);
      alert(`Failed to create task: ${error.message}`);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      console.log(`📝 Completing task ${taskId} automatically...`);

      // Complete task via API (no args - let backend auto-calculate)
      const completedTask = await taskAPI.complete(taskId);

      console.log('✅ Task completed:', completedTask);

      // Update local state
      setTasks(tasks.map(t => t.id === taskId ? completedTask : t));

      alert(`Task completed automatically!\n\nUse: Time spent has been calculated based on assignment duration.`);
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      alert(`Failed to complete task: ${error.message}`);
    }
  };

  const handleUpdateSkills = (updatedUser: User) => {
    setCurrentUser(updatedUser);
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

          {/* User Skills Section */}
          <div className="mt-6 p-3 bg-slate-800/50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Your Skills</p>
              <button
                onClick={() => setShowSkillManager(true)}
                className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase underline"
              >
                Manage
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {currentUser.skills && currentUser.skills.length > 0 ? (
                currentUser.skills.slice(0, 6).map(skill => (
                  <span key={skill} className="text-[9px] px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-md font-medium border border-indigo-500/30">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-500 italic">No skills added</span>
              )}
            </div>
            {currentUser.skills && currentUser.skills.length > 6 && (
              <p className="text-[9px] text-slate-500 mt-1">+{currentUser.skills.length - 6} more</p>
            )}
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
            {/* View Mode Toggle */}
            <div className="bg-white p-1 rounded-lg border flex items-center">
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icons.Task />
                  <span>LIST</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode('GANTT')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'GANTT' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span>📊</span>
                  <span>GANTT</span>
                </div>
              </button>
            </div>

            <div className="bg-white px-3 py-2 rounded-lg border flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Performance Score</p>
                <p className="text-sm font-bold text-slate-700">{(currentUser.reliabilityScore * 10).toFixed(1)}/10</p>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                {currentUser.reliabilityScore >= 0.9 ? 'S+' : currentUser.reliabilityScore >= 0.7 ? 'A' : 'B'}
              </div>
            </div>
          </div>
        </header>

        <ProjectManager
          currentUser={currentUser}
          onProjectsChange={(updatedProjects) => setProjects(updatedProjects)}
        />

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
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Assign to Project (Optional)
                    </label>
                    <select
                      name="projectId"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                    >
                      <option value="">No Project (General Task)</option>
                      {projects.filter(p =>
                        currentUser.role === UserRole.ADMIN ||
                        p.leadId === currentUser.id ||
                        p.memberIds.includes(currentUser.id)
                      ).map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name} {project.leadId === currentUser.id ? '(You lead)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">
                      {projects.length === 0
                        ? '⚠️ No projects found. Create a project in "Project Management" section above first.'
                        : `Link this task to a specific project for better organization (${projects.filter(p => currentUser.role === UserRole.ADMIN || p.leadId === currentUser.id || p.memberIds.includes(currentUser.id)).length} available)`
                      }
                    </p>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Required Skills (Auto-assigns to best match)
                    </label>
                    <select
                      name="requiredSkills"
                      multiple
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium max-h-24"
                    >
                      {ALL_SKILLS.slice(0, 15).map(skill => (
                        <option key={skill} value={skill}>{skill}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">
                      💡 Selecting skills will auto-assign to employee with best skill+performance match
                    </p>
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                    <select name="assigneeId" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium">
                      <option value="">🤖 Auto-Assign (Skill + Performance Match)</option>
                      {USERS.filter(u =>
                        (u.deptId === currentUser.deptId || currentUser.role === UserRole.ADMIN) &&
                        u.role !== UserRole.ADMIN
                      ).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role}) - {(u.reliabilityScore * 10).toFixed(1)}/10</option>
                      ))}
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
            {viewMode === 'LIST' ? (
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
                        <th className="px-6 py-4">Assignee / Project</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">TTL</th>
                        <th className="px-6 py-4">Execution Risk</th>
                        <th className="px-6 py-4">Agentic Response</th>
                        <th className="px-6 py-4">Actions</th>
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
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${task.priority === 'HIGH' ? 'text-red-600 border-red-100 bg-red-50' : 'text-slate-500 border-slate-200'}`}>
                                {task.priority}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                                👤 {users.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}
                              </span>
                              {task.requiredSkills && task.requiredSkills.length > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  {task.requiredSkills.length} skill{task.requiredSkills.length > 1 ? 's' : ''} req.
                                </span>
                              )}
                              {task.projectId && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">
                                  📁 {projects.find(p => p.id === task.projectId)?.name || 'Project'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-700">
                                  👤 {users.find(u => u.id === task.assigneeId)?.name || 'Unassigned'}
                                </span>
                              </div>
                              {task.projectId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">
                                    📁 {projects.find(p => p.id === task.projectId)?.name || 'Project'}
                                  </span>
                                </div>
                              )}
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
                          <td className="px-6 py-4">
                            {task.status !== 'COMPLETED' && task.assigneeId === currentUser.id && (
                              <button
                                onClick={() => handleCompleteTask(task.id)}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                              >
                                ✓ Complete
                              </button>
                            )}
                            {task.status === 'COMPLETED' && (
                              <span className="text-[10px] text-green-600 font-bold">
                                ✓ Done
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredTasks.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                            No active monitoring threads found in your current scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <GanttChart tasks={filteredTasks} users={users} />
            )}
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
      </main >

      {/* Skill Manager Modal */}
      {
        showSkillManager && (
          <SkillManager
            currentUser={currentUser}
            onUpdateSkills={handleUpdateSkills}
            onClose={() => setShowSkillManager(false)}
          />
        )
      }
    </div >
  );
};

export default App;
