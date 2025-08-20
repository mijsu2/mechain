import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, AlertCircle } from "lucide-react";

export default function ModelPerformance({ models, isApiMode }) {
  const activeModels = models.filter(m => m.is_active);
  const isDefaultApiActive = isApiMode && activeModels.length === 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          ML Model Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeModels.length === 0 && !isDefaultApiActive ? (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No active models found</p>
            <p className="text-sm text-gray-400">Activate models in ML Model Management</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isDefaultApiActive && (
              <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Default InvokeLLM API</h4>
                    <p className="text-sm text-gray-600">Built-in AI model service</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    API Active
                  </Badge>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Status:</strong> The system is using the default external AI service for predictions.
                  </p>
                </div>
              </div>
            )}

            {activeModels.map((model, index) => (
              <div key={model.id} className="p-4 border rounded-lg bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{model.model_name}</h4>
                    <p className="text-sm text-gray-600">Version {model.version}</p>
                  </div>
                  <Badge className={`${model.model_file_url ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                    {model.model_file_url ? 'Local Active' : 'API Active'}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Accuracy</span>
                    <span className="font-medium">{model.accuracy}%</span>
                  </div>
                  <Progress value={model.accuracy} className="h-2" />
                </div>

                {model.performance_metrics && (
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Precision</p>
                      <p className="font-semibold text-sm">
                        {(model.performance_metrics.precision * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Recall</p>
                      <p className="font-semibold text-sm">
                        {(model.performance_metrics.recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">F1 Score</p>
                      <p className="font-semibold text-sm">
                        {(model.performance_metrics.f1_score * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}