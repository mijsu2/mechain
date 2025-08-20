import React, { useState, useEffect } from "react";
import { Diagnosis } from "@/api/entities";
import { User } from "@/api/entities";
import { MLModel } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, User as UserIcon, Brain, Heart } from "lucide-react";

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const [diagnoses, users, models] = await Promise.all([
        Diagnosis.list('-created_date', 50),
        User.list('-updated_date', 50),
        MLModel.list('-updated_date', 50)
      ]);

      const diagnosisLogs = diagnoses.map(d => ({
        type: "Diagnosis",
        icon: Heart,
        color: "text-red-500 bg-red-50",
        title: `New Diagnosis Created`,
        description: `Patient ${d.patient_id} analyzed with ${d.ai_prediction?.risk_level || 'N/A'} risk.`,
        timestamp: d.created_date,
      }));

      const userLogs = users.map(u => ({
        type: "User",
        icon: UserIcon,
        color: "text-blue-500 bg-blue-50",
        title: `${u.role === 'admin' ? 'Admin' : 'Doctor'} Activity`,
        description: `${u.full_name} account was updated or accessed.`,
        timestamp: u.updated_date,
      }));
      
      const modelLogs = models.map(m => ({
        type: "Model",
        icon: Brain,
        color: "text-purple-500 bg-purple-50",
        title: `Model Updated`,
        description: `Model ${m.model_name} v${m.version} was updated.`,
        timestamp: m.updated_date,
      }));

      const combinedLogs = [...diagnosisLogs, ...userLogs, ...modelLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100);

      setLogs(combinedLogs);
    } catch (error) {
      console.error("Error loading logs:", error);
    }
    setIsLoading(false);
  };

  const formatTimeForPhilippines = (timestamp) => {
    try {
      const eventTime = new Date(timestamp + 'Z');
      const now = new Date();
      const diffInMs = now.getTime() - eventTime.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 2) return 'just now';
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    } catch (error) {
      return 'recently';
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">System Activity Logs</h1>
      <Card className="shadow-lg border-0">
        <CardContent className="pt-6">
          <div className="relative pl-8">
            {/* Timeline Line */}
            <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-4 mb-8">
                <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center ${log.color}`}>
                  <log.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-800">{log.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatTimeForPhilippines(log.timestamp)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">{log.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}