// src/components/MetricsCard.tsx - Metrics card component
'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

const bgColorClasses = {
  blue: 'bg-blue-50',
  green: 'bg-green-50',
  yellow: 'bg-yellow-50',
  red: 'bg-red-50',
  purple: 'bg-purple-50',
};

const textColorClasses = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
};

export default function MetricsCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  color = 'blue' 
}: MetricsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${
              change.type === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}>
              {change.type === 'increase' ? '↑' : '↓'} {Math.abs(change.value)}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${bgColorClasses[color]}`}>
          <Icon className={`h-6 w-6 ${textColorClasses[color]}`} />
        </div>
      </div>
    </div>
  );
}