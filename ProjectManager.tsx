import React, { useState, useEffect } from 'react';
import { User, UserRole, Project } from './types';
import { USERS, MOCK_ORG_ID } from './mockData';
import { userAPI, projectAPI } from './api/client';

interface ProjectManagerProps {
    currentUser: User;
    onProjectsChange?: (projects: Project[]) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ currentUser, onProjectsChange }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                // Load users from MongoDB
                const loadedUsers = await userAPI.getAll();
                setUsers(loadedUsers);

                // Load projects from MongoDB
                const loadedProjects = await projectAPI.getAll();
                setProjects(loadedProjects);
                console.log('📁 ProjectManager loaded:', loadedProjects.length, 'projects');
            } catch (error) {
                console.error('Failed to load data:', error);
                // Fallback to mock data
                setUsers(USERS);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const refreshProjects = async () => {
        try {
            const loadedProjects = await projectAPI.getAll();
            setProjects(loadedProjects);
            if (onProjectsChange) {
                onProjectsChange(loadedProjects);
            }
        } catch (error) {
            console.error('Failed to refresh projects:', error);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const leadId = currentUser.role === UserRole.TEAM_LEAD ? currentUser.id : undefined;
            const newProj = await projectAPI.create({
                name: newProject.name,
                description: newProject.description,
                orgId: MOCK_ORG_ID
            }, leadId);

            console.log('✅ Project created:', newProj);
            await refreshProjects();
            setShowCreateModal(false);
            setNewProject({ name: '', description: '' });
        } catch (error: any) {
            console.error('Failed to create project:', error);
            alert(`Failed to create project: ${error.message}`);
        }
    };

    const handleAssignLead = async (projectId: string, leadId: string) => {
        try {
            await projectAPI.update(projectId, { leadId });
            await refreshProjects();
        } catch (error: any) {
            console.error('Failed to assign lead:', error);
            alert(`Failed to assign lead: ${error.message}`);
        }
    };

    const handleAddMember = async (projectId: string, memberId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project && !project.memberIds.includes(memberId)) {
            try {
                await projectAPI.addMember(projectId, memberId);
                await refreshProjects();
            } catch (error: any) {
                console.error('Failed to add member:', error);
                alert(`Failed to add member: ${error.message}`);
            }
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
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_LEAD) && (
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
                            <input
                                placeholder="Project Name"
                                required
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                value={newProject.name}
                                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                            />
                            <textarea
                                placeholder="Description"
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                value={newProject.description}
                                onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1 text-xs font-bold text-slate-500">Cancel</button>
                                <button type="submit" className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-lg">Create</button>
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
