'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Admin Dashboard
 *
 * Comprehensive administration interface for:
 * - User management
 * - Role assignment
 * - System configuration
 * - Feature flag management
 * - Queue management
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN';
  createdAt: string;
  lastLogin?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  description: string;
}

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'features' | 'queues' | 'settings'>('users');
  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage users, features, and system configuration</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'users', label: 'Users', icon: '👥' },
                { id: 'features', label: 'Feature Flags', icon: '🚩' },
                { id: 'queues', label: 'Background Jobs', icon: '⚙️' },
                { id: 'settings', label: 'Settings', icon: '🔧' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'features' && <FeatureFlagsTab />}
            {activeTab === 'queues' && <QueuesTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/admin/users`);
      return data as User[];
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
      const { data } = await axios.patch(`${API_URL}/api/admin/users/${userId}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await axios.delete(`${API_URL}/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  return (
    <div>
      {/* Header with Create Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">User Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.map((user) => (
              <tr key={user.id} data-testid="user-row">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete user ${user.name}?`)) {
                        deleteUserMutation.mutate(user.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={(updates) => updateUserMutation.mutate({ userId: selectedUser.id, updates })}
        />
      )}
    </div>
  );
}

function FeatureFlagsTab() {
  const queryClient = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/admin/feature-flags`);
      return data as FeatureFlag[];
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ key, updates }: { key: string; updates: Partial<FeatureFlag> }) => {
      const { data } = await axios.patch(`${API_URL}/api/admin/feature-flags/${key}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading feature flags...</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Feature Flag Management</h2>

      <div className="space-y-4">
        {flags?.map((flag) => (
          <div
            key={flag.key}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            data-testid="feature-flag"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-medium">{flag.key}</h3>
                  <button
                    onClick={() =>
                      updateFlagMutation.mutate({
                        key: flag.key,
                        updates: { enabled: !flag.enabled },
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      flag.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
              </div>

              <div className="ml-6">
                <label className="text-sm text-gray-600">Rollout:</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={flag.rolloutPercentage}
                  onChange={(e) =>
                    updateFlagMutation.mutate({
                      key: flag.key,
                      updates: { rolloutPercentage: parseInt(e.target.value) },
                    })
                  }
                  className="w-32 ml-2"
                  disabled={!flag.enabled}
                />
                <span className="ml-2 text-sm font-medium">{flag.rolloutPercentage}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueuesTab() {
  const { data: queueStats, isLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/admin/queues/stats`);
      return data as QueueStats[];
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading queue statistics...</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Background Job Queues</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {queueStats?.map((queue) => (
          <div
            key={queue.name}
            className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            data-testid="queue-card"
          >
            <h3 className="text-lg font-semibold mb-4">{queue.name}</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Waiting:</span>
                <span className="font-semibold text-yellow-600">{queue.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active:</span>
                <span className="font-semibold text-blue-600">{queue.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-semibold text-green-600">{queue.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="font-semibold text-red-600">{queue.failed}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">System Settings</h2>

      <div className="space-y-6">
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">General Settings</h3>
          {/* Add settings forms here */}
          <p className="text-gray-600">System configuration options coming soon...</p>
        </div>
      </div>
    </div>
  );
}

function UserEditModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (updates: Partial<User>) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">Edit User: {user.name}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
              <option value="KITCHEN">Kitchen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ role, status })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-purple-100 text-purple-800';
    case 'MANAGER':
      return 'bg-blue-100 text-blue-800';
    case 'STAFF':
      return 'bg-green-100 text-green-800';
    case 'KITCHEN':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'INACTIVE':
      return 'bg-gray-100 text-gray-800';
    case 'SUSPENDED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
