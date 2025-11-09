// src/lib/api.ts - API utility functions for PatientFlow Dashboard
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types for API responses
export interface DashboardMetrics {
  totalMessages: number;
  totalCalls: number;
  totalAppointments: number;
  activeConversations: number;
  upcomingAppointments: number;
}

export interface RecentMessage {
  id: string;
  patientName: string;
  patientPhone: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'CALL';
  timestamp: string;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  recentMessages: RecentMessage[];
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorSpecialization: string;
  status: 'BOOKED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  source: 'WEBSITE' | 'PHONE' | 'WHATSAPP' | 'REFERRAL';
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string;
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ActiveCall {
  id: string;
  patientName: string;
  patientPhone: string;
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  direction: 'INBOUND' | 'OUTBOUND';
  duration?: number;
  startTime: string;
  summary?: string;
  transcript?: string;
}

export interface ActiveCallsResponse {
  activeCalls: ActiveCall[];
}

export interface Activity {
  id: string;
  type: 'message' | 'call';
  patientName: string;
  patientPhone: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  content?: string;
  status?: string;
  duration?: number;
  summary?: string;
  channel?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'CALL';
  timestamp: string;
}

export interface ActivitiesResponse {
  activities: Activity[];
}

export interface LiveConversation {
  id: string;
  patientName: string;
  patientPhone: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'CALL';
  timestamp: string;
  metadata?: any;
}

export interface LiveConversationsResponse {
  conversations: LiveConversation[];
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        } else if (process.env.NEXT_PUBLIC_API_DEMO_KEY) {
          config.headers['X-API-Key'] = process.env.NEXT_PUBLIC_API_DEMO_KEY;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear it
          this.token = null;
          // Could trigger re-login here
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response: AxiosResponse<{ data: { accessToken: string; refreshToken: string } }> = 
        await this.client.post('/auth/login', { email, password });
      
      this.token = response.data.data.accessToken;
      return response.data.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async loginWithDemoKey(): Promise<void> {
    // For demo purposes, we'll use the demo key
    // In production, this would be proper authentication
    this.token = 'demo-token';
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // Dashboard API methods
  async getDashboardOverview(startDate?: string, endDate?: string): Promise<DashboardOverview> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response: AxiosResponse<DashboardOverview> = await this.client.get(
      `/patientflow/api/dashboard/overview?${params.toString()}`
    );
    return response.data;
  }

  async getAppointments(filters?: {
    status?: string;
    doctorId?: string;
    page?: number;
    limit?: number;
  }): Promise<AppointmentsResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.doctorId) params.append('doctorId', filters.doctorId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response: AxiosResponse<AppointmentsResponse> = await this.client.get(
      `/patientflow/api/dashboard/appointments?${params.toString()}`
    );
    return response.data;
  }

  async getActiveCalls(): Promise<ActiveCallsResponse> {
    const response: AxiosResponse<ActiveCallsResponse> = await this.client.get(
      '/patientflow/api/dashboard/calls/active'
    );
    return response.data;
  }

  async getRecentActivities(limit: number = 50): Promise<ActivitiesResponse> {
    const response: AxiosResponse<ActivitiesResponse> = await this.client.get(
      `/patientflow/api/dashboard/activities?limit=${limit}`
    );
    return response.data;
  }

  async getLiveConversations(since?: string, limit: number = 20): Promise<LiveConversationsResponse> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    params.append('limit', limit.toString());

    const response: AxiosResponse<LiveConversationsResponse> = await this.client.get(
      `/patientflow/api/dashboard/conversations/live?${params.toString()}`
    );
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response: AxiosResponse<{ status: string }> = await this.client.get('/health');
    return response.data;
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export convenience functions
export const {
  login,
  loginWithDemoKey,
  setToken,
  clearToken,
  getDashboardOverview,
  getAppointments,
  getActiveCalls,
  getRecentActivities,
  getLiveConversations,
  healthCheck,
} = apiClient;