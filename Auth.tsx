import React, { useState } from 'react';
import { User, UserRole, Department, Team } from './types';
import { MOCK_ORG_ID, USERS } from './mockData';

interface AuthProps {
    onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: UserRole.ASSIGNEE,
    });
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Initial simple storage logic
        const storedUsersStr = localStorage.getItem('AEIP_USERS');
        const storedUsers: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [...USERS]; // Fallback to mock users if empty

        if (isLogin) {
            let user = storedUsers.find(
                u => (u.email === formData.email || u.name === formData.email) && (u.password === formData.password || !u.password) // Allow name login for mock users
            );

            // Fallback: Check hardcoded USERS if not found in local storage (handles updates to mockData.ts)
            if (!user) {
                user = USERS.find(
                    u => (u.email === formData.email || u.name === formData.email) && (u.password === formData.password || !u.password)
                );
            }

            if (user) {
                onLogin(user);
            } else {
                setError("Invalid credentials");
            }
        } else {
            // Register
            if (storedUsers.some(u => u.email === formData.email)) {
                setError("User already exists");
                return;
            }

            const newUser: User = {
                id: `USER-${Date.now()}`,
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                teamId: 'UNASSIGNED', // Will be assigned later
                deptId: 'UNASSIGNED',
                reliabilityScore: 0.5, // Start neutral
            };

            const updatedUsers = [...storedUsers, newUser];
            localStorage.setItem('AEIP_USERS', JSON.stringify(updatedUsers));
            onLogin(newUser);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-block w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-xl font-bold mb-4 shadow-lg shadow-indigo-500/20">AE</div>
                    <h1 className="text-2xl font-bold text-white mb-2">{isLogin ? 'Welcome Back' : 'Join the Organization'}</h1>
                    <p className="text-slate-400 text-sm">Agentic Execution Intelligence Platform</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                            <input
                                name="name"
                                type="text"
                                required
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email / ID</label>
                        <input
                            name="email"
                            type="text" // Allow text for mock usernames
                            required
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role</label>
                            <select
                                name="role"
                                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value={UserRole.ADMIN}>Organization</option>
                                <option value={UserRole.TEAM_LEAD}>Team Lead</option>
                                <option value={UserRole.ASSIGNEE}>Employee</option>
                            </select>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded-lg border border-red-500/20 text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition shadow-lg shadow-indigo-500/25 mt-6"
                    >
                        {isLogin ? 'Login' : 'create account'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs text-slate-500 hover:text-white transition underline"
                    >
                        {isLogin ? "Need an account? Register" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};
