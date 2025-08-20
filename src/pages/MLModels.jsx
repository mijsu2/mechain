
import React, { useState, useEffect } from "react";
import { MLModel } from "@/api/entities";
import { SystemSetting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Upload,
  CheckCircle,
  AlertTriangle,
  Power,
  Server,
  Heart,
  Scan,
  CircleDot,
  Eye,
  Loader2 } from
"lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadFile } from "@/api/integrations";
import FullScreenLoader from "@/components/FullScreenLoader";

const modelTypeInfo = {
  heart_disease: { icon: Heart, color: "text-red-500", bgColor: "bg-red-50" },
  image_classification: { icon: Scan, color: "text-purple-500", bgColor: "bg-purple-50" }
};

export default function MLModels() {
  const [models, setModels] = useState([]);
  const [setting, setSetting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAPIModelFormOpen, setIsAPIModelFormOpen] = useState(false);
  const [currentView, setCurrentView] = useState('api');
  const [isUploading, setIsUploading] = useState(false);
  const [modelFile, setModelFile] = useState(null);
  const [loadingModelId, setLoadingModelId] = useState(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const [newModel, setNewModel] = useState({
    model_name: "",
    version: "",
    model_type: "heart_disease",
    accuracy: 0,
    description: "",
    model_file_url: "",
    mock_prediction_output: "{\n  \"risk_level\": \"low\",\n  \"risk_score\": 15,\n  \"confidence\": 95,\n  \"predicted_conditions\": [],\n  \"recommendations\": {}\n}"
  });

  const [newAPIModel, setNewAPIModel] = useState({
    model_name: "",
    version: "",
    model_type: "heart_disease",
    accuracy: 0,
    description: "",
    api_endpoint: "",
    api_key: "",
    mock_prediction_output: "{\n  \"risk_level\": \"moderate\",\n  \"risk_score\": 65,\n  \"confidence\": 92,\n  \"predicted_conditions\": [],\n  \"recommendations\": {}\n}"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [modelsList, settingsList] = await Promise.all([
    MLModel.list('-created_date'),
    SystemSetting.list()]
    );

    setModels(modelsList);

    if (settingsList.length > 0) {
      setSetting(settingsList[0]);
      setCurrentView(settingsList[0].active_model_type);
    } else {
      const newSetting = await SystemSetting.create({ active_model_type: 'api' });
      setSetting(newSetting);
      setCurrentView('api');
    }

    setIsLoading(false);
  };

  const handleViewChange = (viewType) => {
    setCurrentView(viewType);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setModelFile(file);
    }
  };

  const handleActivateModelType = async (newType) => {
    setIsGlobalLoading(true);
    try {
      if (!setting) return;

      if (newType === 'local' && !models.some((m) => m.model_file_url)) {
        alert("Cannot activate Local Model mode. Please upload at least one local model first.");
        setIsGlobalLoading(false);
        return;
      }

      await SystemSetting.update(setting.id, { active_model_type: newType });

      if (newType === 'api') {
        const activeLocalModels = models.filter((m) => m.is_active && m.model_file_url);
        for (const model of activeLocalModels) {
          await MLModel.update(model.id, { is_active: false });
        }

        const { active_api_heart_disease_model_id, active_api_image_analysis_model_id } = setting;
        if (active_api_heart_disease_model_id && models.some((m) => m.id === active_api_heart_disease_model_id)) {
          await MLModel.update(active_api_heart_disease_model_id, { is_active: true });
        }
        if (active_api_image_analysis_model_id && models.some((m) => m.id === active_api_image_analysis_model_id)) {
          await MLModel.update(active_api_image_analysis_model_id, { is_active: true });
        }

      } else if (newType === 'local') {
        const activeApiModels = models.filter((m) => m.is_active && !m.model_file_url);
        for (const model of activeApiModels) {
          await MLModel.update(model.id, { is_active: false });
        }

        const { active_local_heart_disease_model_id, active_local_image_analysis_model_id } = setting;
        if (active_local_heart_disease_model_id && models.some((m) => m.id === active_local_heart_disease_model_id)) {
          await MLModel.update(active_local_heart_disease_model_id, { is_active: true });
        }
        if (active_local_image_analysis_model_id && models.some((m) => m.id === active_local_image_analysis_model_id)) {
          await MLModel.update(active_local_image_analysis_model_id, { is_active: true });
        }
      }

      await loadData();

    } catch (error) {
      console.error("Error activating model type:", error);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleToggleActiveLocal = async (modelToActivate) => {
    setLoadingModelId(modelToActivate.id);
    try {
      if (setting?.active_model_type !== 'local') {
        alert("Please activate 'Local Model' mode first to select a specific model.");
        return;
      }

      const newActiveState = !modelToActivate.is_active;

      if (newActiveState) {
        // Get compatible model types - both heart_disease and symptom_analysis are compatible
        const compatibleTypes = ['heart_disease', 'symptom_analysis'];
        const isCompatibleWithHeartDisease = compatibleTypes.includes(modelToActivate.model_type);
        
        if (isCompatibleWithHeartDisease) {
          // Deactivate other heart disease/symptom analysis models
          const modelsOfSameCategory = models.filter((m) => 
            m.model_file_url && 
            compatibleTypes.includes(m.model_type)
          );
          for (const model of modelsOfSameCategory) {
            if (model.id !== modelToActivate.id && model.is_active) {
              await MLModel.update(model.id, { is_active: false });
            }
          }
        } else if (modelToActivate.model_type === 'image_classification') {
          // Deactivate other image classification models
          const modelsOfSameType = models.filter((m) => 
            m.model_type === 'image_classification' && m.model_file_url
          );
          for (const model of modelsOfSameType) {
            if (model.id !== modelToActivate.id && model.is_active) {
              await MLModel.update(model.id, { is_active: false });
            }
          }
        }
      }

      await MLModel.update(modelToActivate.id, { is_active: newActiveState });

      // Update system settings to remember the choice
      const settingUpdate = {};
      const modelIdToSet = newActiveState ? modelToActivate.id : null;

      // Store both heart_disease and symptom_analysis under heart disease setting
      const compatibleWithHeartDisease = ['heart_disease', 'symptom_analysis'].includes(modelToActivate.model_type);
      
      if (compatibleWithHeartDisease) {
        settingUpdate.active_local_heart_disease_model_id = modelIdToSet;
      } else if (modelToActivate.model_type === 'image_classification') {
        settingUpdate.active_local_image_analysis_model_id = modelIdToSet;
      }

      if (Object.keys(settingUpdate).length > 0) {
        await SystemSetting.update(setting.id, settingUpdate);
      }

      await loadData();
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleToggleActiveAPI = async (modelToActivate) => {
    setLoadingModelId(modelToActivate.id);
    try {
      if (setting?.active_model_type !== 'api') {
        alert("Please activate 'API Model' mode first to select a specific model.");
        return;
      }

      const newActiveState = !modelToActivate.is_active;

      if (newActiveState) {
        // Get compatible model types
        const compatibleTypes = ['heart_disease', 'symptom_analysis'];
        const isCompatibleWithHeartDisease = compatibleTypes.includes(modelToActivate.model_type);
        
        if (isCompatibleWithHeartDisease) {
          // Deactivate other heart disease/symptom analysis API models
          const modelsOfSameCategory = models.filter((m) => 
            !m.model_file_url && 
            compatibleTypes.includes(m.model_type)
          );
          for (const model of modelsOfSameCategory) {
            if (model.id !== modelToActivate.id && model.is_active) {
              await MLModel.update(model.id, { is_active: false });
            }
          }
        } else if (modelToActivate.model_type === 'image_classification') {
          // Deactivate other image classification API models
          const modelsOfSameType = models.filter((m) => 
            m.model_type === 'image_classification' && !m.model_file_url
          );
          for (const model of modelsOfSameType) {
            if (model.id !== modelToActivate.id && model.is_active) {
              await MLModel.update(model.id, { is_active: false });
            }
          }
        }
      }

      await MLModel.update(modelToActivate.id, { is_active: newActiveState });

      // Update system settings
      const settingUpdate = {};
      const modelIdToSet = newActiveState ? modelToActivate.id : null;

      const compatibleWithHeartDisease = ['heart_disease', 'symptom_analysis'].includes(modelToActivate.model_type);
      
      if (compatibleWithHeartDisease) {
        settingUpdate.active_api_heart_disease_model_id = modelIdToSet;
      } else if (modelToActivate.model_type === 'image_classification') {
        settingUpdate.active_api_image_analysis_model_id = modelIdToSet;
      }

      if (Object.keys(settingUpdate).length > 0) {
        await SystemSetting.update(setting.id, settingUpdate);
      }

      await loadData();
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleCreateNewModel = async () => {
    if (!modelFile) {
      alert("Please select a model file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      const parsedMockOutput = JSON.parse(newModel.mock_prediction_output);

      const { file_url } = await UploadFile({ file: modelFile });

      if (!file_url) {
        throw new Error("File upload failed. Please try again.");
      }

      await MLModel.create({
        ...newModel,
        model_file_url: file_url,
        accuracy: Number(newModel.accuracy),
        mock_prediction_output: parsedMockOutput
      });

      setIsFormOpen(false);
      setNewModel({
        model_name: "",
        version: "",
        model_type: "heart_disease",
        accuracy: 0,
        description: "",
        model_file_url: "",
        mock_prediction_output: "{\n  \"risk_level\": \"low\",\n  \"risk_score\": 15,\n  \"confidence\": 95,\n  \"predicted_conditions\": [],\n  \"recommendations\": {}\n}"
      });
      setModelFile(null);
      loadData();
    } catch (e) {
      alert("An error occurred: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateAPIModel = async () => {
    try {
      const parsedMockOutput = JSON.parse(newAPIModel.mock_prediction_output);

      await MLModel.create({
        ...newAPIModel,
        accuracy: Number(newAPIModel.accuracy),
        mock_prediction_output: parsedMockOutput,
        model_file_url: "",
        api_endpoint: newAPIModel.api_endpoint,
        api_key: newAPIModel.api_key
      });
      setIsAPIModelFormOpen(false);
      setNewAPIModel({
        model_name: "",
        version: "",
        model_type: "heart_disease",
        accuracy: 0,
        description: "",
        api_endpoint: "",
        api_key: "",
        mock_prediction_output: "{\n  \"risk_level\": \"moderate\",\n  \"risk_score\": 65,\n  \"confidence\": 92,\n  \"predicted_conditions\": [],\n  \"recommendations\": {}\n}"
      });
      loadData();
    } catch (e) {
      alert("Invalid JSON in Mock Prediction Output field. Please correct it.");
    }
  };

  const localModels = models.filter((m) => m.model_file_url);
  const apiModels = models.filter((m) => !m.model_file_url);

  const getActiveModelName = (modelType) => {
    if (!setting) return 'None';
    const isLocal = setting.active_model_type === 'local';
    let modelId;

    if (modelType === 'heart_disease') {
      modelId = isLocal ? setting.active_local_heart_disease_model_id : setting.active_api_heart_disease_model_id;
    } else if (modelType === 'image_classification') {
      modelId = isLocal ? setting.active_local_image_analysis_model_id : setting.active_api_image_analysis_model_id;
    }

    // If we have a specific model ID, try to get it
    if (modelId) {
      const model = models.find((m) => m.id === modelId);
      if (model) return model.model_name;
    }

    // Define compatible types for broader matching
    const compatibleTypes = {
      'heart_disease': ['heart_disease', 'symptom_analysis'], // Accept both types
      'image_classification': ['image_classification']
    };

    const acceptableTypes = compatibleTypes[modelType] || [modelType];
    const isCorrectInfrastructure = isLocal ? (m) => !!m.model_file_url : (m) => !m.model_file_url;

    // Find active models that match the requested analysis type and infrastructure
    const compatibleModel = models.find(m => {
      if (!m.is_active || !isCorrectInfrastructure(m)) return false;

      return acceptableTypes.some(acceptableType => {
        const normalizedModelType = m.model_type?.toLowerCase().replace(/[_\s]/g, '');
        const normalizedAcceptableType = acceptableType.toLowerCase().replace(/[_\s]/g, '');
        return normalizedModelType === normalizedAcceptableType ||
               normalizedModelType.includes(normalizedAcceptableType) ||
               normalizedAcceptableType.includes(normalizedModelType);
      });
    });

    if (compatibleModel) {
      return compatibleModel.model_name;
    }

    // Fallback for API mode with no specific or compatible custom models active
    if (!isLocal && setting.active_model_type === 'api') {
      // Check if any *custom* API model (active or not for specific type) is capable of handling these types
      // The original logic filtered by `is_active` here. Let's keep that as it implies "is any custom model currently in use that handles this type?"
      const activeAPIModels = apiModels.filter((m) => m.is_active);
      const isTypeHandledByCustomAPI = activeAPIModels.some((m) => acceptableTypes.includes(m.model_type));
      return isTypeHandledByCustomAPI ? 'None' : 'Default InvokeLLM';
    }

    // Default fallback if nothing else matches
    return 'None';
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <FullScreenLoader
        isLoading={isLoading || isGlobalLoading || loadingModelId !== null}
        text={isLoading ? "Loading data..." : isGlobalLoading ? "Switching Mode..." : "Activating Model..."} />

      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">ML Model Management</h1>
            <p className="text-lg text-gray-500 mt-1">Control and monitor your AI inference models.</p>
          </div>

          <div className="flex gap-3">
            {currentView === 'local' &&
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Local Model
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload New Local ML Model</DialogTitle>
                    <DialogDescription>Upload your trained model file (.pkl, .h5, .onnx) and provide its details.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                      <Label htmlFor="model_file">Model File (.pkl, .h5, .onnx)</Label>
                      <Input id="model_file" type="file" onChange={handleFileSelect} accept=".pkl,.h5,.onnx" />
                      {modelFile && <p className="text-sm text-gray-500">Selected: {modelFile.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model_name">Model Name</Label>
                      <Input id="model_name" value={newModel.model_name} onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="version">Version</Label>
                      <Input id="version" value={newModel.version} onChange={(e) => setNewModel({ ...newModel, version: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model_type">Model Type</Label>
                      <Select value={newModel.model_type} onValueChange={(val) => setNewModel({ ...newModel, model_type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="heart_disease">Heart Disease (for NewDiagnosis)</SelectItem>
                          <SelectItem value="image_classification">Image Analysis (for ImageAnalysis)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accuracy">Accuracy (%)</Label>
                      <Input type="number" id="accuracy" value={newModel.accuracy} onChange={(e) => setNewModel({ ...newModel, accuracy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" value={newModel.description} onChange={(e) => setNewModel({ ...newModel, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mock_prediction_output">Mock Prediction Output (JSON)</Label>
                      <Textarea
                      id="mock_prediction_output"
                      rows={8}
                      value={newModel.mock_prediction_output}
                      onChange={(e) => setNewModel({ ...newModel, mock_prediction_output: e.target.value })}
                      className="font-mono text-sm" />

                      <p className="text-xs text-gray-500">
                        This JSON is used as a fallback if the real model inference fails.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isUploading}>Cancel</Button>
                    <Button onClick={handleCreateNewModel} disabled={isUploading || !modelFile}>
                      {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : "Create Model"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            }

            {currentView === 'api' &&
            <Dialog open={isAPIModelFormOpen} onOpenChange={setIsAPIModelFormOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Add API Model
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New API Model</DialogTitle>
                    <DialogDescription>Configure a new API-based model with custom endpoint and credentials.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                      <Label htmlFor="api_model_name">Model Name</Label>
                      <Input id="api_model_name" value={newAPIModel.model_name} onChange={(e) => setNewAPIModel({ ...newAPIModel, model_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_version">Version</Label>
                      <Input id="api_version" value={newAPIModel.version} onChange={(e) => setNewAPIModel({ ...newAPIModel, version: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_model_type">Model Type</Label>
                      <Select value={newAPIModel.model_type} onValueChange={(val) => setNewAPIModel({ ...newAPIModel, model_type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="heart_disease">Heart Disease (for NewDiagnosis)</SelectItem>
                          <SelectItem value="image_classification">Image Analysis (for ImageAnalysis)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_accuracy">Accuracy (%)</Label>
                      <Input type="number" id="api_accuracy" value={newAPIModel.accuracy} onChange={(e) => setNewAPIModel({ ...newAPIModel, accuracy: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_endpoint">API Endpoint URL</Label>
                      <Input id="api_endpoint" placeholder="https://api.example.com/predict" value={newAPIModel.api_endpoint} onChange={(e) => setNewAPIModel({ ...newAPIModel, api_endpoint: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key (Optional)</Label>
                      <Input id="api_key" type="password" placeholder="sk-..." value={newAPIModel.api_key} onChange={(e) => setNewAPIModel({ ...newAPIModel, api_key: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_description">Description</Label>
                      <Textarea id="api_description" value={newAPIModel.description} onChange={(e) => setNewAPIModel({ ...newAPIModel, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_mock_output">Mock Prediction Output (JSON)</Label>
                      <Textarea
                      id="api_mock_output"
                      rows={8}
                      value={newAPIModel.mock_prediction_output}
                      onChange={(e) => setNewAPIModel({ ...newAPIModel, mock_prediction_output: e.target.value })}
                      className="font-mono text-sm" />

                      <p className="text-xs text-gray-500">
                        This JSON will be used for simulation when this API model is active.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAPIModelFormOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateAPIModel}>Add API Model</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            }
          </div>
        </div>

        <div className="sticky top-16 bg-slate-50/80 backdrop-blur-lg z-40 py-4 -my-4">
          <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-xl">Model Management & Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Browse Models</Label>
                <div className="p-1 bg-gray-100 rounded-lg flex gap-1">
                  <Button
                    variant={currentView === 'api' ? 'default' : 'ghost'}
                    onClick={() => handleViewChange('api')}
                    className="flex-1"
                    size="sm">
                    <Eye className="w-4 h-4 mr-2" /> View API Models
                  </Button>
                  <Button
                    variant={currentView === 'local' ? 'default' : 'ghost'}
                    onClick={() => handleViewChange('local')}
                    className="flex-1"
                    size="sm">
                    <Eye className="w-4 h-4 mr-2" /> View Local Models
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Browse models without changing active configuration</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Active Model Configuration</Label>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <Power className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">API Model</p>
                        <p className="text-xs text-gray-600">External AI via InvokeLLM</p>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => handleActivateModelType(setting?.active_model_type === 'api' ? 'local' : 'api')}
                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        setting?.active_model_type === 'api' ? 'bg-blue-600' : 'bg-green-600'}`
                        }
                        disabled={isGlobalLoading || setting?.active_model_type === 'local' && !models.some((m) => m.model_file_url)}>
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          setting?.active_model_type === 'api' ? 'translate-x-1' : 'translate-x-9'}`
                          } />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium text-gray-900">Local Model</p>
                        <p className="text-xs text-gray-600">Uploaded ML models</p>
                      </div>
                      <Server className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Toggle to change which model system actually uses for predictions</p>
              </div>

              <Alert className={`border-0 shadow-inner ${setting?.active_model_type === 'api' ? 'bg-blue-50' : 'bg-green-50'}`}>
                <CircleDot className={`h-5 w-5 ${setting?.active_model_type === 'api' ? 'text-blue-500' : 'text-green-500'}`} />
                <AlertDescription>
                  <strong>Currently Active:</strong> <span className="capitalize">{setting?.active_model_type === 'api' ? 'API Models' : 'Local Models'}</span>
                  <br />
                  <span className="text-sm text-gray-600">
                    Heart Disease: {getActiveModelName('heart_disease')} |
                    Image Analysis: {getActiveModelName('image_classification')}
                  </span>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {currentView === 'api' ?
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">API Models</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg font-bold">
                        Default InvokeLLM
                      </CardTitle>
                      <p className="text-sm text-gray-500">Built-in API</p>
                    </div>
                    <Badge className="bg-blue-50 text-blue-500 border-0">
                      <Power className="w-3 h-3 mr-1.5" />
                      API
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 min-h-[40px]">Advanced AI via external API with real-time analysis.</p>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Provider</h5>
                    <p className="text-sm text-blue-700">OpenAI GPT-4 / Claude</p>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50/70 p-4">
                  <div className="w-full text-center">
                    {setting?.active_model_type === 'api' && apiModels.filter((m) => m.is_active).length === 0 ?
                  <Badge className="bg-green-100 text-green-800">Currently Active</Badge> :

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleActivateModelType('api')}
                    disabled={isGlobalLoading || setting?.active_model_type === 'api' && apiModels.filter((m) => m.is_active).length === 0}>
                        Use as Default
                      </Button>
                  }
                  </div>
                </CardFooter>
              </Card>
            </div>

            {apiModels.length > 0 &&
          <>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Custom API Models</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {apiModels.map((model) => {
                const typeInfo = modelTypeInfo[model.model_type] || modelTypeInfo.heart_disease;
                const isActive = setting?.active_model_type === 'api' && model.is_active;

                return (
                  <Card key={model.id} className={`group relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 rounded-2xl overflow-hidden ${typeInfo.bgColor}`}>
                        {isActive &&
                    <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-blue-500 text-white px-3 py-1 rounded-full shadow-lg">
                              <CircleDot className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                    }

                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-xl ${typeInfo.bgColor} border-2 border-white shadow-sm`}>
                                <typeInfo.icon className={`w-8 h-8 ${typeInfo.color}`} />
                              </div>
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-900">
                                  {model.model_name}
                                </CardTitle>
                                <p className="text-sm text-gray-600">v{model.version}</p>
                                <Badge variant="outline" className="mt-1 text-xs">
                                  API Model
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Accuracy</span>
                            <div className="flex items-center gap-2">
                              <Progress value={model.accuracy} className="w-16 h-2" />
                              <span className="text-lg font-bold text-gray-900">{model.accuracy}%</span>
                              {model.accuracy >= 90 && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {model.accuracy < 70 && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Type:</span>
                            <Badge variant="secondary" className="capitalize bg-white/80">
                              {model.model_type.replace('_', ' ')}
                            </Badge>
                          </div>

                          {model.description &&
                      <p className="text-sm text-gray-700 line-clamp-2">{model.description}</p>
                      }

                          {model.api_endpoint &&
                      <div className="p-2 bg-white/60 rounded-lg">
                              <p className="text-xs text-gray-600">API Endpoint:</p>
                              <p className="text-xs font-mono text-gray-800 truncate">
                                {model.api_endpoint}
                              </p>
                            </div>
                      }
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-white/30">
                          <Button
                        variant={isActive ? "default" : "outline"}
                        className={`w-full ${isActive ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        onClick={() => handleToggleActiveAPI(model)}
                        disabled={loadingModelId === model.id || setting?.active_model_type !== 'api'}>
                            <Power className="w-4 h-4 mr-2" />
                            {isActive ? 'Deactivate' : 'Activate'} Model
                          </Button>
                        </CardFooter>
                      </Card>);

              })}
                </div>
              </>
          }
          </div> :

        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Local Trained Models</h2>
            {localModels.length === 0 ?
          <Card className="border-0 shadow-lg">
                <CardContent className="py-12">
                  <div className="text-center">
                    <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Local Models Found</h3>
                    <p className="text-gray-500 mb-6">Upload your first local ML model to get started with offline inference.</p>
                    <Button onClick={() => setIsFormOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Model
                    </Button>
                  </div>
                </CardContent>
              </Card> :

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localModels.map((model) => {
              const typeInfo = modelTypeInfo[model.model_type] || modelTypeInfo.heart_disease;
              const isActive = setting?.active_model_type === 'local' && model.is_active;

              return (
                <Card key={model.id} className={`group relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 rounded-2xl overflow-hidden ${typeInfo.bgColor}`}>
                      {isActive &&
                  <div className="absolute -top-2 -right-2 z-10">
                          <Badge className="px- px- mtext-sm mttext-sm mt-text-sm mt- inline-flex items-center border mt-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-primary/80 bg-green-500 text-white px-4 py-1 rounded-full shadow-lg">
                            <CircleDot className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        </div>
                  }

                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${typeInfo.bgColor} border-2 border-white shadow-sm`}>
                              <typeInfo.icon className={`w-8 h-8 ${typeInfo.color}`} />
                            </div>
                            <div>
                              <CardTitle className="text-gray-900 py-2 text-xl font-bold tracking-tight">
                                {model.model_name}
                              </CardTitle>
                              <p className="text-sm text-gray-600">v{model.version}</p>
                              <Badge variant="outline" className="mt-1 text-xs">
                                Local Model
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Accuracy</span>
                          <div className="flex items-center gap-2">
                            <Progress value={model.accuracy} className="w-16 h-2" />
                            <span className="text-lg font-bold text-gray-900">{model.accuracy}%</span>
                            {model.accuracy >= 90 && <CheckCircle className="w-4 h-4 text-green-500" />}
                            {model.accuracy < 70 && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Type:</span>
                          <Badge variant="secondary" className="capitalize bg-white/80">
                            {model.model_type.replace('_', ' ')}
                          </Badge>
                        </div>

                        {model.description &&
                    <p className="text-sm text-gray-700 line-clamp-2">{model.description}</p>
                    }

                        {model.performance_metrics &&
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/50">
                            <div className="text-center">
                              <p className="text-xs text-gray-600">Precision</p>
                              <p className="font-bold text-sm">{(model.performance_metrics.precision * 100).toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600">Recall</p>
                              <p className="font-bold text-sm">{(model.performance_metrics.recall * 100).toFixed(1)}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600">F1</p>
                              <p className="font-bold text-sm">{(model.performance_metrics.f1_score * 100).toFixed(1)}%</p>
                            </div>
                          </div>
                    }

                        {model.model_file_url &&
                    <div className="p-2 bg-white/60 rounded-lg">
                            <p className="text-xs text-gray-600">Model File:</p>
                            <p className="text-xs font-mono text-gray-800 truncate">
                              {model.model_file_url.split('/').pop()}
                            </p>
                          </div>
                    }
                      </CardContent>

                      <CardFooter className="pt-4 border-t border-white/30">
                        <Button
                      variant={isActive ? "default" : "outline"}
                      className={`w-full ${isActive ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => handleToggleActiveLocal(model)}
                      disabled={loadingModelId === model.id || setting?.active_model_type !== 'local'}>
                          <Power className="w-4 h-4 mr-2" />
                          {isActive ? 'Deactivate' : 'Activate'} Model
                        </Button>
                      </CardFooter>
                    </Card>);

            })}
              </div>
          }
          </div>
        }
      </div>
    </div>);

}
