import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../config';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: Config.API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.token) {
          this.token = await AsyncStorage.getItem('authToken');
        }

        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear storage and redirect to login
          await AsyncStorage.removeItem('authToken');
          this.token = null;
          // Navigation will be handled by the app
        }

        return Promise.reject(error);
      }
    );
  }

  async setToken(token: string) {
    this.token = token;
    await AsyncStorage.setItem('authToken', token);
  }

  async clearToken() {
    this.token = null;
    await AsyncStorage.removeItem('authToken');
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout() {
    await this.clearToken();
  }

  // Menu endpoints
  async getMenuItems() {
    const response = await this.client.get('/api/menu');
    return response.data;
  }

  async getMenuItem(id: string) {
    const response = await this.client.get(`/api/menu/${id}`);
    return response.data;
  }

  // Order endpoints
  async getOrders(params?: { status?: string; limit?: number }) {
    const response = await this.client.get('/api/orders', { params });
    return response.data;
  }

  async getOrder(id: string) {
    const response = await this.client.get(`/api/orders/${id}`);
    return response.data;
  }

  async createOrder(orderData: {
    orderItems: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: any[];
      notes?: string;
    }>;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    channel: string;
    syncToSquare?: boolean;
  }) {
    const response = await this.client.post('/api/orders', orderData);
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const response = await this.client.patch(
      `/api/orders/${orderId}/status`,
      { status }
    );
    return response.data;
  }

  // Payment endpoints
  async createPayment(paymentData: {
    orderId: string;
    amount: number;
    method: string;
    sourceId?: string;
    idempotencyKey: string;
  }) {
    const response = await this.client.post('/api/payments', paymentData);
    return response.data;
  }

  // Inventory endpoints
  async getInventory() {
    const response = await this.client.get('/api/inventory');
    return response.data;
  }

  async updateInventoryStock(
    itemId: string,
    quantity: number,
    operation: 'add' | 'subtract' | 'set'
  ) {
    const response = await this.client.patch(
      `/api/inventory/${itemId}/stock`,
      { quantity, operation }
    );
    return response.data;
  }

  // Analytics endpoints
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    metric?: string;
  }) {
    const response = await this.client.get('/api/analytics', { params });
    return response.data;
  }
}

export const api = new ApiService();
