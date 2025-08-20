import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Users, Brain, Upload } from "lucide-react";

export default function RecentActivity({ diagnoses, doctors = [] }) {
  const activities = [
    ...diagnoses.slice(0, 6).map(diagnosis => ({
      type: 'diagnosis',
      title: 'New diagnosis completed',
      description: `Patient analysis with ${diagnosis.ai_prediction?.risk_level || 'unknown'} risk level`,
      time: diagnosis.created_date,
      icon: Heart,
      color: 'text-red-500'
    })),
    ...doctors.slice(0, 3).map(doctor => ({
      type: 'user',
      title: 'Doctor account accessed',
      description: `Dr. ${doctor.full_name} logged in`,
      time: doctor.updated_date,
      icon: Users,
      color: 'text-blue-500'
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  const formatTimeForPhilippines = (timestamp) => {
    try {
      // Create a date object, assuming the timestamp from DB is UTC.
      // Appending 'Z' tells the Date constructor to parse it as UTC.
      const eventTime = new Date(timestamp + 'Z');
      const now = new Date(); // This is in user's local time

      // getTime() returns UTC milliseconds since epoch for both, so the difference is timezone-agnostic.
      const diffInMs = now.getTime() - eventTime.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 2) {
        return 'just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes} minutes ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
      } else {
        return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
      }
    } catch (error) {
      return 'recently';
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No recent activity</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-full bg-gray-100 ${activity.color}`}>
                  <activity.icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTimeForPhilippines(activity.time)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}