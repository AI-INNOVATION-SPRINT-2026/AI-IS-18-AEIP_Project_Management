
import { User, UserRole, Department, Team, Task, TaskStatus, ActionType, MemoryRecord } from './types';

export const MOCK_ORG_ID = 'ORG-001';

export const DEPARTMENTS: Department[] = [
  { id: 'DEPT-01', name: 'Product Engineering' },
  { id: 'DEPT-02', name: 'HR Operations' },
];

export const TEAMS: Team[] = [
  { id: 'TEAM-01', name: 'Mobile Core', deptId: 'DEPT-01', leadId: 'USER-02' },
  { id: 'TEAM-02', name: 'Infrastructure', deptId: 'DEPT-01', leadId: 'USER-03' },
  { id: 'TEAM-03', name: 'Recruitment', deptId: 'DEPT-02', leadId: 'USER-05' },
];

export const USERS: User[] = [
  { id: 'USER-01', name: 'Alex Johnson', role: UserRole.ASSIGNEE, teamId: 'TEAM-01', deptId: 'DEPT-01', reliabilityScore: 0.85 },
  { id: 'USER-02', name: 'Sarah Chen', role: UserRole.TEAM_LEAD, teamId: 'TEAM-01', deptId: 'DEPT-01', reliabilityScore: 0.95 },
  { id: 'USER-03', name: 'Mike Ross', role: UserRole.TEAM_LEAD, teamId: 'TEAM-02', deptId: 'DEPT-01', reliabilityScore: 0.90 },
  { id: 'USER-04', name: 'Jordan Smith', role: UserRole.MANAGER, teamId: 'TEAM-01', deptId: 'DEPT-01', reliabilityScore: 0.98 },
  { id: 'USER-05', name: 'Lisa Ray', role: UserRole.TEAM_LEAD, teamId: 'TEAM-03', deptId: 'DEPT-02', reliabilityScore: 0.80 },
  { id: 'USER-06', name: 'System Admin', role: UserRole.ADMIN, teamId: 'SYSTEM', deptId: 'SYSTEM', reliabilityScore: 1.0, email: 'admin@aeip.com', password: 'admin' },
];

const NOW = Date.now();
const ONE_HOUR = 60 * 60 * 1000;

export const INITIAL_TASKS: Task[] = [
  {
    id: 'TASK-01',
    title: 'Update Mobile SDK to v2.4',
    description: 'Ensure all dependencies are upgraded for the new release.',
    status: TaskStatus.IN_PROGRESS,
    priority: 'HIGH',
    deadline: NOW + ONE_HOUR * 2, // 2 hours from now
    assigneeId: 'USER-01',
    teamId: 'TEAM-01',
    deptId: 'DEPT-01',
    orgId: MOCK_ORG_ID,
    riskScore: 15,
    lastAction: ActionType.NONE,
    updatedAt: NOW,
  },
  {
    id: 'TASK-02',
    title: 'Quarterly Infrastructure Audit',
    description: 'Standard security audit of cloud resources.',
    status: TaskStatus.CREATED,
    priority: 'MEDIUM',
    deadline: NOW - ONE_HOUR * 1, // Already overdue!
    assigneeId: 'USER-01',
    teamId: 'TEAM-01',
    deptId: 'DEPT-01',
    orgId: MOCK_ORG_ID,
    riskScore: 0,
    lastAction: ActionType.NONE,
    updatedAt: NOW,
  },
  {
    id: 'TASK-03',
    title: 'Onboarding docs for New Engineers',
    description: 'Finalize the documentation for the upcoming cohort.',
    status: TaskStatus.SUBMITTED,
    priority: 'LOW',
    deadline: NOW + ONE_HOUR * 24,
    assigneeId: 'USER-05',
    teamId: 'TEAM-03',
    deptId: 'DEPT-02',
    orgId: MOCK_ORG_ID,
    riskScore: 5,
    lastAction: ActionType.NONE,
    updatedAt: NOW,
  },
];

export const MEMORY_POOL: MemoryRecord[] = [
  { id: 'M-1', summary: 'User USER-01 often delays high priority tasks near weekends.', userId: 'USER-01', timestamp: NOW - ONE_HOUR * 100 },
  { id: 'M-2', summary: 'Department DEPT-01 has a 20% higher probability of missing deadlines on infrastructure tasks.', deptId: 'DEPT-01', timestamp: NOW - ONE_HOUR * 200 },
  { id: 'M-3', summary: 'Previous escalations to USER-02 (Team Lead) resulted in 90% task recovery within 4 hours.', userId: 'USER-02', timestamp: NOW - ONE_HOUR * 50 },
  { id: 'M-4', summary: 'Mobile SDK updates typically take 4-6 hours longer than estimated by junior staff.', taskType: 'Update', timestamp: NOW - ONE_HOUR * 150 },
  { id: 'M-5', summary: 'User USER-05 ignores reminder notifications 60% of the time.', userId: 'USER-05', timestamp: NOW - ONE_HOUR * 80 },
  { id: 'M-6', summary: 'HR Operations team consistently delivers tasks on time except for recruitment tasks.', deptId: 'DEPT-02', timestamp: NOW - ONE_HOUR * 120 },
  // ... more mock memories
];
