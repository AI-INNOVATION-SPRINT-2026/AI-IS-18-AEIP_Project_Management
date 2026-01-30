import React, { useState, useEffect } from 'react';
import { User, UserRole, Project } from './types';
import { USERS, MOCK_ORG_ID } from './mockData';

interface ProjectManagerProps {
    currentUser: User;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ currentUser }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState<{ name: string; description: string; leadId?: string }>({ name: '', description: '' });

    useEffect(() => {
        // Load Projects
        const storedProjectsStr = localStorage.getItem('AEIP_PROJECTS');
        if (storedProjectsStr) {
            setProjects(JSON.parse(storedProjectsStr));
        }

        // Load Users
        const storedUsersStr = localStorage.getItem('AEIP_USERS');
        if (storedUsersStr) {
            setUsers(JSON.parse(storedUsersStr));
        } else {
            setUsers(USERS);
        }
    }, []);

    const saveProjects = (updatedProjects: Project[]) => {
        setProjects(updatedProjects);
        localStorage.setItem('AEIP_PROJECTS', JSON.stringify(updatedProjects));
    };

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        const project: Project = {
            id: `PROJ-${Date.now()}`,
            name: newProject.name,
            description: newProject.description,
            orgId: MOCK_ORG_ID,
            leadId: newProject.leadId,
            memberIds: [],
            status: 'ACTIVE',
            createdAt: Date.now(),
        };
        saveProjects([...projects, project]);
        setShowCreateModal(false);
        setNewProject({ name: '', description: '', leadId: '' });

        // Simple visual feedback
        alert(`Project "${newProject.name}" created successfully!`);
    };

    const handleAssignLead = (projectId: string, leadId: string) => {
        const updated = projects.map(p =>
            p.id === projectId ? { ...p, leadId } : p
        );
        saveProjects(updated);
    };

    const handleAddMember = (projectId: string, memberId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project && !project.memberIds.includes(memberId)) {
            const updated = projects.map(p =>
                p.id === projectId ? { ...p, memberIds: [...p.memberIds, memberId] } : p
            );
            saveProjects(updated);
        }
    };

    // Filter projects based on role
    const visibleProjects = projects.filter(p => {
        if (currentUser.role === UserRole.ADMIN) return true;
        if (currentUser.role === UserRole.TEAM_LEAD) return p.leadId === currentUser.id;
        return p.memberIds.includes(currentUser.id);
    });

    const availableLeads = users.filter(u => u.role === UserRole.TEAM_LEAD || u.role === UserRole.MANAGER);
    const availableEmployees = users.filter(u => u.role === UserRole.ASSIGNEE);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Project Management</h2>
                    <p className="text-sm text-slate-500">
                        {currentUser.role === UserRole.ADMIN ? 'Manage Organization Projects' :
                            currentUser.role === UserRole.TEAM_LEAD ? 'My Assigned Projects' : 'My Active Projects'}
                    </p>
                </div>
                {currentUser.role === UserRole.ADMIN && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition"
                    >
                        + New Project
                    </button>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl w-96 shadow-2xl">
                        <h3 className="font-bold mb-4">Create New Project</h3>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Project Name</label>
                                <input
                                    placeholder="e.g. Q1 Marketing Campaign"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newProject.name}
                                    onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                                <textarea
                                    placeholder="Brief description of the initiative..."
                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                    value={newProject.description}
                                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assign Team Lead (Optional)</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={newProject.leadId || ''}
                                    onChange={e => setNewProject({ ...newProject, leadId: e.target.value })}
                                >
                                    <option value="">-- Select Team Lead --</option>
                                    {availableLeads.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 shadow-lg shadow-indigo-500/20">Create Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleProjects.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-400 text-sm italic">
                        No projects found.
                    </div>
                ) : (
                    visibleProjects.map(project => (
                        <div key={project.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition bg-slate-50/50">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800">{project.name}</h3>
                                <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-md font-bold">{project.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4 h-10 overflow-hidden">{project.description}</p>

                            <div className="space-y-3">
                                {/* Team Lead Section */}
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Team Lead</label>
                                    {currentUser.role === UserRole.ADMIN ? (
                                        <select
                                            className="w-full text-xs p-1 border rounded bg-white"
                                            value={project.leadId || ''}
                                            onChange={(e) => handleAssignLead(project.id, e.target.value)}
                                        >
                                            <option value="">Select Lead...</option>
                                            {availableLeads.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-xs font-medium text-slate-700">
                                            {users.find(u => u.id === project.leadId)?.name || 'Unassigned'}
                                        </div>
                                    )}
                                </div>

                                {/* Members Section */}
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Team Members ({project.memberIds.length})</label>
                                    <div className="flex -space-x-2 overflow-hidden mb-2">
                                        {project.memberIds.map(mid => {
                                            const m = users.find(u => u.id === mid);
                                            return m ? (
                                                <div key={mid} title={m.name} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                    {m.name.charAt(0)}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>

                                    {currentUser.role === UserRole.TEAM_LEAD && project.leadId === currentUser.id && (
                                        <select
                                            className="w-full text-xs p-1 border rounded bg-white"
                                            value=""
                                            onChange={(e) => handleAddMember(project.id, e.target.value)}
                                        >
                                            <option value="">+ Add Member</option>
                                            {availableEmployees.filter(u => !project.memberIds.includes(u.id)).map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
