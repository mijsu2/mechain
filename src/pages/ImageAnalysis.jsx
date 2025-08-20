
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { getAIAnalysis } from "@/components/utils/inference"; // Changed path
import { Patient } from "@/api/entities";
import { Diagnosis } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload, FileText, Brain, Loader2, AlertTriangle, CheckCircle, ArrowLeft, Camera, Heart, User as UserIcon, Activity, Stethoscope, Pill, Settings } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"; // Added DialogTrigger

// Enhanced OCR schema for comprehensive medical document analysis
const medicalOCRSchema = {
  type: "object",
  properties: {
    patient_name: { type: "string" },
    doctor_name: { type: "string" },
    document_date: { type: "string", format: "date" },
    document_type: { type: "string" },
    vital_signs: {
      type: "object",
      properties: {
        blood_pressure: { type: "string" },
        heart_rate: { type: "number" },
        temperature: { type: "number" },
        oxygen_saturation: { type: "number" }
      }
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          medication_name: { type: "string" }, // Changed from 'name' to 'medication_name'
          dosage: { type: "string" },
          frequency: { type: "string" },
          duration: { type: "string" }, // Added 'duration'
          instructions: { type: "string" }
        }
      }
    },
    medical_findings: { type: "array", items: { type: "string" } },
    risk_assessment: { type: "string" },
    medical_instructions: { type: "array", items: { type: "string" } },
    diagnosis: { type: "string" }, // Added 'diagnosis'
    recommendations: { type: "array", items: { type: "string" } } // Added 'recommendations'
  },
  required: ["document_date"]
};

// Enhanced AI analysis schema for context-aware insights
const contextualAnalysisSchema = {
  type: "object",
  properties: {
    document_analysis: {
      type: "object",
      properties: {
        document_type: { type: "string" },
        key_findings: { type: "array", items: { type: "string" } },
        abnormal_values: { type: "array", items: { type: "string" } },
        clinical_significance: { type: "string" }
      }
    },
    patient_correlation: {
      type: "object",
      properties: {
        symptom_correlation: { type: "array", items: { type: "string" } },
        historical_comparison: { type: "string" },
        risk_progression: { type: "string", enum: ["improving", "stable", "worsening", "unknown"] }
      }
    },
    clinical_recommendations: {
      type: "object",
      properties: {
        immediate_actions: { type: "array", items: { type: "string" } },
        follow_up_tests: { type: "array", items: { type: "string" } },
        medication_adjustments: { type: "array", items: { type: "string" } },
        lifestyle_modifications: { type: "array", items: { type: "string" } }
      }
    },
    risk_assessment: {
      type: "object",
      properties: {
        overall_risk: { type: "string", enum: ["low", "moderate", "high", "critical"] },
        confidence: { type: "number" },
        risk_factors: { type: "array", items: { type: "string" } },
        protective_factors: { type: "array", items: { type: "string" } }
      }
    }
  },
  required: ["document_analysis", "clinical_recommendations", "risk_assessment"]
};

export default function ImageAnalysis() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDocumentType, setSelectedDocumentType] = useState("ecg");
  const [currentUser, setCurrentUser] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);

  const documentTypes = [
    { value: "ecg", label: "ECG/EKG Report" },
    { value: "xray", label: "Chest X-Ray" },
    { value: "blood_test", label: "Blood Test Results" },
    { value: "cardiac_report", label: "Cardiac Assessment" },
    { value: "prescription", label: "Prescription" },
    { value: "discharge_summary", label: "Discharge Summary" }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        // Load only patients assigned to this doctor
        const patientsList = await Patient.filter({ assigned_doctor_id: user.id });
        setPatients(patientsList);
      } catch (err) {
        console.error("Failed to load initial data:", err);
        setError("Failed to load patient data or user info.");
      }
    };
    loadData();
  }, []);

  // Load patient history when a patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      loadPatientHistory();
    }
  }, [selectedPatientId]);

  const loadPatientHistory = async () => {
    try {
      const patient = patients.find(p => p.id === selectedPatientId);
      setSelectedPatient(patient);
      
      // Load patient's diagnosis history
      const diagnoses = await Diagnosis.filter({ patient_id: selectedPatientId }, '-created_date', 10);
      setPatientHistory(diagnoses);
    } catch (error) {
      console.error("Failed to load patient history:", error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError("File size must be less than 10MB");
        return;
      }
      
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
      setOcrResult(null);
      setAiAnalysis(null);
      setError(null);
      setFileUrl(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const event = { target: { files: [droppedFile] } };
      handleFileChange(event);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const generateBlockchainHash = (data) => {
    const timestamp = new Date().getTime();
    const dataString = JSON.stringify(data);
    return `0x${(timestamp + dataString.length).toString(16)}b${Math.random().toString(36).substr(2, 8)}`;
  };

  const handleAnalyze = async () => {
    if (!file || !selectedPatientId) {
      setError("Please select a file and patient before analyzing.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setOcrResult(null);
    setAiAnalysis(null);

    try {
      // Step 1: Upload the file
      const { file_url } = await UploadFile({ file });
      setFileUrl(file_url);

      // Step 2: Extract data using OCR (ALWAYS WORKS - Independent of models)
      const ocrResponse = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: medicalOCRSchema,
      });

      if (ocrResponse.status === "success" && ocrResponse.output) {
        setOcrResult(ocrResponse.output);
        
        // Step 3: Context-aware AI Analysis (ONLY if image analysis model is active)
        const contextualPrompt = `As a clinical AI specialist, analyze this medical document in the context of the patient's complete medical history.

DOCUMENT DATA:
${JSON.stringify(ocrResponse.output, null, 2)}

PATIENT CONTEXT:
- Patient: ${selectedPatient?.full_name} (Age: ${selectedPatient?.age}, Gender: ${selectedPatient?.gender})
- Blood Type: ${selectedPatient?.blood_type || 'Unknown'}
- Medical History: ${selectedPatient?.medical_history?.join(', ') || 'None recorded'}
- Known Allergies: ${selectedPatient?.allergies?.join(', ') || 'None recorded'}

RECENT DIAGNOSIS HISTORY:
${patientHistory?.map(d => `
- Date: ${new Date(d.created_date).toLocaleDateString()}
- Symptoms: ${d.symptoms?.map(s => s.symptom).join(', ') || 'None'}
- Risk Level: ${d.ai_prediction?.risk_level || 'Not assessed'}
- Previous Findings: ${d.diagnosis_notes || 'None'}
`).join('\n') || 'No previous diagnoses on record'}

ANALYSIS REQUIREMENTS:
1. Analyze the document findings in context of this patient's specific medical history
2. Compare current findings with previous assessments if available
3. Identify any progression, improvement, or concerning changes
4. Provide patient-specific recommendations based on their complete profile
5. Consider drug interactions with known allergies
6. Assess cardiovascular risk in context of patient's demographics and history

Provide a comprehensive, context-aware clinical analysis.`;

        const aiResponse = await getAIAnalysis(
          contextualPrompt,
          contextualAnalysisSchema,
          ocrResponse.output,
          'image_classification' // Specify model type
        );

        setAiAnalysis(aiResponse);
        
      } else {
        throw new Error(ocrResponse.details || "Failed to extract data from the document.");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveToPatientRecord = async () => {
    if (!selectedPatientId || !ocrResult || !fileUrl || !currentUser) {
      setError("Missing information to save to patient record.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const blockchainHash = generateBlockchainHash({
        patient_id: selectedPatientId,
        document_type: selectedDocumentType,
        ocr_data: ocrResult,
        ai_analysis: aiAnalysis,
        file_url: fileUrl
      });
      
      let formattedPrediction = null;
      if (aiAnalysis && !aiAnalysis.no_model_active && aiAnalysis.risk_assessment) {
        // Transform the string array from risk_factors into the object array the schema expects
        const riskFactors = aiAnalysis.risk_assessment.risk_factors || [];
        const formattedPredictedConditions = riskFactors.map(factor => ({
          condition: factor,
          severity: 'moderate' // Assign a default severity as it's not provided by the AI schema
        }));
        
        formattedPrediction = {
          risk_level: aiAnalysis.risk_assessment.overall_risk,
          confidence: aiAnalysis.risk_assessment.confidence || 85,
          predicted_conditions: formattedPredictedConditions,
          recommendations: {
            lifestyle: aiAnalysis.clinical_recommendations.lifestyle_modifications || [],
            medications: aiAnalysis.clinical_recommendations.medication_adjustments || [],
            follow_up: aiAnalysis.clinical_recommendations.follow_up_tests?.join(', ') || 'Standard follow-up',
            referrals: aiAnalysis.clinical_recommendations.immediate_actions || []
          }
        };
      }

      // Create comprehensive diagnosis entry with image analysis
      const diagnosisPayload = {
        patient_id: selectedPatientId,
        doctor_id: currentUser.id,
        symptoms: [{ 
          symptom: "Medical document analysis", 
          severity: "mild", 
          duration: "N/A",
          associated_factors: []
        }],
        medical_images: [{
          image_url: fileUrl,
          image_type: selectedDocumentType,
          ocr_data: ocrResult,
          analysis_notes: aiAnalysis && !aiAnalysis.no_model_active ? `Context-aware AI Analysis: ${aiAnalysis.document_analysis.clinical_significance}` : "OCR data extracted from uploaded document."
        }],
        ai_prediction: formattedPrediction,
        diagnosis_notes: `Medical document analysis completed. Document type: ${selectedDocumentType}. ${aiAnalysis && !aiAnalysis.no_model_active ? aiAnalysis.document_analysis.clinical_significance : 'OCR processing completed successfully.'}`,
        treatment_plan: aiAnalysis && !aiAnalysis.no_model_active ? aiAnalysis.clinical_recommendations.immediate_actions?.join(', ') : 'Follow standard protocols based on extracted data.',
        blockchain_hash: blockchainHash,
        status: "completed"
      };
      
      await Diagnosis.create(diagnosisPayload);
      
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        navigate(createPageUrl("PatientRecords"));
      }, 2000);
    } catch (err) {
      console.error("Failed to save to patient record:", err);
      setError("Failed to save document to patient record. The document type may not be supported. " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Professional Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(createPageUrl("DoctorDashboard"))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI-Powered Image Analyzer</h1>
            <p className="text-gray-600">Context-aware medical document analysis with patient history integration</p>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md text-center" hideCloseButton={true}>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="mt-4">Save Successful!</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-500">
              The document has been successfully added to the patient's record. You will be redirected shortly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Top Row: Document Upload (Left) + AI Analysis (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Patient Selection & Document Upload */}
        <div className="space-y-6">
          {/* Patient Selection Card */}
          <Card className="shadow-lg border-0 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-600" />
                Patient Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patient-select">Select Patient</Label>
                <Select 
                  value={selectedPatientId} 
                  onValueChange={setSelectedPatientId}
                >
                  <SelectTrigger id="patient-select">
                    <SelectValue placeholder="Choose patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(patient => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.full_name} (ID: {patient.patient_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPatient && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Patient Profile</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="font-medium">Age:</span> {selectedPatient.age}</div>
                    <div><span className="font-medium">Gender:</span> {selectedPatient.gender}</div>
                    <div><span className="font-medium">Blood Type:</span> {selectedPatient.blood_type || 'Unknown'}</div>
                    <div><span className="font-medium">History:</span> {patientHistory?.length || 0} diagnoses</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="doc-type-select">Document Type</Label>
                <Select 
                  value={selectedDocumentType} 
                  onValueChange={setSelectedDocumentType}
                >
                  <SelectTrigger id="doc-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Document Upload Card */}
          <Card className="shadow-lg border-0 flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Document Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer min-h-[200px] flex flex-col justify-center"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  {file ? (
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-gray-700">
                        Drop your medical document here
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        or click to browse (PNG, JPG, PDF up to 10MB)
                      </p>
                    </div>
                  )}
                  <Input 
                    id="file-upload" 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange} 
                    accept="image/png, image/jpeg, application/pdf" 
                  />
                </label>
              </div>

              {/* File Preview */}
              {filePreview && (
                <div className="mt-4">
                  <img 
                    src={filePreview} 
                    alt="Preview" 
                    className="w-full h-48 object-contain rounded-lg border bg-gray-50" 
                  />
                </div>
              )}

              <Button 
                onClick={handleAnalyze} 
                disabled={!file || !selectedPatientId || isLoading} 
                className="w-full mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Document...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI Analysis Results */}
        <div className="space-y-6">
          <Card className="shadow-lg border-0 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Context-Aware AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiAnalysis ? (
                aiAnalysis.no_model_active ? (
                  // Show "No Model Active" message
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Image Analysis Model Active</h3>
                    <p className="text-gray-500 mb-4">{aiAnalysis.message}</p>
                    <p className="text-sm text-gray-400 mb-6">OCR extraction was completed successfully. To perform AI analysis, please contact an administrator to activate an image analysis model.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Risk Assessment Summary */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Risk Assessment</h4>
                        <Badge className={getRiskColor(aiAnalysis.risk_assessment.overall_risk)}>
                          {aiAnalysis.risk_assessment.overall_risk} Risk
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">Confidence:</span> {aiAnalysis.risk_assessment.confidence}%
                      </p>
                      <p className="text-sm text-gray-700">
                        {aiAnalysis.document_analysis.clinical_significance}
                      </p>
                    </div>

                    {/* Detailed Analysis */}
                    <Accordion type="multiple" className="w-full" defaultValue={['document', 'correlation', 'recommendations']}>
                      <AccordionItem value="document">
                        <AccordionTrigger className="text-base font-semibold">Document Analysis</AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          {aiAnalysis.document_analysis.key_findings?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Key Findings</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                {aiAnalysis.document_analysis.key_findings.map((finding, index) => (
                                  <li key={index}>{finding}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.document_analysis.abnormal_values?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-red-700 mb-2">Abnormal Values</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                                {aiAnalysis.document_analysis.abnormal_values.map((value, index) => (
                                  <li key={index}>{value}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="correlation">
                        <AccordionTrigger className="text-base font-semibold">Patient History Correlation</AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          {aiAnalysis.patient_correlation.symptom_correlation?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-blue-700 mb-2">Symptom Correlations</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                {aiAnalysis.patient_correlation.symptom_correlation.map((correlation, index) => (
                                  <li key={index}>{correlation}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.patient_correlation.historical_comparison && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Historical Comparison</h5>
                              <p className="text-sm text-gray-700">{aiAnalysis.patient_correlation.historical_comparison}</p>
                            </div>
                          )}
                          {aiAnalysis.patient_correlation.risk_progression && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Risk Progression</h5>
                              <Badge className={
                                aiAnalysis.patient_correlation.risk_progression === 'improving' ? 'bg-green-100 text-green-800' :
                                aiAnalysis.patient_correlation.risk_progression === 'worsening' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {aiAnalysis.patient_correlation.risk_progression}
                              </Badge>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="recommendations">
                        <AccordionTrigger className="text-base font-semibold">Clinical Recommendations</AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {aiAnalysis.clinical_recommendations.immediate_actions?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Immediate Actions
                              </h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                                {aiAnalysis.clinical_recommendations.immediate_actions.map((action, index) => (
                                  <li key={index}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.clinical_recommendations.follow_up_tests?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-blue-700 mb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Recommended Tests
                              </h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-blue-600">
                                {aiAnalysis.clinical_recommendations.follow_up_tests.map((test, index) => (
                                  <li key={index}>{test}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.clinical_recommendations.medication_adjustments?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-purple-700 mb-2">Medication Considerations</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-purple-600">
                                {aiAnalysis.clinical_recommendations.medication_adjustments.map((med, index) => (
                                  <li key={index}>{med}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.clinical_recommendations.lifestyle_modifications?.length > 0 && (
                            <div>
                              <h5 className="font-medium text-green-700 mb-2">Lifestyle Modifications</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-green-600">
                                {aiAnalysis.clinical_recommendations.lifestyle_modifications.map((mod, index) => (
                                  <li key={index}>{mod}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )
              ) : !isLoading ? (
                <div className="text-center py-12">
                  <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">AI analysis results will appear here</p>
                  <p className="text-gray-400 text-sm mt-2">Upload a document and click &quot;Analyze with AI&quot; to begin</p>
                </div>
              ) : (
                <div className="space-y-4 animate-pulse py-12">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Full-Width Extracted Information */}
      <div className="w-full">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Extracted Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ocrResult ? (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <InfoItem label="Patient Name" value={ocrResult.patient_name} />
                  <InfoItem label="Doctor Name" value={ocrResult.doctor_name} />
                  <InfoItem label="Document Date" value={ocrResult.document_date} />
                  <InfoItem label="Document Type" value={ocrResult.document_type} />
                </div>

                {/* Medications Section */}
                {ocrResult.medications && ocrResult.medications.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      Prescribed Medications
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {ocrResult.medications.map((medication, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg border border-green-100">
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <p className="text-sm font-medium text-green-800">Medication Name</p>
                              <p className="text-lg font-bold text-green-900">{medication.medication_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-800">Dosage</p>
                              <p className="text-sm text-green-700">{medication.dosage}</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {medication.frequency && (
                              <div>
                                <p className="text-sm font-medium text-green-800">Frequency</p>
                                <p className="text-sm text-green-700">{medication.frequency}</p>
                              </div>
                            )}
                            {medication.duration && (
                              <div>
                                <p className="text-sm font-medium text-green-800">Duration</p>
                                <p className="text-sm text-green-700">{medication.duration}</p>
                              </div>
                            )}
                            {medication.instructions && (
                              <div>
                                <p className="text-sm font-medium text-green-800">Instructions</p>
                                <p className="text-sm text-green-700">{medication.instructions}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vital Signs */}
                {ocrResult.vital_signs && Object.keys(ocrResult.vital_signs).some(key => ocrResult.vital_signs[key]) && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      Vital Signs
                    </h4>
                    <div className="grid md:grid-cols-2 gap-2">
                      <InfoItem label="Blood Pressure" value={ocrResult.vital_signs.blood_pressure} />
                      <InfoItem label="Heart Rate" value={ocrResult.vital_signs.heart_rate} />
                      <InfoItem label="Temperature" value={ocrResult.vital_signs.temperature} />
                      <InfoItem label="Oxygen Saturation" value={ocrResult.vital_signs.oxygen_saturation} />
                    </div>
                  </div>
                )}

                {/* Medical Findings */}
                {ocrResult.medical_findings && ocrResult.medical_findings.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-900 mb-2">Medical Findings</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {ocrResult.medical_findings.map((finding, index) => (
                        <li key={index} className="text-sm text-yellow-800">{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnosis */}
                {ocrResult.diagnosis && (
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">Diagnosis</h4>
                    <p className="text-sm text-purple-800">{ocrResult.diagnosis}</p>
                  </div>
                )}

                {/* Recommendations */}
                {ocrResult.recommendations && ocrResult.recommendations.length > 0 && (
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold text-indigo-900 mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {ocrResult.recommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm text-indigo-800">{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk Assessment */}
                {ocrResult.risk_assessment && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-900 mb-2">Risk Assessment</h4>
                    <p className="text-sm text-red-800">{ocrResult.risk_assessment}</p>
                  </div>
                )}

                {/* Medical Instructions */}
                {ocrResult.medical_instructions && ocrResult.medical_instructions.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Medical Instructions</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {ocrResult.medical_instructions.map((instruction, index) => (
                        <li key={index} className="text-sm text-gray-700">{instruction}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : !isLoading ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Extracted information will appear here</p>
                <p className="text-gray-400 text-sm mt-2">Upload and analyze a document to see extracted data</p>
              </div>
            ) : (
              <div className="space-y-4 animate-pulse py-8">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save to Patient Record */}
      {ocrResult && (
        <div className="flex justify-center">
          <Button 
            onClick={handleSaveToPatientRecord}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 px-8 py-3"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving to Patient Record...
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 mr-2" />
                Save to Patient Record
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

const InfoItem = ({ label, value }) => {
  if (!value) return null;
  
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
};
