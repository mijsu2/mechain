
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MLModel } from "@/api/entities";
import { Brain, TrendingUp, Target, Zap } from "lucide-react";

export default function AIInsights({ diagnoses }) {
  const [activeModel, setActiveModel] = useState(null);

  useEffect(() => {
    const fetchActiveModel = async () => {
      // In a real application, consider adding error handling and loading states
      try {
        const models = await MLModel.filter({ is_active: true, model_type: "heart_disease" });
        if (models.length > 0) {
          setActiveModel(models[0]);
        } else {
          // Handle case where no active model is found
          console.warn("No active ML model found for heart_disease.");
        }
      } catch (error) {
        console.error("Failed to fetch active ML model:", error);
      }
    };
    fetchActiveModel();
  }, []);

  const aiStats = {
    totalPredictions: diagnoses.length,
    avgConfidence: diagnoses.length > 0 ? diagnoses.reduce((acc, d) => acc + (d.ai_prediction?.confidence || 0), 0) / diagnoses.length : 0,
    commonConditions: {}
  };

  // Analyze common predicted conditions
  diagnoses.forEach(diagnosis => {
    diagnosis.ai_prediction?.predicted_conditions?.forEach(condition => {
      aiStats.commonConditions[condition] = (aiStats.commonConditions[condition] || 0) + 1;
    });
  });

  const topConditions = Object.entries(aiStats.commonConditions)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4);

  const insights = [
    {
      title: "Model Accuracy",
      value: activeModel ? `${activeModel.accuracy}%` : "N/A",
      icon: Target,
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: "Avg Confidence",
      value: `${aiStats.avgConfidence.toFixed(1)}%`,
      icon: Brain,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "F1 Score",
      value: activeModel ? `${(activeModel.performance_metrics?.f1_score * 100).toFixed(1)}%` : "N/A",
      icon: Zap,
      color: "text-purple-600",
      bg: "bg-purple-50"
    }
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          AI Model Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            {insights.map((insight, index) => (
              <div key={index} className={`p-3 rounded-lg ${insight.bg}`}>
                <div className="flex items-center justify-center mb-2">
                  <insight.icon className={`w-5 h-5 ${insight.color}`} />
                </div>
                <p className="text-center text-sm font-medium text-gray-700">{insight.title}</p>
                <p className={`text-center text-lg font-bold ${insight.color}`}>{insight.value}</p>
              </div>
            ))}
          </div>

          {/* Common Conditions */}
          {topConditions.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Most Detected Conditions
              </h4>
              <div className="space-y-2">
                {topConditions.map(([condition, count], index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {condition.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      {count} cases
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Indicator */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium text-gray-900">Model Status</span>
            </div>
            <p className="text-sm text-gray-600">
              AI model is performing optimally with high accuracy and confidence levels
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
