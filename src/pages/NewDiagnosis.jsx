
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Patient } from "@/api/entities";
import { Diagnosis } from "@/api/entities";
import { User } from "@/api/entities";
import { getAIAnalysis } from "@/components/utils/inference";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, UserPlus, Stethoscope, Brain, FileText, Check, Plus, Trash2, Loader2, ArrowLeft, AlertTriangle, ShieldCheck, Pill, BookOpen, Activity, Thermometer, HeartPulse, Wind, Gauge, Ruler } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const aiPredictionSchema = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "moderate", "high", "critical"] },
    risk_score: { type: "number", description: "A precise numeric risk score from 0 to 100." },
    confidence: { type: "number", description: "Confidence score for the overall assessment, from 0 to 100." },
    predicted_conditions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          severity: { type: "string", enum: ["low", "moderate", "high"] }
        },
        required: ["condition", "severity"]
      }
    },
    recommendations: {
      type: "object",
      properties: {
        lifestyle: { type: "array", items: { type: "string" } },
        medications: { type: "array", items: { type: "string" } },
        follow_up: { type: "string" },
        referrals: { type: "array", items: { type: "string" } }
      }
    },
    urgent_warning_signs: { type: "array", items: { type: "string" } },
    guideline_references: { type: "array", items: { type: "string" } },
    decision_support_flags: { type: "array", items: { type: "string" } }
  },
  required: ["risk_level", "risk_score", "confidence", "predicted_conditions", "recommendations"],
};

// --- Step 1: Patient Selection ---
const PatientStep = React.memo(({ patients, diagnosisData, setDiagnosisData, onNewPatient }) => (
  <>
    <CardHeader>
      <CardTitle className="flex items-center gap-3">
        <Heart className="w-6 h-6 text-blue-600" />
        Select Patient
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="patient-select">Choose an existing patient</Label>
        <Select 
          value={diagnosisData.patient_id} 
          onValueChange={(value) => setDiagnosisData(prev => ({ ...prev, patient_id: value }))}
        >
          <SelectTrigger id="patient-select">
            <SelectValue placeholder="Select a patient..." />
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
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onNewPatient}>
        <UserPlus className="w-4 h-4 mr-2" />
        Register New Patient
      </Button>
    </CardContent>
  </>
));

// --- Step 2: Symptoms & Vitals (Complete Overhaul) ---
const SymptomsStep = React.memo(({ diagnosisData, setDiagnosisData }) => {
  const handleSymptomChange = useCallback((index, field, value) => {
    setDiagnosisData(prev => {
      const newSymptoms = JSON.parse(JSON.stringify(prev.symptoms));
      newSymptoms[index][field] = value;
      return { ...prev, symptoms: newSymptoms };
    });
  }, [setDiagnosisData]);

  const addSymptom = useCallback(() => {
    setDiagnosisData(prev => ({
      ...prev,
      symptoms: [...(prev.symptoms || []), { id: Date.now(), symptom: "", severity: "mild", duration: "", associated_factors: [] }]
    }));
  }, [setDiagnosisData]);

  const removeSymptom = useCallback((index) => {
    setDiagnosisData(prev => ({
      ...prev,
      symptoms: prev.symptoms.filter((_, i) => i !== index)
    }));
  }, [setDiagnosisData]);

  const handleFactorChange = useCallback((symptomIndex, factor, checked) => {
    setDiagnosisData(prev => {
      const newSymptoms = JSON.parse(JSON.stringify(prev.symptoms));
      const currentFactors = newSymptoms[symptomIndex].associated_factors || [];
      if (checked) {
        newSymptoms[symptomIndex].associated_factors = [...currentFactors, factor];
      } else {
        newSymptoms[symptomIndex].associated_factors = currentFactors.filter(f => f !== factor);
      }
      return { ...prev, symptoms: newSymptoms };
    });
  }, [setDiagnosisData]);
  
  const handleVitalChange = useCallback((field, value) => {
    setDiagnosisData(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [field]: value }
    }));
  }, [setDiagnosisData]);
  
  const handleClinicalNotesChange = useCallback((value) => {
    setDiagnosisData(prev => ({
      ...prev,
      clinical_observations: value
    }));
  }, [setDiagnosisData]);

  const calculatedBMI = useMemo(() => {
    const weight = parseFloat(diagnosisData.vital_signs?.weight_kg);
    const height = parseFloat(diagnosisData.vital_signs?.height_cm);
    if (weight > 0 && height > 0) {
      const heightInMeters = height / 100;
      return (weight / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return null;
  }, [diagnosisData.vital_signs?.weight_kg, diagnosisData.vital_signs?.height_cm]);

  const associatedFactorsOptions = ["Exertion", "Rest", "Stress", "After Meals"];
  
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Stethoscope className="w-6 h-6 text-blue-600" />
          Record Symptoms, Vitals & Observations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Patient Symptoms Card */}
        <Card className="p-6 border-0 shadow-md bg-gray-50/50">
          <CardTitle className="text-lg mb-4">Patient Symptoms</CardTitle>
          <div className="space-y-4">
            {(diagnosisData.symptoms || []).map((symptom, index) => (
              <div key={symptom.id || index} className="p-4 border rounded-lg bg-white space-y-4">
                <div className="flex gap-4 items-start">
                  <Input 
                    placeholder="Describe symptom (e.g., Chest pain)" 
                    value={symptom.symptom} 
                    onChange={(e) => handleSymptomChange(index, 'symptom', e.target.value)}
                    className="flex-1"
                  />
                  <Select 
                    value={symptom.severity} 
                    onValueChange={(value) => handleSymptomChange(index, 'severity', value)}
                  >
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Duration" 
                    value={symptom.duration} 
                    onChange={(e) => handleSymptomChange(index, 'duration', e.target.value)}
                    className="w-40"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeSymptom(index)}
                    disabled={diagnosisData.symptoms.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                <div>
                  <Label className="text-sm font-medium">Associated Factors</Label>
                  <div className="flex gap-4 pt-2">
                    {associatedFactorsOptions.map(factor => (
                      <div key={factor} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`factor-${index}-${factor}`} 
                          checked={(symptom.associated_factors || []).includes(factor)}
                          onCheckedChange={(checked) => handleFactorChange(index, factor, checked)}
                        />
                        <Label htmlFor={`factor-${index}-${factor}`} className="text-sm font-normal">{factor}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addSymptom} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Symptom
            </Button>
          </div>
        </Card>

        {/* Vital Signs Card */}
        <Card className="p-6 border-0 shadow-md bg-gray-50/50">
          <CardTitle className="text-lg mb-4">Vital Signs</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <VitalInput icon={HeartPulse} label="Systolic BP (mmHg)" id="systolic_bp" value={diagnosisData.vital_signs.systolic_bp} onChange={(e) => handleVitalChange('systolic_bp', e.target.value)} placeholder="e.g., 120" helpText="Normal: 90-120" />
            <VitalInput icon={HeartPulse} label="Diastolic BP (mmHg)" id="diastolic_bp" value={diagnosisData.vital_signs.diastolic_bp} onChange={(e) => handleVitalChange('diastolic_bp', e.target.value)} placeholder="e.g., 80" helpText="Normal: 60-80" />
            <VitalInput icon={Heart} label="Heart Rate (bpm)" id="hr" value={diagnosisData.vital_signs.heart_rate} onChange={(e) => handleVitalChange('heart_rate', e.target.value)} placeholder="e.g., 72" helpText="Normal: 60-100" />
            <VitalInput icon={Thermometer} label="Temperature (°C)" id="temp" value={diagnosisData.vital_signs.temperature} onChange={(e) => handleVitalChange('temperature', e.target.value)} placeholder="e.g., 37.0" helpText="Normal: 36.1-37.2" />
            <VitalInput icon={Gauge} label="Oxygen Saturation (%)" id="oxygen" value={diagnosisData.vital_signs.oxygen_saturation} onChange={(e) => handleVitalChange('oxygen_saturation', e.target.value)} placeholder="e.g., 98" helpText="Normal: 95-100" />
            <VitalInput icon={Wind} label="Respiratory Rate (breaths/min)" id="resp_rate" value={diagnosisData.vital_signs.respiratory_rate} onChange={(e) => handleVitalChange('respiratory_rate', e.target.value)} placeholder="e.g., 16" helpText="Normal: 12-20" />
            <VitalInput icon={Ruler} label="Weight (kg)" id="weight" value={diagnosisData.vital_signs.weight_kg} onChange={(e) => handleVitalChange('weight_kg', e.target.value)} placeholder="e.g., 70" />
            <VitalInput icon={Ruler} label="Height (cm)" id="height" value={diagnosisData.vital_signs.height_cm} onChange={(e) => handleVitalChange('height_cm', e.target.value)} placeholder="e.g., 175" />
            <div>
              <Label>BMI</Label>
              <Input value={calculatedBMI || 'N/A'} readOnly className="mt-2 bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
            </div>
          </div>
        </Card>
        
        {/* Clinical Observations Card */}
        <Card className="p-6 border-0 shadow-md bg-gray-50/50">
          <CardTitle className="text-lg mb-4">Clinical Observations</CardTitle>
          <Textarea 
            placeholder="Enter any initial clinical observations, notes, or context here..." 
            rows={4}
            value={diagnosisData.clinical_observations || ''}
            onChange={(e) => handleClinicalNotesChange(e.target.value)}
          />
        </Card>
      </CardContent>
    </>
  );
});

const VitalInput = ({ icon: Icon, label, id, value, onChange, placeholder, helpText }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
      <Icon className="w-4 h-4 text-gray-600" />
      {label}
    </Label>
    <Input 
      id={id} 
      type="number"
      value={value || ''} 
      onChange={onChange} 
      placeholder={placeholder}
    />
    {helpText && <p className="text-xs text-gray-500">{helpText}</p>}
  </div>
);

// --- Step 3: Review & Finalize ---
const FinalizeStep = React.memo(({ diagnosisData, setDiagnosisData }) => {
  const { ai_prediction: ai, vital_signs: vitals } = diagnosisData;

  const getRiskClasses = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-red-500 text-white';
      case 'moderate': return 'bg-yellow-400 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  if (!ai) {
    return (
      <div className="p-8 text-center">
        <p>AI analysis has not been run yet.</p>
      </div>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          Review & Finalize Diagnosis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top-level AI Assessment */}
        <Card className="p-6 border-0 shadow-md bg-gray-50/50">
          <CardTitle className="text-lg mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-700" />
            AI Clinical Assessment
          </CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className={`p-4 rounded-lg ${getRiskClasses(ai.risk_level)}`}>
              <p className="text-sm font-medium opacity-80">Risk Level</p>
              <p className="text-3xl font-bold">{ai.risk_level}</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-100">
              <p className="text-sm font-medium text-blue-800">Risk Score</p>
              <p className="text-3xl font-bold text-blue-900">{ai.risk_score}%</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-100">
              <p className="text-sm font-medium text-purple-800">AI Confidence</p>
              <p className="text-3xl font-bold text-purple-900">{ai.confidence}%</p>
            </div>
          </div>
        </Card>

        {/* Urgent Warnings */}
        <RecommendationSection 
          icon={AlertTriangle}
          title="Urgent Warning Signs"
          items={ai.recommendations?.urgent_warning_signs}
          itemClassName="text-red-700 font-medium"
        />

        {/* Accordion for details */}
        <Accordion type="multiple" className="w-full" defaultValue={['conditions', 'recommendations']}>
          {/* Predicted Conditions */}
          <AccordionItem value="conditions">
            <AccordionTrigger className="text-base font-semibold">Predicted Conditions</AccordionTrigger>
            <AccordionContent className="space-y-2">
              {ai.predicted_conditions?.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                  <span>{c.condition}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRiskClasses(c.severity)}`}>
                    {c.severity}
                  </span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* AI Recommendations */}
          <AccordionItem value="recommendations">
            <AccordionTrigger className="text-base font-semibold">AI-Generated Recommendations</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <RecommendationSection icon={Activity} title="Lifestyle" items={ai.recommendations?.lifestyle} />
              <RecommendationSection icon={Pill} title="Medication Classes" items={ai.recommendations?.medications} />
              <RecommendationSection icon={UserPlus} title="Referrals" items={ai.recommendations?.referrals} />
              {ai.recommendations?.follow_up && (
                <InfoItem icon={BookOpen} label="Follow-up Plan" value={ai.recommendations.follow_up} />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Decision Support & Guidelines */}
          <AccordionItem value="support">
            <AccordionTrigger className="text-base font-semibold">Decision Support</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <RecommendationSection icon={ShieldCheck} title="Flags for Doctor" items={ai.decision_support_flags} itemClassName="text-blue-700"/>
              <RecommendationSection icon={BookOpen} title="Guideline References" items={ai.guideline_references} itemClassName="text-gray-600"/>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Final Doctor's Notes */}
        <Card className="p-6 border-0 shadow-md bg-gray-50/50">
          <CardTitle className="text-lg mb-4">Doctor's Final Diagnosis & Plan</CardTitle>
          <div>
            <Label htmlFor="diagnosis_notes">Diagnosis Notes</Label>
            <Textarea 
              id="diagnosis_notes"
              placeholder="Confirm or override AI diagnosis here. Add your clinical reasoning." 
              rows={4}
              value={diagnosisData.diagnosis_notes}
              onChange={(e) => setDiagnosisData(prev => ({...prev, diagnosis_notes: e.target.value}))}
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="treatment_plan">Treatment Plan</Label>
            <Textarea 
              id="treatment_plan"
              placeholder="Specify medications, dosages, and follow-up actions."
              rows={4}
              value={diagnosisData.treatment_plan}
              onChange={(e) => setDiagnosisData(prev => ({...prev, treatment_plan: e.target.value}))}
            />
            <p className="text-xs text-gray-500 mt-1">AI suggested plan has been pre-filled. Please review and modify.</p>
          </div>
        </Card>
      </CardContent>
    </>
  );
});


const RecommendationSection = ({ icon: Icon, title, items, itemClassName = 'text-gray-700' }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      {title && <h4 className="font-medium flex items-center gap-2 mb-2">{Icon && <Icon className="w-4 h-4"/>}{title}</h4>}
      <ul className="list-disc list-inside space-y-1 text-sm">
        {items.map((item, index) => <li key={index} className={itemClassName}>{item}</li>)}
      </ul>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
    <Icon className="w-4 h-4 text-blue-500" />
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  </div>
);


// --- Main Page Component ---
export default function NewDiagnosis() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  // const [showSuccess, setShowSuccess] = useState(false); // Removed as per outline
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Added as per outline
  const [diagnosisData, setDiagnosisData] = useState({
    patient_id: "",
    doctor_id: "",
    symptoms: [{ id: Date.now(), symptom: "", severity: "mild", duration: "", associated_factors: [] }],
    vital_signs: { systolic_bp: "", diastolic_bp: "", heart_rate: "", temperature: "", oxygen_saturation: "", respiratory_rate: "", weight_kg: "", height_cm: "" },
    clinical_observations: "",
    ai_prediction: null,
    diagnosis_notes: "",
    treatment_plan: "",
    blockchain_hash: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    patient_id: "",
    full_name: "",
    age: "",
    gender: "",
    blood_type: "",
    phone: "",
    emergency_contact: ""
  });

  // New state variables for the professional modal
  const [showNoModelModal, setShowNoModelModal] = useState(false);
  const [noModelMessage, setNoModelMessage] = useState("");
  
  useEffect(() => {
     const loadData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        // Load only patients assigned to the current doctor
        const patientsList = await Patient.filter({ assigned_doctor_id: user.id });
        setPatients(patientsList);
        
        setDiagnosisData(prev => ({ ...prev, doctor_id: user.id }));
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  const generateBlockchainHash = (data) => `0x${(new Date().getTime() + JSON.stringify(data).length).toString(16)}a${Math.random().toString(36).substr(2, 8)}`;

  const generatePatientId = () => {
     const prefix = "P";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  const handleCreatePatient = async () => {
     if (!newPatient.full_name || !newPatient.age || !newPatient.gender) {
      // Use the modal for this alert too for consistency
      setNoModelMessage("Please fill in all required patient fields (Full Name, Age, Gender).");
      setShowNoModelModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      const patientData = {
        ...newPatient,
        patient_id: newPatient.patient_id || generatePatientId(),
        age: parseInt(newPatient.age),
        assigned_doctor_id: currentUser.id,
        blockchain_hash: `0x${Date.now().toString(16)}${Math.random().toString(36).substr(2, 8)}`
      };

      const createdPatient = await Patient.create(patientData);
      setDiagnosisData(prev => ({ ...prev, patient_id: createdPatient.id }));
      setIsNewPatientModalOpen(false);
      
      // Reload patients list for the current doctor
      const updatedPatients = await Patient.filter({ assigned_doctor_id: currentUser.id });
      setPatients(updatedPatients);
      
      // Reset form
      setNewPatient({
        patient_id: "",
        full_name: "",
        age: "",
        gender: "",
        blood_type: "",
        phone: "",
        emergency_contact: ""
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      setNoModelMessage("Error creating patient. Please try again.");
      setShowNoModelModal(true);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleRunAI = async () => {
    setIsProcessing(true);
    try {
      const symptomsText = (diagnosisData.symptoms || [])
        .filter(s => s.symptom.trim())
        .map(s => `${s.symptom} (severity: ${s.severity}, duration: ${s.duration}, factors: ${(s.associated_factors || []).join(', ') || 'none'})`)
        .join('; ');
        
      const vitalsText = Object.entries(diagnosisData.vital_signs)
        .filter(([_, value]) => value)
        .map(([key, value]) => {
            if (key === 'systolic_bp' || key === 'diastolic_bp') return `blood_pressure: ${diagnosisData.vital_signs.systolic_bp}/${diagnosisData.vital_signs.diastolic_bp}`;
            return `${key.replace(/_/g, ' ')}: ${value}`
        })
        .join('; ');

      const prompt = `As a professional clinical decision support AI, analyze the following patient data for cardiovascular risk. Provide a comprehensive, evidence-based assessment.

Patient Data:
- Symptoms: ${symptomsText || 'None reported'}
- Vital Signs: ${[...new Set(vitalsText.split(';'))].join('; ') || 'None recorded'}
- Clinical Observations: ${diagnosisData.clinical_observations || 'None'}

Output a structured JSON object according to the provided schema. The analysis must be thorough. For recommendations, provide actionable, specific advice for lifestyle, medication classes (not specific drugs), follow-up, and potential referrals. Include urgent warning signs for the patient and reference major clinical guidelines (e.g., ACC/AHA, ESC). Also provide decision support flags for the doctor.`;

      const result = await getAIAnalysis(prompt, aiPredictionSchema, null, 'heart_disease');
      
      // Check if no model is active
      if (result.no_model_active) {
        setNoModelMessage(result.message);
        setShowNoModelModal(true);
        setIsProcessing(false); // Ensure processing state is reset
        return; // Stop execution if no model is active
      }
      
      // Pre-populate treatment plan with AI suggestions
      const suggestedPlan = result.recommendations?.medications?.join('\n') || '';
      
      setDiagnosisData(prev => ({ 
        ...prev, 
        ai_prediction: result,
        treatment_plan: suggestedPlan // Set initial treatment plan
      }));
      setStep(3);
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setNoModelMessage("AI analysis failed. Please try again or proceed manually. Error: " + error.message);
      setShowNoModelModal(true);
    }
    setIsProcessing(false);
  };
  
  const handleSaveDiagnosis = async () => {
     setIsProcessing(true);
    try {
      const blockchainHash = generateBlockchainHash(diagnosisData);
      const diagnosisToSave = { ...diagnosisData, blockchain_hash: blockchainHash, status: "completed" };
      await Diagnosis.create(diagnosisToSave);
      
      // Show success modal instead of banner
      setShowSuccessModal(true);
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate(createPageUrl("DoctorDashboard"));
      }, 2000);
    } catch (error) {
      console.error("Error saving diagnosis:", error);
      setNoModelMessage("Error saving diagnosis. Please try again.");
      setShowNoModelModal(true);
    }
    setIsProcessing(false);
  };
  
  const STEPS = [
    { number: 1, label: "Patient", icon: Heart },
    { number: 2, label: "Symptoms & Vitals", icon: Stethoscope },
    { number: 3, label: "Review & Save", icon: FileText },
  ];

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("DoctorDashboard"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Diagnosis Workflow</h1>
            <p className="text-gray-600">AI-powered heart disease risk assessment</p>
          </div>
        </div>
        
        {/* Removed as per outline:
        {showSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <Check className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">Diagnosis successfully saved! Redirecting to dashboard...</AlertDescription>
          </Alert>
        )}
        */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Vertical Stepper */}
          <div className="md:col-span-1">
            <ol className="space-y-4">
              {STEPS.map((s) => (
                <li key={s.number} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${step >= s.number ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                    {step > s.number ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Step {s.number}</p>
                    <p className="font-medium text-gray-800">{s.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Form Content */}
          <div className="md:col-span-3">
            <Card className="shadow-lg border-0">
              {step === 1 && <PatientStep 
                patients={patients} 
                diagnosisData={diagnosisData} 
                setDiagnosisData={setDiagnosisData} 
                onNewPatient={() => setIsNewPatientModalOpen(true)}
              />}
              {step === 2 && <SymptomsStep diagnosisData={diagnosisData} setDiagnosisData={setDiagnosisData} />}
              {step === 3 && <FinalizeStep diagnosisData={diagnosisData} setDiagnosisData={setDiagnosisData} />}

              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => setStep(s => Math.max(1, s-1))} disabled={step === 1}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                
                {step === 1 && <Button onClick={() => setStep(2)} disabled={!diagnosisData.patient_id}>Next: Symptoms</Button>}
                {step === 2 && (
                  <Button onClick={handleRunAI} disabled={isProcessing || (diagnosisData.symptoms || []).every(s => !s.symptom.trim())}>
                    {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Brain className="w-4 h-4 mr-2" />Run AI Analysis</>}
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={handleSaveDiagnosis} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                    {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Diagnosis</>}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Diagnosis Saved Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 mb-4">
              The diagnosis has been successfully saved to the patient's medical record and secured on the blockchain.
            </p>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Redirecting:</strong> You will be redirected to the dashboard in a few seconds...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional No Model Modal */}
      <Dialog open={showNoModelModal} onOpenChange={setShowNoModelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Heart Disease Analysis Model Required
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 mb-4">{noModelMessage}</p>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Next Steps:</strong> Please go to ML Model Management and activate a heart disease or symptom analysis model to perform AI analysis.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNoModelModal(false)} className="w-full">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Patient Modal */}
      <Dialog open={isNewPatientModalOpen} onOpenChange={setIsNewPatientModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patient_id">Patient ID (Auto-generated if left blank)</Label>
                <Input 
                  id="patient_id" 
                  placeholder={generatePatientId()} // Show example ID
                  value={newPatient.patient_id} 
                  onChange={(e) => setNewPatient({...newPatient, patient_id: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
                <Input 
                  id="full_name" 
                  value={newPatient.full_name} 
                  onChange={(e) => setNewPatient({...newPatient, full_name: e.target.value})} 
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age <span className="text-red-500">*</span></Label>
                <Input 
                  id="age" 
                  type="number" 
                  value={newPatient.age} 
                  onChange={(e) => setNewPatient({...newPatient, age: e.target.value})} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                <Select 
                  value={newPatient.gender} 
                  onValueChange={(value) => setNewPatient({...newPatient, gender: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="blood_type">Blood Type</Label>
                <Select 
                  value={newPatient.blood_type} 
                  onValueChange={(value) => setNewPatient({...newPatient, blood_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={newPatient.phone} 
                  onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact">Emergency Contact</Label>
                <Input 
                  id="emergency_contact" 
                  value={newPatient.emergency_contact} 
                  onChange={(e) => setNewPatient({...newPatient, emergency_contact: e.target.value})} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPatientModalOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleCreatePatient} disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
