import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Droplets, 
  ThermometerSun, 
  History, 
  Camera, 
  Upload, 
  ChevronRight, 
  Leaf, 
  User, 
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Save,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeSoil, detectPest, saveRecord, getRecords, predictHumidity } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'soil' | 'health' | 'history'>('soil');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [showHumidityPredictor, setShowHumidityPredictor] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionData, setPredictionData] = useState({
    location: '',
    neighborCrops: '',
    currentWeather: ''
  });
  
  // Soil Form State
  const [soilData, setSoilData] = useState({
    ph: '7',
    humidity: '50',
    season: 'Summer',
    water: 'Moderate',
    isBeginner: false,
    landSize: '1'
  });

  const [errors, setErrors] = useState({
    ph: '',
    humidity: ''
  });

  const validatePh = (val: string) => {
    if (val === "") return "pH is required";
    const num = parseFloat(val);
    if (isNaN(num)) return "Invalid number";
    if (num < 0 || num > 14) return "pH must be between 0 and 14";
    return "";
  };

  const validateHumidity = (val: string) => {
    if (val === "") return "Humidity is required";
    const num = parseInt(val);
    if (isNaN(num)) return "Invalid number";
    if (num < 0 || num > 100) return "Humidity must be between 0 and 100";
    return "";
  };

  // Health State
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await getRecords();
    setRecords(data);
  };

  const handleSoilSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const aiResult = await analyzeSoil({
        ...soilData,
        ph: parseFloat(soilData.ph) || 7,
        humidity: parseInt(soilData.humidity) || 50,
        landSize: parseFloat(soilData.landSize) || 1,
        waterAvailability: soilData.water,
        history: records
      });
      setResult(aiResult || "No analysis generated.");
      await saveRecord('soil', {
        ...soilData,
        ph: parseFloat(soilData.ph) || 7,
        humidity: parseInt(soilData.humidity) || 50,
        landSize: parseFloat(soilData.landSize) || 1,
      }, aiResult || "");
      loadHistory();
    } catch (error) {
      console.error(error);
      setResult("Error analyzing soil. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHealthSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setResult(null);
    try {
      const aiResult = await detectPest(image);
      setResult(aiResult || "No diagnosis generated.");
      await saveRecord('health', { image: 'Image uploaded' }, aiResult || "");
      loadHistory();
    } catch (error) {
      console.error(error);
      setResult("Error diagnosing plant health. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePredictHumidity = async (e: React.FormEvent) => {
    e.preventDefault();
    setPredictionLoading(true);
    try {
      const predicted = await predictHumidity(predictionData);
      setSoilData({ ...soilData, humidity: String(predicted) });
      setShowHumidityPredictor(false);
    } catch (error) {
      console.error(error);
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    const element = document.createElement("a");
    const file = new Blob([result], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `AgroTech-Analysis-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const extractWateringSchedule = (text: string) => {
    const startMarker = "### WATERING_SCHEDULE_START";
    const endMarker = "### WATERING_SCHEDULE_END";
    const startIndex = text.indexOf(startMarker);
    const endIndex = text.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
      return text.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return null;
  };

  const extractPersonalizedTips = (text: string) => {
    const startMarker = "### PERSONALIZED_TIPS_START";
    const endMarker = "### PERSONALIZED_TIPS_END";
    const startIndex = text.indexOf(startMarker);
    const endIndex = text.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
      return text.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return null;
  };

  const cleanResult = (text: string) => {
    const markers = [
      ["### WATERING_SCHEDULE_START", "### WATERING_SCHEDULE_END"],
      ["### PERSONALIZED_TIPS_START", "### PERSONALIZED_TIPS_END"]
    ];

    let cleaned = text;
    markers.forEach(([start, end]) => {
      const startIndex = cleaned.indexOf(start);
      const endIndex = cleaned.indexOf(end);
      if (startIndex !== -1 && endIndex !== -1) {
        const before = cleaned.substring(0, startIndex);
        const after = cleaned.substring(endIndex + end.length);
        cleaned = (before + after).trim();
      }
    });
    
    return cleaned
      .replace(/### WATERING_SCHEDULE_START/g, "")
      .replace(/### WATERING_SCHEDULE_END/g, "")
      .replace(/### PERSONALIZED_TIPS_START/g, "")
      .replace(/### PERSONALIZED_TIPS_END/g, "")
      .trim();
  };

  return (
    <div className="min-h-screen flex flex-col bg-earth-100">
      {/* Header */}
      <header className="bg-earth-200/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shadow-2xl shadow-black/50">
              <img 
                src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=200" 
                alt="AgroTech Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold serif tracking-tight text-white leading-none mb-1">AgroTech</h1>
              <div className="flex items-center gap-2">
                <span className="h-px w-4 bg-emerald-500/30"></span>
                <p className="text-[9px] uppercase tracking-[0.3em] font-black text-emerald-400">GreenBytes</p>
              </div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => setActiveTab('soil')}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === 'soil' ? "text-emerald-400" : "text-gray-500 hover:text-gray-300")}
            >
              Soil Analysis
            </button>
            <button 
              onClick={() => setActiveTab('health')}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === 'health' ? "text-emerald-400" : "text-gray-500 hover:text-gray-300")}
            >
              Plant Health
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === 'history' ? "text-emerald-400" : "text-gray-500 hover:text-gray-300")}
            >
              History
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-earth-300 border border-white/5 flex items-center justify-center text-emerald-400">
              <User size={20} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 relative">
        {/* Subtle background gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.03),transparent_50%)] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Left Column: Input Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-earth-200 rounded-3xl p-8 border border-white/5 card-hover">
              <div className="flex items-center gap-2 mb-8">
                {activeTab === 'soil' && <ThermometerSun className="text-emerald-400" />}
                {activeTab === 'health' && <Camera className="text-emerald-400" />}
                {activeTab === 'history' && <History className="text-emerald-400" />}
                <h2 className="text-xl font-bold serif text-white">
                  {activeTab === 'soil' ? 'Soil Parameters' : activeTab === 'health' ? 'Plant Health Check' : 'Recent Activity'}
                </h2>
              </div>

              {activeTab === 'soil' && (
                <form onSubmit={handleSoilSubmit} className="space-y-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 shadow-sm hover:border-emerald-500/20 transition-all">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 block">Soil Chemistry</span>
                          <span className={cn(
                            "text-[10px] font-bold px-3 py-1 rounded-full mono uppercase tracking-wider",
                            parseFloat(soilData.ph) < 6 ? "bg-red-500/10 text-red-400" : parseFloat(soilData.ph) > 8 ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                          )}>
                            {parseFloat(soilData.ph) < 6 ? 'Acidic' : parseFloat(soilData.ph) > 8 ? 'Alkaline' : 'Normal'}
                          </span>
                        </div>
                        <label className="block">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-gray-400">pH Level</span>
                          </div>
                          <input 
                            type="number" min="0" max="14" step="0.1" 
                            value={soilData.ph}
                            onChange={(e) => {
                              const val = e.target.value;
                              const error = validatePh(val);
                              setErrors(prev => ({ ...prev, ph: error }));
                              setSoilData({...soilData, ph: val});
                            }}
                            className={cn(
                              "w-full bg-earth-400 rounded-xl py-3 px-4 text-white input-focus text-sm transition-all border border-transparent",
                              errors.ph ? "border-red-500/50 focus:border-red-500" : "focus:border-emerald-500/30"
                            )}
                            placeholder="Enter pH (0-14)"
                          />
                          <p className="text-[9px] text-gray-500 mt-3 italic leading-relaxed">Note: Soil pH is usually between 0 (acidic) and 14 (alkaline).</p>
                          {errors.ph && (
                            <motion.p 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-[10px] text-red-400 mt-2 font-bold flex items-center gap-1"
                            >
                              <AlertCircle size={10} /> {errors.ph}
                            </motion.p>
                          )}
                        </label>
                      </div>

                      <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 shadow-sm hover:border-emerald-500/20 transition-all">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 block">Moisture Content</span>
                          <button 
                            type="button"
                            onClick={() => setShowHumidityPredictor(!showHumidityPredictor)}
                            className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/5 px-2 py-1 rounded-md"
                          >
                            {showHumidityPredictor ? "Manual" : "AI Predict"}
                          </button>
                        </div>

                        <AnimatePresence mode="wait">
                          {!showHumidityPredictor ? (
                            <motion.div 
                              key="manual"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-gray-400">Humidity (%)</span>
                                <span className="text-xs font-bold text-emerald-400 mono">{soilData.humidity}%</span>
                              </div>
                              <input 
                                type="number" min="0" max="100" 
                                value={soilData.humidity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const error = validateHumidity(val);
                                  setErrors(prev => ({ ...prev, humidity: error }));
                                  setSoilData({...soilData, humidity: val});
                                }}
                                className={cn(
                                  "w-full bg-earth-400 rounded-xl py-3 px-4 text-white input-focus text-sm transition-all border border-transparent",
                                  errors.humidity ? "border-red-500/50 focus:border-red-500" : "focus:border-emerald-500/30"
                                )}
                                placeholder="Enter Humidity (0-100)"
                              />
                              <p className="text-[9px] text-gray-500 mt-3 italic leading-relaxed">Note: Humidity is measured from 0% to 100%.</p>
                              {errors.humidity && (
                                <motion.p 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="text-[10px] text-red-400 mt-2 font-bold flex items-center gap-1"
                                >
                                  <AlertCircle size={10} /> {errors.humidity}
                                </motion.p>
                              )}
                            </motion.div>
                          ) : (
                          <motion.div 
                            key="predictor"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-3"
                          >
                            <input 
                              type="text"
                              placeholder="Land Location (e.g. Maharashtra, India)"
                              value={predictionData.location}
                              onChange={(e) => setPredictionData({...predictionData, location: e.target.value})}
                              className="w-full bg-earth-400 rounded-xl py-2 px-3 text-xs text-white input-focus"
                            />
                            <input 
                              type="text"
                              placeholder="What are neighbors growing?"
                              value={predictionData.neighborCrops}
                              onChange={(e) => setPredictionData({...predictionData, neighborCrops: e.target.value})}
                              className="w-full bg-earth-400 rounded-xl py-2 px-3 text-xs text-white input-focus"
                            />
                            <input 
                              type="text"
                              placeholder="Current Weather (e.g. Cloudy, Hot)"
                              value={predictionData.currentWeather}
                              onChange={(e) => setPredictionData({...predictionData, currentWeather: e.target.value})}
                              className="w-full bg-earth-400 rounded-xl py-2 px-3 text-xs text-white input-focus"
                            />
                            <button 
                              type="button"
                              onClick={handlePredictHumidity}
                              disabled={predictionLoading}
                              className="w-full bg-emerald-600/20 text-emerald-400 font-bold text-[10px] py-2 rounded-lg border border-emerald-500/20 hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
                            >
                              {predictionLoading ? <Loader2 className="animate-spin w-3 h-3" /> : <Droplets size={12} />}
                              Predict Humidity with AI
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 shadow-sm">
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mb-3 block">Season</span>
                          <select 
                            value={soilData.season}
                            onChange={(e) => setSoilData({...soilData, season: e.target.value})}
                            className="block w-full rounded-xl border border-transparent bg-earth-400 text-sm py-3 px-4 text-white focus:border-emerald-500/30 transition-all outline-none"
                          >
                            <option>Summer</option>
                            <option>Monsoon</option>
                            <option>Winter</option>
                            <option>Spring</option>
                          </select>
                        </label>
                      </div>
                      <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 shadow-sm">
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 mb-3 block">Water Supply</span>
                          <select 
                            value={soilData.water}
                            onChange={(e) => setSoilData({...soilData, water: e.target.value})}
                            className="block w-full rounded-xl border border-transparent bg-earth-400 text-sm py-3 px-4 text-white focus:border-emerald-500/30 transition-all outline-none"
                          >
                            <option>Scant</option>
                            <option>Moderate</option>
                            <option>Abundant</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <label className="flex items-center gap-4 cursor-pointer group p-4 rounded-2xl bg-earth-300/50 border border-white/5 hover:bg-earth-300 transition-all">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={soilData.isBeginner}
                            onChange={(e) => setSoilData({...soilData, isBeginner: e.target.checked})}
                            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-white/10 transition-all checked:border-emerald-500 checked:bg-emerald-500"
                          />
                          <CheckCircle2 className="absolute h-4 w-4 text-black opacity-0 peer-checked:opacity-100" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">Beginner Mode</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Get seed quantity & basic help</span>
                        </div>
                      </label>
                    </div>

                    {soilData.isBeginner && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-inner"
                      >
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3 block">Land Size (Hectares)</span>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={soilData.landSize}
                              onChange={(e) => setSoilData({...soilData, landSize: e.target.value})}
                              className="block w-full rounded-xl border border-transparent bg-earth-400 text-sm py-4 px-5 pr-12 text-white focus:border-emerald-500/30 transition-all outline-none"
                              placeholder="e.g. 2.5"
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-500/50 mono">ha</span>
                          </div>
                        </label>
                      </motion.div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || !!errors.ph || !!errors.humidity}
                    className="w-full bg-emerald-600 text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Sprout size={18} />}
                    Generate Farming Plan
                  </button>
                </form>
              )}

              {activeTab === 'health' && (
                <div className="space-y-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-3xl border-2 border-dashed border-white/10 bg-earth-300 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-earth-400 transition-colors overflow-hidden relative group"
                  >
                    {image ? (
                      <>
                        <img src={image} alt="Upload" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <p className="text-emerald-400 font-black uppercase tracking-widest text-xs">Change Photo</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-earth-400 flex items-center justify-center text-emerald-400 shadow-xl">
                          <Camera size={32} />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-white">Capture Crop Issue</p>
                          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Upload leaf or pest photo</p>
                        </div>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />

                  <button 
                    onClick={handleHealthSubmit}
                    disabled={loading || !image}
                    className="w-full bg-emerald-600 text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Leaf size={18} />}
                    Diagnose Health
                  </button>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {records.length === 0 ? (
                    <div className="text-center py-20">
                      <History className="mx-auto text-white/5 mb-4" size={64} />
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No records found yet</p>
                    </div>
                  ) : (
                    records.map((record) => (
                      <div 
                        key={record.id}
                        onClick={() => setResult(record.result)}
                        className="p-5 rounded-2xl border border-white/5 bg-earth-300 hover:bg-earth-400 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full",
                            record.type === 'soil' ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                          )}>
                            {record.type}
                          </span>
                          <span className="text-[10px] text-gray-500 mono">
                            {new Date(record.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-200 line-clamp-1">
                          {record.type === 'soil' ? `pH ${record.data.ph} • ${record.data.season}` : 'Plant Health Diagnosis'}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-3 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          View Analysis <ArrowRight size={10} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Farming Tips Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950 rounded-3xl p-8 text-white relative overflow-hidden border border-emerald-500/10 shadow-2xl shadow-black/20"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Leaf size={16} />
                  </div>
                  <h3 className="text-lg font-bold serif text-emerald-400">Farming Tips</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed italic">
                  {records.length > 0 
                    ? `Based on your last ${records[0].type} check: Try rotating crops like beans or peas to naturally fix soil nutrients for your next ${records[0].data?.season || 'season'}.`
                    : "Planting beans or peas after other crops helps the soil stay healthy. It adds natural food for plants so you don't need to buy as much chemical spray."
                  }
                </p>
                {records.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/50">Personalized for you</span>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View History
                    </button>
                  </div>
                )}
              </div>
              <Sprout className="absolute -bottom-6 -right-6 text-emerald-900/10 w-40 h-40 rotate-12" />
            </motion.div>
          </div>

          {/* Right Column: Results Panel */}
          <div className="lg:col-span-7">
            <div className="bg-earth-200 rounded-3xl border border-white/5 min-h-[600px] flex flex-col overflow-hidden shadow-2xl shadow-black/40">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-earth-300/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-xl font-bold serif text-white">AI Farmer Analysis</h2>
                </div>
                {result && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleSave}
                      className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      title="Save to History"
                    >
                      <Save size={14} /> <span className="hidden sm:inline">Save</span>
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="p-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                      title="Print Report"
                    >
                      <Download size={14} /> <span className="hidden sm:inline">Print</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-8 sm:p-12 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      className="h-full flex flex-col items-center justify-center text-center space-y-8"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_30px_rgba(16,185,129,0.1)]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sprout className="w-8 h-8 text-emerald-400 animate-bounce" />
                        </div>
                      </div>
                      <div className="max-w-xs">
                        <p className="font-black text-white uppercase tracking-[0.3em] text-xs">Consulting AI Farmer</p>
                        <p className="text-xs text-gray-500 mt-3 leading-relaxed">Analyzing soil patterns, history, and environmental data to craft your plan...</p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="markdown-body prose prose-invert prose-emerald max-w-none">
                        <Markdown>{cleanResult(result)}</Markdown>
                      </div>

                      {extractWateringSchedule(result) && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                              <Droplets size={20} className="animate-pulse" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white serif">Your Watering Schedule</h3>
                              <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-black">Daily Simple Plan</p>
                            </div>
                          </div>
                          <div className="markdown-body text-sm bg-black/20 rounded-xl p-4 border border-white/5">
                            <Markdown>{extractWateringSchedule(result)}</Markdown>
                          </div>
                        </motion.div>
                      )}

                      {extractPersonalizedTips(result) && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                              <Leaf size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white serif">Personalized Farming Tips</h3>
                              <p className="text-[10px] uppercase tracking-widest text-amber-500/60 font-black">Based on your history</p>
                            </div>
                          </div>
                          <div className="markdown-body text-sm bg-black/20 rounded-xl p-4 border border-white/5">
                            <Markdown>{extractPersonalizedTips(result)}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-sm mx-auto"
                    >
                      <div className="w-24 h-24 rounded-full bg-earth-300 flex items-center justify-center text-emerald-500/20 shadow-inner">
                        <Info size={48} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-3 serif">Ready to Grow?</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          Enter your soil parameters or upload a photo of your crops to get personalized AI-driven farming advice.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 text-left">
                          <Droplets className="text-emerald-500 mb-3" size={24} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Watering</p>
                          <p className="text-xs font-bold text-white mt-1">Precise Schedules</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-earth-300 border border-white/5 text-left">
                          <AlertCircle className="text-emerald-500 mb-3" size={24} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pests</p>
                          <p className="text-xs font-bold text-white mt-1">Instant Diagnosis</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Branding */}
              <div className="p-5 bg-earth-300/50 border-t border-white/5 text-center">
                <p className="text-[9px] font-black text-gray-600 tracking-[0.4em] uppercase">
                  GreenBytes AMD Hackathon
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-earth-200/90 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-3xl flex justify-between items-center z-50 shadow-2xl shadow-black">
        <button 
          onClick={() => setActiveTab('soil')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'soil' ? "text-emerald-400 scale-110" : "text-gray-500")}
        >
          <Sprout size={22} />
          <span className="text-[9px] font-black uppercase tracking-widest">Soil</span>
        </button>
        <button 
          onClick={() => setActiveTab('health')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'health' ? "text-emerald-400 scale-110" : "text-gray-500")}
        >
          <Camera size={22} />
          <span className="text-[9px] font-black uppercase tracking-widest">Health</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn("flex flex-col items-center gap-1.5 transition-all", activeTab === 'history' ? "text-emerald-400 scale-110" : "text-gray-500")}
        >
          <History size={22} />
          <span className="text-[9px] font-black uppercase tracking-widest">History</span>
        </button>
      </div>
    </div>

  );
}
