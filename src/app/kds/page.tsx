'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { Clock, CheckCircle2, AlertCircle, Users, ChefHat } from 'lucide-react';

interface OrderItem {
  id: string;
  menuItem: {
    name: string;
    category: string;
  };
  quantity: number;
  modifiers?: any;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED';
  customerName?: string;
  channel: string;
  orderItems: OrderItem[];
  total: number;
  createdAt: string;
  estimatedTime?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function KitchenDisplaySystem() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch active orders
  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/orders?status=PENDING,CONFIRMED,PREPARING`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    refetchInterval: 5000,
  });

  const orders: Order[] = ordersResponse?.data || [];

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    },
  });

  // Socket.io connection
  useEffect(() => {
    const newSocket = io(API_URL);

    newSocket.on('connect', () => {
      console.log('Connected to KDS socket');
      newSocket.emit('join-kitchen');
    });

    newSocket.on('new-order', (order: Order) => {
      console.log('New order received:', order);
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });

      // Play notification sound
      playNotificationSound();
    });

    newSocket.on('order-status-update', (data: { orderId: string; status: string }) => {
      console.log('Order status updated:', data);
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [queryClient]);

  const playNotificationSound = () => {
    // Browser notification sound
    const audio = new Audio('/notification.mp3');
    audio.play().catch(console.error);
  };

  const getElapsedTime = (createdAt: string): string => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000 / 60);
    return `${elapsed} min`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PREPARING':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'READY':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <header className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <ChefHat className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold">Kitchen Display System</h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="text-lg">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-400" />
              <span className="text-lg">{orders.length} Active Orders</span>
            </div>
            <div className={`flex items-center space-x-2 ${socket?.connected ? 'text-green-500' : 'text-red-500'}`}>
              <div className={`h-3 w-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span>{socket?.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        {/* New Orders Column */}
        <div>
          <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-4 mb-4">
            <h2 className="text-2xl font-bold text-yellow-400 flex items-center">
              <AlertCircle className="mr-2" />
              New Orders ({pendingOrders.length})
            </h2>
          </div>

          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-gray-800 rounded-lg border-2 ${selectedOrder === order.id ? 'border-yellow-500' : 'border-gray-700'
                  } shadow-lg hover:shadow-xl transition-all cursor-pointer`}
                onClick={() => setSelectedOrder(order.id)}
              >
                {/* Order Header */}
                <div className="bg-gray-700 p-4 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-yellow-400">
                        #{order.orderNumber}
                      </h3>
                      <p className="text-gray-300">{order.customerName || 'Walk-in'}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </div>
                      <div className="text-xl font-mono mt-2 text-orange-400">
                        {getElapsedTime(order.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4 space-y-2">
                  {order.orderItems.map((item) => (
                    <div key={item.id} className="bg-gray-700/50 p-3 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-lg font-semibold text-white">
                            {item.quantity}x {item.menuItem.name}
                          </span>
                          {item.notes && (
                            <p className="text-sm text-yellow-400 mt-1 font-semibold">
                              Note: {item.notes}
                            </p>
                          )}
                          {item.modifiers && (
                            <p className="text-sm text-gray-400 mt-1">
                              {JSON.stringify(item.modifiers)}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
                          {item.menuItem.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-700/50 rounded-b-lg flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(order.id, 'PREPARING');
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    Start Preparing
                  </button>
                </div>
              </div>
            ))}

            {pendingOrders.length === 0 && (
              <div className="bg-gray-800 rounded-lg border-2 border-gray-700 p-8 text-center">
                <p className="text-gray-400 text-lg">No new orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Preparing Orders Column */}
        <div>
          <div className="bg-orange-900/20 border-2 border-orange-600 rounded-lg p-4 mb-4">
            <h2 className="text-2xl font-bold text-orange-400 flex items-center">
              <Clock className="mr-2" />
              In Progress ({preparingOrders.length})
            </h2>
          </div>

          <div className="space-y-4">
            {preparingOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-gray-800 rounded-lg border-2 ${selectedOrder === order.id ? 'border-orange-500' : 'border-gray-700'
                  } shadow-lg hover:shadow-xl transition-all cursor-pointer`}
                onClick={() => setSelectedOrder(order.id)}
              >
                {/* Order Header */}
                <div className="bg-gray-700 p-4 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold text-orange-400">
                        #{order.orderNumber}
                      </h3>
                      <p className="text-gray-300">{order.customerName || 'Walk-in'}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </div>
                      <div className="text-xl font-mono mt-2 text-orange-400 font-bold">
                        {getElapsedTime(order.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4 space-y-2">
                  {order.orderItems.map((item) => (
                    <div key={item.id} className="bg-gray-700/50 p-3 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-lg font-semibold text-white">
                            {item.quantity}x {item.menuItem.name}
                          </span>
                          {item.notes && (
                            <p className="text-sm text-yellow-400 mt-1 font-semibold">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
                          {item.menuItem.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="p-4 bg-gray-700/50 rounded-b-lg flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(order.id, 'READY');
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <CheckCircle2 className="mr-2" />
                    Mark Ready
                  </button>
                </div>
              </div>
            ))}

            {preparingOrders.length === 0 && (
              <div className="bg-gray-800 rounded-lg border-2 border-gray-700 p-8 text-center">
                <p className="text-gray-400 text-lg">No orders in progress</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
