// src/components/LiveConversations.tsx - Live conversations component
'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Phone, MessageSquare, Mail, RefreshCw } from 'lucide-react';
import { apiClient, LiveConversation } from '@/lib/api';

const channelIcons = {
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
  EMAIL: Mail,
  CALL: Phone,
};

const channelColors = {
  WHATSAPP: 'text-green-600 bg-green-100',
  SMS: 'text-blue-600 bg-blue-100',
  EMAIL: 'text-purple-600 bg-purple-100',
  CALL: 'text-orange-600 bg-orange-100',
};

export default function LiveConversations() {
  const [conversations, setConversations] = useState<LiveConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchConversations();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchConversations();
    }, parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '10000'));

    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      setIsRefreshing(true);
      const response = await apiClient.getLiveConversations(
        lastRefresh.toISOString(),
        20
      );
      setConversations(response.conversations);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const getDirectionIcon = (direction: 'INBOUND' | 'OUTBOUND') => {
    return direction === 'INBOUND' ? '↓' : '↑';
  };

  const getDirectionColor = (direction: 'INBOUND' | 'OUTBOUND') => {
    return direction === 'INBOUND' ? 'text-green-600' : 'text-blue-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
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
          <h2 className="text-lg font-semibold text-gray-900">Live Conversations</h2>
          <button
            onClick={fetchConversations}
            disabled={isRefreshing}
            className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recent conversations
          </div>
        ) : (
          conversations.map((conversation) => {
            const Icon = channelIcons[conversation.channel];
            return (
              <div key={conversation.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 p-2 rounded-full ${channelColors[conversation.channel]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conversation.patientName}
                      </p>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs ${getDirectionColor(conversation.direction)}`}>
                          {getDirectionIcon(conversation.direction)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(conversation.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.patientPhone}
                    </p>
                    
                    <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                      {conversation.content}
                    </p>
                    
                    <div className="mt-2 flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${channelColors[conversation.channel]}`}>
                        {conversation.channel}
                      </span>
                      {conversation.metadata && Object.keys(conversation.metadata).length > 0 && (
                        <span className="text-xs text-gray-400">
                          Has metadata
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Auto-refreshes every {parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '10000') / 1000} seconds
        </p>
      </div>
    </div>
  );
}