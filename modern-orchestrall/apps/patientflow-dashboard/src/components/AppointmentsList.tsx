// src/components/AppointmentsList.tsx - Appointments list component
'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Filter } from 'lucide-react';
import { apiClient, Appointment } from '@/lib/api';

const statusColors = {
  BOOKED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAppointments();
  }, [filter, page]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAppointments({
        status: filter === 'all' ? undefined : filter,
        page,
        limit: 10,
      });
      setAppointments(response.appointments);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
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
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="BOOKED">Booked</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {appointments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No appointments found
          </div>
        ) : (
          appointments.map((appointment) => {
            const { date, time } = formatDateTime(appointment.scheduledStart);
            return (
              <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {appointment.patientName}
                        </p>
                        <p className="text-sm text-gray-500">{appointment.patientPhone}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{time}</span>
                      </div>
                      <div>
                        <span className="font-medium">Dr. {appointment.doctorName}</span>
                        {appointment.doctorSpecialization && (
                          <span className="text-gray-400">
                            {' • '}{appointment.doctorSpecialization}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {appointment.notes && (
                      <p className="mt-2 text-sm text-gray-600">{appointment.notes}</p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 ml-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[appointment.status]}`}>
                      {appointment.status}
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