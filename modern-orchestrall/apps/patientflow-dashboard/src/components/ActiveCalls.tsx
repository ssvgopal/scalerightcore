// src/components/ActiveCalls.tsx - Active calls component
'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Clock } from 'lucide-react';
import { apiClient, ActiveCall } from '@/lib/api';

const statusColors = {
  INITIATED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  FAILED: 'bg-red-100 text-red-800',
};

const statusIcons = {
  INITIATED: Phone,
  IN_PROGRESS: Phone,
  COMPLETED: PhoneOff,
  FAILED: PhoneOff,
};

export default function ActiveCalls() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCalls();
    
    // Set up auto-refresh for active calls
    const interval = setInterval(() => {
      fetchActiveCalls();
    }, 5000); // Refresh every 5 seconds for calls

    return () => clearInterval(interval);
  }, []);

  const fetchActiveCalls = async () => {
    try {
      const response = await apiClient.getActiveCalls();
      setCalls(response.activeCalls);
    } catch (error) {
      console.error('Failed to fetch active calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDirectionIcon = (direction: 'INBOUND' | 'OUTBOUND') => {
    return direction === 'INBOUND' ? PhoneIncoming : PhoneOutgoing;
  };

  const getDirectionColor = (direction: 'INBOUND' | 'OUTBOUND') => {
    return direction === 'INBOUND' ? 'text-green-600' : 'text-blue-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Call Sessions</h2>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {calls.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <PhoneOff className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p>No active calls</p>
          </div>
        ) : (
          calls.map((call) => {
            const StatusIcon = statusIcons[call.status];
            const DirectionIcon = getDirectionIcon(call.direction);
            
            return (
              <div key={call.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`flex-shrink-0 p-2 rounded-full ${getDirectionColor(call.direction)} bg-opacity-10`}>
                        <DirectionIcon className={`h-5 w-5 ${getDirectionColor(call.direction)}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {call.patientName}
                        </p>
                        <p className="text-sm text-gray-500">{call.patientPhone}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Started {formatTime(call.startTime)}</span>
                      </div>
                      {call.duration !== undefined && (
                        <div className="flex items-center space-x-1">
                          <span>Duration: {formatDuration(call.duration)}</span>
                        </div>
                      )}
                    </div>
                    
                    {call.summary && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700 mb-1">Summary:</p>
                        <p className="text-sm text-gray-600 line-clamp-2">{call.summary}</p>
                      </div>
                    )}
                    
                    {call.transcript && (
                      <details className="mt-2">
                        <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                          View Transcript
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700 max-h-32 overflow-y-auto">
                          {call.transcript}
                        </div>
                      </details>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 ml-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[call.status]}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {call.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}