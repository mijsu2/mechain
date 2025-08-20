
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Heart, Eye, AlertTriangle, CheckCircle, Clock, Brain, Stethoscope, FileText, Camera } from "lucide-react";

const RiskBadge = ({ riskLevel }) => {
  const riskStyles = {
    low: "bg-green-100 text-green-800 border-green-200",
    moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    critical: "bg-red-100 text-red-800 border-red-200",
    unknown: "bg-gray-100 text-gray-800 border-gray-200",
  };
  const style = riskStyles[riskLevel?.toLowerCase()] || riskStyles.unknown;
  return <Badge className={`capitalize ${style}`}>{riskLevel || 'Unknown'}</Badge>;
};

export default function RecentDiagnoses({ diagnoses }) {
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'follow_up_required': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleViewDetails = (diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    setIsDetailModalOpen(true);
  };

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
  
  const aiChartData = selectedDiagnosis?.ai_prediction ? [
    { name: 'Risk Score', value: selectedDiagnosis.ai_prediction.risk_score || 0, fill: '#f97316' },
    { name: 'Confidence', value: selectedDiagnosis.ai_prediction.confidence || 0, fill: '#3b82f6' },
  ] : [];

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Recent Diagnoses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnoses.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No diagnoses yet</p>
                <p className="text-sm text-gray-400">Your recent patient diagnoses will appear here</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto pr-2 space-y-4">
                {diagnoses.slice(0, 10).map((diagnosis) => (
                  <div key={diagnosis.id} className="p-4 border rounded-lg hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(diagnosis.status)}
                        <span className="font-medium text-gray-900">
                          Patient ID: {diagnosis.patient_id.slice(-8)}...
                        </span>
                      </div>
                      {diagnosis.ai_prediction?.risk_level && (
                        <RiskBadge riskLevel={diagnosis.ai_prediction.risk_level} />
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Symptoms:</span>
                        <span className="text-sm text-gray-900">
                          {diagnosis.symptoms?.slice(0, 2).map(s => s.symptom).join(', ')}
                          {diagnosis.symptoms?.length > 2 && ` +${diagnosis.symptoms.length - 2} more`}
                        </span>
                      </div>

                      {diagnosis.ai_prediction?.confidence && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">AI Confidence:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {diagnosis.ai_prediction.confidence}%
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-gray-500">
                          {formatTimeForPhilippines(diagnosis.created_date)}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(diagnosis)}>
                          <Eye className="w-3 h-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Diagnosis Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Diagnosis Details: {selectedDiagnosis && new Date(selectedDiagnosis.created_date).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full' })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-4 space-y-6">
            {selectedDiagnosis?.ai_prediction && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Brain className="text-blue-500"/>AI Clinical Analysis</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <strong>AI Risk Level:</strong>
                        <RiskBadge riskLevel={selectedDiagnosis.ai_prediction.risk_level}/>
                     </div>
                     <div>
                        <h4 className="font-semibold mb-2">Predicted Conditions:</h4>
                        <div className="space-y-1">
                          {selectedDiagnosis.ai_prediction.predicted_conditions?.map((condition, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span>{condition.condition}</span>
                              <Badge variant="outline" className="text-xs">{condition.severity}</Badge>
                            </div>
                          ))}
                        </div>
                     </div>
                  </div>
                  <div className="h-64">
                    <h4 className="font-semibold mb-2">AI Confidence Metrics</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <RechartsTooltip formatter={(value) => [`${value}%`, 'Score']} />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedDiagnosis?.symptoms && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Stethoscope className="text-green-500"/>Symptoms & Vitals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Symptoms:</h4>
                      <div className="space-y-2">
                        {selectedDiagnosis.symptoms.map((symptom, i) => (
                          <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                            <div className="font-medium">{symptom.symptom}</div>
                            <div className="text-gray-600">Severity: {symptom.severity} | Duration: {symptom.duration}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedDiagnosis.vital_signs && (
                      <div>
                        <h4 className="font-semibold mb-2">Vital Signs:</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(selectedDiagnosis.vital_signs).filter(([_, value]) => value).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="capitalize">{key.replace('_', ' ')}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedDiagnosis?.diagnosis_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText className="text-purple-500"/>Doctor's Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Clinical Diagnosis:</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedDiagnosis.diagnosis_notes}</p>
                    </div>
                    {selectedDiagnosis.treatment_plan && (
                      <div>
                        <h4 className="font-semibold mb-2">Treatment Plan:</h4>
                        <p className="text-gray-700 whitespace-pre-wrap">{selectedDiagnosis.treatment_plan}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedDiagnosis?.medical_images && selectedDiagnosis.medical_images.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Camera className="text-indigo-500"/>Medical Images</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedDiagnosis.medical_images.map((image, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{image.image_type}</Badge>
                        </div>
                        <img src={image.image_url} alt={`Medical ${image.image_type}`} className="w-full h-32 object-cover rounded" />
                        {image.analysis_notes && (
                          <p className="text-sm text-gray-600 mt-2">{image.analysis_notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
