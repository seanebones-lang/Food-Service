'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Cpu,
  HardDrive,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface HealthCheck {
  status: 'OK' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  uptime: number;
  environment: string;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
    square: HealthStatus;
    queues: HealthStatus;
  };
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
  lastCheck?: string;
}

export default function HealthDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch health status
  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      // Mock data for demonstration
      return {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: 12345,
        environment: 'production',
        checks: {
          database: {
            status: 'healthy',
            responseTime: 12,
            lastCheck: new Date().toISOString(),
          },
          redis: {
            status: 'healthy',
            responseTime: 3,
            lastCheck: new Date().toISOString(),
          },
          square: {
            status: 'healthy',
            responseTime: 245,
            lastCheck: new Date().toISOString(),
          },
          queues: {
            status: 'healthy',
            responseTime: 8,
            lastCheck: new Date().toISOString(),
          },
        },
        metrics: {
          cpu: 42.5,
          memory: 68.2,
          requests: 1523,
        },
      } as HealthCheck;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'OK':
        return 'text-green-600 bg-green-100';
      case 'unhealthy':
      case 'DEGRADED':
        return 'text-yellow-600 bg-yellow-100';
      case 'DOWN':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'OK':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'unhealthy':
      case 'DEGRADED':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'DOWN':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <Activity className="h-6 w-6 text-gray-600" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading health status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Activity className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
              <p className="text-gray-600 mt-1">Real-time system monitoring</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="auto-refresh" className="text-sm text-gray-600">
                Auto-refresh (5s)
              </label>
            </div>

            <div className={`px-4 py-2 rounded-lg font-semibold ${getStatusColor(health?.status || 'unknown')}`}>
              {health?.status || 'UNKNOWN'}
            </div>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Uptime</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatUptime(health?.uptime || 0)}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {health?.metrics.cpu.toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Cpu className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${health?.metrics.cpu}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {health?.metrics.memory.toFixed(1)}%
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${health?.metrics.memory}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Requests/min</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {health?.metrics.requests.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Health Checks */}
      <div className="grid grid-cols-2 gap-6">
        {/* Database */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold">PostgreSQL Database</h2>
            </div>
            {getStatusIcon(health?.checks.database.status || 'unknown')}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${getStatusColor(health?.checks.database.status || 'unknown')}`}>
                {health?.checks.database.status?.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-mono text-sm">
                {health?.checks.database.responseTime}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Last Check:</span>
              <span className="text-sm text-gray-500">
                {health?.checks.database.lastCheck &&
                  new Date(health.checks.database.lastCheck).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Redis */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Server className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-semibold">Redis Cache</h2>
            </div>
            {getStatusIcon(health?.checks.redis.status || 'unknown')}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${getStatusColor(health?.checks.redis.status || 'unknown')}`}>
                {health?.checks.redis.status?.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-mono text-sm">
                {health?.checks.redis.responseTime}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Last Check:</span>
              <span className="text-sm text-gray-500">
                {health?.checks.redis.lastCheck &&
                  new Date(health.checks.redis.lastCheck).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Square API */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Zap className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-semibold">Square API</h2>
            </div>
            {getStatusIcon(health?.checks.square.status || 'unknown')}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${getStatusColor(health?.checks.square.status || 'unknown')}`}>
                {health?.checks.square.status?.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-mono text-sm">
                {health?.checks.square.responseTime}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Last Check:</span>
              <span className="text-sm text-gray-500">
                {health?.checks.square.lastCheck &&
                  new Date(health.checks.square.lastCheck).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Background Queues */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-green-600" />
              <h2 className="text-xl font-semibold">Background Queues</h2>
            </div>
            {getStatusIcon(health?.checks.queues.status || 'unknown')}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold px-3 py-1 rounded-full text-sm ${getStatusColor(health?.checks.queues.status || 'unknown')}`}>
                {health?.checks.queues.status?.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-mono text-sm">
                {health?.checks.queues.responseTime}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Last Check:</span>
              <span className="text-sm text-gray-500">
                {health?.checks.queues.lastCheck &&
                  new Date(health.checks.queues.lastCheck).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
