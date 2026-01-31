/**
 * API Client for MongoDB Backend
 * Replaces localStorage with HTTP calls to FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8001/api';

// Types matching backend models
export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    teamId: string;
    deptId: string;
    reliabilityScore: number;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    orgId: string;
    leadId?: string;
    memberIds: string[];
    status: string;
    createdAt: number;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    deadline: number;
    assigneeId: string;
    teamId: string;
    deptId: string;
    orgId: string;
    projectId?: string;
    riskScore: number;
    lastAction: string;
    updatedAt: number;
}

// HTTP helper
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

// ==================== AUTH API ====================

export async function registerUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
}): Promise<User> {
    return fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function loginUser(email: string, password: string): Promise<User> {
    return fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

// ==================== USER API ====================

export async function getUsers(): Promise<User[]> {
    return fetchAPI('/users');
}

export async function getUser(userId: string): Promise<User> {
    return fetchAPI(`/users/${userId}`);
}

// ==================== PROJECT API ====================

export async function createProject(data: {
    name: string;
    description: string;
    leadId?: string;
}): Promise<Project> {
    return fetchAPI('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getProjects(): Promise<Project[]> {
    return fetchAPI('/projects');
}

export async function assignProjectLead(projectId: string, leadId: string): Promise<void> {
    return fetchAPI(`/projects/${projectId}/assign-lead?lead_id=${leadId}`, {
        method: 'PUT',
    });
}

export async function addProjectMember(projectId: string, memberId: string): Promise<void> {
    return fetchAPI(`/projects/${projectId}/add-member?member_id=${memberId}`, {
        method: 'PUT',
    });
}

// ==================== TASK API ====================

export async function createTask(data: {
    title: string;
    description: string;
    priority: string;
    deadline: number;
    assigneeId: string;
    projectId?: string;
}): Promise<Task> {
    return fetchAPI('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getTasks(filters?: {
    user_id?: string;
    team_id?: string;
    project_id?: string;
}): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.team_id) params.append('team_id', filters.team_id);
    if (filters?.project_id) params.append('project_id', filters.project_id);

    const query = params.toString();
    return fetchAPI(`/tasks${query ? `?${query}` : ''}`);
}

export async function updateTask(
    taskId: string,
    data: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        deadline: number;
    }>
): Promise<Task> {
    return fetchAPI(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// ==================== USER ACTIONS API ====================

export async function logUserAction(data: {
    userId: string;
    actionType: string;
    taskId?: string;
    details?: any;
}): Promise<void> {
    return fetchAPI('/actions/log', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getUserActions(userId: string, limit: number = 100): Promise<any[]> {
    return fetchAPI(`/actions/${userId}?limit=${limit}`);
}

// ==================== PERFORMANCE API ====================

export async function getPerformanceMetrics(userId: string): Promise<{
    userId: string;
    totalTasksAssigned: number;
    tasksCompleted: number;
    tasksCompletedOnTime: number;
    tasksCompletedLate: number;
    reliabilityScore: number;
}> {
    return fetchAPI(`/performance/${userId}`);
}

// ==================== HEALTH CHECK ====================

export async function checkAPIHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.json();
}
