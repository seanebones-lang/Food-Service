'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Calendar,
  Download,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      // Mock data for demonstration
      return {
        summary: {
          totalRevenue: 45230.50,
          totalOrders: 342,
          averageOrderValue: 132.25,
          totalCustomers: 218,
        },
        dailySales: [
          { date: '2025-01-06', revenue: 5420, orders: 42 },
          { date: '2025-01-07', revenue: 6230, orders: 51 },
          { date: '2025-01-08', revenue: 5890, orders: 48 },
          { date: '2025-01-09', revenue: 7120, orders: 58 },
          { date: '2025-01-10', revenue: 6540, orders: 52 },
          { date: '2025-01-11', revenue: 7830, orders: 61 },
          { date: '2025-01-12', revenue: 6200, orders: 50 },
        ],
        topItems: [
          { name: 'Margherita Pizza', sales: 142, revenue: 2130 },
          { name: 'Caesar Salad', sales: 98, revenue: 980 },
          { name: 'Pasta Carbonara', sales: 87, revenue: 1566 },
          { name: 'Grilled Salmon', sales: 65, revenue: 1625 },
          { name: 'Tiramisu', sales: 54, revenue: 432 },
        ],
        ordersByChannel: [
          { name: 'In-Person', value: 180 },
          { name: 'Online', value: 102 },
          { name: 'Phone', value: 42 },
          { name: 'QR Code', value: 18 },
        ],
        hourlyDistribution: [
          { hour: '11:00', orders: 12 },
          { hour: '12:00', orders: 28 },
          { hour: '13:00', orders: 35 },
          { hour: '14:00', orders: 22 },
          { hour: '17:00', orders: 18 },
          { hour: '18:00', orders: 42 },
          { hour: '19:00', orders: 58 },
          { hour: '20:00', orders: 48 },
          { hour: '21:00', orders: 35 },
        ],
      };
    },
  });

  const summary = analyticsData?.summary || {};
  const dailySales = analyticsData?.dailySales || [];
  const topItems = analyticsData?.topItems || [];
  const ordersByChannel = analyticsData?.ordersByChannel || [];
  const hourlyDistribution = analyticsData?.hourlyDistribution || [];

  const downloadReport = () => {
    // Generate CSV report
    const csv = `Revenue Analytics Report\n\n` +
      `Date Range: ${dateRange.start} to ${dateRange.end}\n\n` +
      `Summary:\n` +
      `Total Revenue,$${summary.totalRevenue}\n` +
      `Total Orders,${summary.totalOrders}\n` +
      `Average Order Value,$${summary.averageOrderValue}\n\n` +
      `Daily Sales:\n` +
      `Date,Revenue,Orders\n` +
      dailySales.map((d: any) => `${d.date},$${d.revenue},${d.orders}`).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time business intelligence</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="border rounded px-3 py-2"
              />
            </div>

            <button
              onClick={downloadReport}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${summary.totalRevenue?.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 mt-2">↑ 12.5% from last period</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary.totalOrders}
              </p>
              <p className="text-sm text-green-600 mt-2">↑ 8.2% from last period</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Order Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${summary.averageOrderValue}
              </p>
              <p className="text-sm text-green-600 mt-2">↑ 4.1% from last period</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary.totalCustomers}
              </p>
              <p className="text-sm text-green-600 mt-2">↑ 15.7% from last period</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Daily Sales Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Daily Sales Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue ($)" />
              <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} name="Orders" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Channel */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Orders by Channel</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={ordersByChannel}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {ordersByChannel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Top Selling Items</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#3B82F6" name="Units Sold" />
              <Bar dataKey="revenue" fill="#10B981" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Hourly Order Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#8B5CF6" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
