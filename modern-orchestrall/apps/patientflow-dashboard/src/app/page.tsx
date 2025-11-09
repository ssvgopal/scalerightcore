// src/app/page.tsx - Main dashboard page
'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Phone, 
  Calendar, 
  Users, 
  Activity,
  BarChart3,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, DashboardOverview } from '@/lib/api';
import MetricsCard from '@/components/MetricsCard';
import AppointmentsList from '@/components/AppointmentsList';
import LiveConversations from '@/components/LiveConversations';
import ActiveCalls from '@/components/ActiveCalls';

export default function Dashboard() {
  const { user, isAuthenticated, isLoading, loginWithDemo, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOverview();
      
      // Set up periodic refresh for overview
      const interval = setInterval(() => {
        fetchOverview();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      const data = await apiClient.getDashboardOverview();
      setOverview(data);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await loginWithDemo();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              PatientFlow Dashboard
            </h1>
            <p className="text-gray-600">
              Real-time clinic operations and patient communication hub
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Demo Access</h2>
            <p className="text-sm text-gray-600 mb-6">
              Experience the dashboard with demo data. No credentials required.
            </p>
            
            <button
              onClick={handleLogin}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Enter Dashboard Demo
            </button>
            
            <div className="mt-4 text-xs text-gray-500 text-center">
              This is a demo environment with simulated data
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <h1 className="text-xl font-semibold text-gray-900">PatientFlow</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">
              <BarChart3 className="mr-3 h-5 w-5" />
              Dashboard
            </a>
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md">
              <Calendar className="mr-3 h-5 w-5" />
              Appointments
            </a>
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md">
              <MessageCircle className="mr-3 h-5 w-5" />
              Messages
            </a>
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md">
              <Phone className="mr-3 h-5 w-5" />
              Calls
            </a>
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md">
              <Users className="mr-3 h-5 w-5" />
              Patients
            </a>
            <a href="#" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md">
              <Activity className="mr-3 h-5 w-5" />
              Activity Log
            </a>
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-6 w-6 text-gray-500" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-gray-600">Real-time view of your clinic operations</p>
          </div>

          {/* Metrics cards */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <MetricsCard
                title="Total Messages"
                value={overview?.metrics.totalMessages || 0}
                icon={MessageCircle}
                color="blue"
              />
              <MetricsCard
                title="Total Calls"
                value={overview?.metrics.totalCalls || 0}
                icon={Phone}
                color="green"
              />
              <MetricsCard
                title="Appointments"
                value={overview?.metrics.totalAppointments || 0}
                icon={Calendar}
                color="purple"
              />
              <MetricsCard
                title="Active Conversations"
                value={overview?.metrics.activeConversations || 0}
                icon={Users}
                color="yellow"
              />
              <MetricsCard
                title="Upcoming"
                value={overview?.metrics.upcomingAppointments || 0}
                icon={Calendar}
                color="red"
              />
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <LiveConversations />
              <ActiveCalls />
            </div>
            <div>
              <AppointmentsList />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}