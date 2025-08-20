
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Patient } from "@/api/entities";
import { Diagnosis } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  ArrowLeft, User, Cake, Droplets, Phone, Shield, Heart, Stethoscope, Brain, FileText,
  Camera, AlertTriangle, Pencil, Loader2, PlusCircle, Tag, ClipboardList, Search, Calendar, Image as ImageIcon
} from "lucide-react";
import { createPageUrl } from "@/utils";

const InfoItem = ({ icon: Icon, label, value, className = "" }) => (
  <div className={`flex items-start gap-3 ${className}`}>
    <Icon className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-base text-gray-800 font-semibold">{value || "N/A"}</p>
    </div>
  </div>
);

const RiskBadge = ({ riskLevel }) => {
  const riskInfo = {
    low: { style: "bg-green-100 text-green-800 border-green-200", description: "Low risk of adverse events. Standard monitoring recommended." },
    moderate: { style: "bg-yellow-100 text-yellow-800 border-yellow-200", description: "Moderate risk. Requires close monitoring and possible intervention." },
    high: { style: "bg-orange-100 text-orange-800 border-orange-200", description: "High risk of complications. Proactive management is necessary." },
    critical: { style: "bg-red-100 text-red-800 border-red-200", description: "Critical risk. Immediate medical attention is required." },
    unknown: { style: "bg-gray-100 text-gray-800 border-gray-200", description: "Risk level could not be determined." },
  };
  const info = riskInfo[riskLevel?.toLowerCase()] || riskInfo.unknown;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className={`capitalize ${info.style}`}>{riskLevel || 'Unknown'}</Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{info.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function PatientDetails() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [diagnoses, setDiagnoses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const patientId = useMemo(() => new URLSearchParams(window.location.search).get("id"), []);

  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    } else {
      setIsLoading(false);
    }
  }, [patientId]);

  const loadPatientData = async (id) => {
    setIsLoading(true);
    try {
      const [patientData, diagnosesData] = await Promise.all([
        Patient.get(id),
        Diagnosis.filter({ patient_id: id }, "-created_date"),
      ]);
      setPatient(patientData);
      setDiagnoses(diagnosesData);
    } catch (error) {
      console.error("Error loading patient data:", error);
    }
    setIsLoading(false);
  };

  const filteredDiagnoses = useMemo(() => {
    return diagnoses.filter(dx => {
      const searchTermLower = searchTerm.toLowerCase();
      const severityMatch = filterSeverity === 'all' || dx.ai_prediction?.risk_level?.toLowerCase() === filterSeverity;
      
      const searchMatch = !searchTerm ||
        (dx.symptoms || []).some(s => s.symptom.toLowerCase().includes(searchTermLower)) ||
        (dx.diagnosis_notes || '').toLowerCase().includes(searchTermLower) ||
        (dx.ai_prediction?.predicted_conditions || []).some(c => c.condition.toLowerCase().includes(searchTermLower));
        
      return severityMatch && searchMatch;
    });
  }, [diagnoses, searchTerm, filterSeverity]);

  const handleDiagnosisClick = (diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    setIsModalOpen(true);
  };

  const DiagnosisModal = ({ diagnosis, onClose }) => {
    if (!diagnosis) return null;
    const aiChartData = diagnosis.ai_prediction ? [
      { name: 'Risk Score', value: diagnosis.ai_prediction.risk_score || 0, fill: '#f97316' },
      { name: 'Confidence', value: diagnosis.ai_prediction.confidence || 0, fill: '#3b82f6' },
    ] : [];

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Diagnosis Details: {new Date(diagnosis.created_date).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto pr-4 space-y-6">
            {diagnosis.ai_prediction && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Brain className="text-blue-500"/>AI Clinical Analysis</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <strong>AI Risk Level:</strong>
                        <RiskBadge riskLevel={diagnosis.ai_prediction.risk_level}/>
                     </div>
                     <div>
                        <h4 className="font-semibold mb-2">Predicted Conditions:</h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {(diagnosis.ai_prediction.predicted_conditions || []).map((c, i) => (
                            <li key={i}>{c.condition} <span className="text-gray-500 capitalize">({c.severity})</span></li>
                          ))}
                        </ul>
                     </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">AI Scores</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={aiChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="value" />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
                   <div className="md:col-span-2">
                        <h4 className="font-semibold mb-2">AI Recommendations:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h5 className="font-medium mb-1">Lifestyle</h5>
                                <ul className="list-disc list-inside">{(diagnosis.ai_prediction.recommendations?.lifestyle || []).map((r,i) => <li key={i}>{r}</li>)}</ul>
                            </div>
                             <div className="p-3 bg-gray-50 rounded-lg">
                                <h5 className="font-medium mb-1">Medications</h5>
                                <ul className="list-disc list-inside">{(diagnosis.ai_prediction.recommendations?.medications || []).map((r,i) => <li key={i}>{r}</li>)}</ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
              </Card>
            )}

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="text-green-500"/>Symptoms & Notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Reported Symptoms</h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {(diagnosis.symptoms || []).map((s, i) => (
                            <li key={i}>{s.symptom} <span className="text-gray-500 capitalize">({s.severity}, {s.duration})</span></li>
                          ))}
                        </ul>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2">Doctor's Final Diagnosis & Notes</h4>
                        <p className="text-sm p-3 bg-gray-50 rounded-lg whitespace-pre-wrap">{diagnosis.diagnosis_notes || "No notes provided."}</p>
                    </div>
                </CardContent>
            </Card>

            {diagnosis.medical_images && diagnosis.medical_images.length > 0 && (
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="text-purple-500"/>Attached Documents</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {diagnosis.medical_images.map((img, i) => (
                         <a key={i} href={img.image_url} target="_blank" rel="noopener noreferrer" className="block border rounded-lg overflow-hidden group">
                           <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                <img src={img.image_url} alt={img.image_type} className="w-full h-full object-cover"/>
                           </div>
                           <div className="p-2 bg-gray-50">
                             <p className="text-sm font-medium truncate group-hover:text-blue-600 capitalize">{img.image_type.replace('_', ' ')}</p>
                           </div>
                         </a>
                      ))}
                    </CardContent>
                </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }; // End of DiagnosisModal component
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold">Patient Not Found</h2>
        <p className="mt-2 text-gray-500">The requested patient could not be found.</p>
        <Button onClick={() => navigate(createPageUrl("PatientRecords"))} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Patient Records
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("PatientRecords"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Patient Profile: <span className="text-blue-600">{patient.full_name}</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sticky Column */}
          <div className="lg:col-span-4 xl:col-span-3 lg:sticky top-8">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gray-50/70 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <User className="w-6 h-6 text-blue-600" />
                  Patient Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <InfoItem icon={User} label="Full Name" value={patient.full_name} />
                <InfoItem icon={Cake} label="Age" value={patient.age} />
                <InfoItem icon={User} label="Gender" value={patient.gender} className="capitalize" />
                <InfoItem icon={Droplets} label="Blood Type" value={patient.blood_type} />
                <InfoItem icon={Phone} label="Contact" value={patient.phone} />
                <InfoItem icon={Shield} label="Emergency Contact" value={patient.emergency_contact} />
              </CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="allergies">
                  <AccordionTrigger className="px-6 py-4 text-base font-semibold">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" /> Known Allergies
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    {(patient.allergies && patient.allergies.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.allergies.map((allergy, index) => (
                          <Badge key={index} variant="destructive">{allergy}</Badge>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-500">No known allergies recorded.</p>}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="history">
                  <AccordionTrigger className="px-6 py-4 text-base font-semibold">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-purple-500" /> Medical History
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    {(patient.medical_history && patient.medical_history.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.medical_history.map((condition, index) => (
                          <Badge key={index} className="bg-purple-100 text-purple-800">{condition}</Badge>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-500">No medical history recorded.</p>}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>

          {/* Right Scrollable Column */}
          <div className="lg:col-span-8 xl:col-span-9">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <Heart className="w-6 h-6 text-red-500" />
                      Diagnosis Timeline
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"/>
                            <Input 
                                placeholder="Search diagnoses..." 
                                className="pl-9 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredDiagnoses.length > 0 ? (
                  filteredDiagnoses.map((dx) => (
                    <div
                      key={dx.id}
                      className="border rounded-lg p-4 hover:bg-slate-100/70 cursor-pointer transition-colors"
                      onClick={() => handleDiagnosisClick(dx)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800 flex items-center gap-2">
                             <Calendar className="w-4 h-4 text-gray-500" />
                             Diagnosis on {new Date(dx.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            <strong className="text-gray-700">Symptoms:</strong> {(dx.symptoms.map(s => s.symptom).join(', ') || 'N/A')}
                          </p>
                        </div>
                        <div className="text-right">
                          <RiskBadge riskLevel={dx.ai_prediction?.risk_level} />
                          <p className="text-xs text-gray-500 mt-1">Click to view details</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                     <p className="text-gray-500">No diagnoses found matching your criteria.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Diagnosis Details Modal */}
      {isModalOpen && (
        <DiagnosisModal
          diagnosis={selectedDiagnosis}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
