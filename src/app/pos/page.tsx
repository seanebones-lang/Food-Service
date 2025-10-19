'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  CreditCard, 
  Receipt, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
  modifiers?: Modifier[];
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  isRequired: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: Modifier[];
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  channel: 'IN_PERSON' | 'ONLINE';
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function POSTerminal() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    channel: 'IN_PERSON' as const
  });
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CARD');
  const [cashReceived, setCashReceived] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const queryClient = useQueryClient();

  // Fetch menu items
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/menu`);
      if (!response.ok) throw new Error('Failed to fetch menu');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Fetch recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.data || [];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Socket.io for real-time updates
  useEffect(() => {
    const socket = io(API_URL);
    
    socket.on('new-order', (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    socket.on('order-status-update', (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    return () => socket.disconnect();
  }, [queryClient]);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      setCart([]);
      setCustomerInfo({ name: '', phone: '', email: '', channel: 'IN_PERSON' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch(`${API_URL}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      if (!response.ok) throw new Error('Failed to process payment');
      return response.json();
    },
    onSuccess: () => {
      setIsProcessingPayment(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const addToCart = (menuItem: MenuItem) => {
    const existingItem = cart.find(item => 
      item.menuItem.id === menuItem.id && 
      JSON.stringify(item.selectedModifiers) === JSON.stringify([])
    );

    if (existingItem) {
      setCart(cart.map(item =>
        item.menuItem.id === menuItem.id && 
        JSON.stringify(item.selectedModifiers) === JSON.stringify([])
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        menuItem,
        quantity: 1,
        selectedModifiers: [],
        notes: ''
      }]);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(cart.map((item, i) => 
      i === index ? { ...item, quantity } : item
    ));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.menuItem.price;
      const modifierPrice = item.selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
      return total + (itemPrice + modifierPrice) * item.quantity;
    }, 0);
  };

  const getTax = () => {
    return getTotalPrice() * 0.08; // 8% tax
  };

  const getFinalTotal = () => {
    return getTotalPrice() + getTax();
  };

  const handleProcessOrder = async () => {
    if (cart.length === 0) return;

    const orderItems = cart.map(item => ({
      menuItemId: item.menuItem.id,
      quantity: item.quantity,
      modifiers: item.selectedModifiers.map(mod => ({
        id: mod.id,
        name: mod.name,
        price: mod.price
      })),
      notes: item.notes
    }));

    const orderResult = await createOrderMutation.mutateAsync({
      orderItems,
      customerName: customerInfo.name || 'Walk-in Customer',
      customerPhone: customerInfo.phone,
      customerEmail: customerInfo.email,
      channel: customerInfo.channel,
      syncToSquare: true
    });

    // Process payment
    setIsProcessingPayment(true);
    await processPaymentMutation.mutateAsync({
      orderId: orderResult.data.id,
      amount: getFinalTotal(),
      method: paymentMethod,
      // For card payments, you would integrate with Square's payment processing
      // For now, we'll simulate a successful payment
      sourceId: paymentMethod === 'CARD' ? 'simulated_card_token' : undefined,
      idempotencyKey: `pos_${Date.now()}_${Math.random()}`
    });
  };

  const categories = ['all', ...new Set(menuItems.map(item => item.category))];
  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'CONFIRMED': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'PREPARING': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'READY': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
              <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                Staff Interface
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <Users className="h-4 w-4 inline mr-1" />
                Active Orders: {recentOrders.filter((o: Order) => ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status)).length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={!item.isAvailable}
                  className={`p-4 rounded-lg text-left transition-all ${
                    item.isAvailable
                      ? 'bg-white hover:shadow-md hover:scale-105'
                      : 'bg-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                    <p className="text-green-600 font-bold">${item.price.toFixed(2)}</p>
                  </div>
                  {!item.isAvailable && (
                    <p className="text-red-500 text-xs">Out of Stock</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cart & Checkout Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Current Order
              </h2>
              
              {/* Cart Items */}
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in cart</p>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.menuItem.name}</h4>
                        <p className="text-xs text-gray-600">${item.menuItem.price.toFixed(2)} each</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer Info */}
              <div className="space-y-3 mb-6">
                <h3 className="font-medium">Customer Information</h3>
                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone Number (Optional)"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <h3 className="font-medium mb-3">Payment Method</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPaymentMethod('CARD')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      paymentMethod === 'CARD'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    Card
                  </button>
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      paymentMethod === 'CASH'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (8%):</span>
                  <span>${getTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${getFinalTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Process Order Button */}
              <button
                onClick={handleProcessOrder}
                disabled={cart.length === 0 || isProcessingPayment}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  cart.length === 0 || isProcessingPayment
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isProcessingPayment ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Receipt className="h-5 w-5" />
                    <span>Process Order</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentOrders.slice(0, 6).map((order: Order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">#{order.orderNumber}</span>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(order.status)}
                    <span className="text-sm text-gray-600">{order.status}</span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  <p>{order.customerName || 'Walk-in Customer'}</p>
                  <p>{order.items.length} item(s)</p>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-green-600">
                    ${order.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
