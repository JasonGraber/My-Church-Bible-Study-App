
import React, { useState, useRef, useEffect } from 'react';
import { UserSettings, AppView, SermonStudy } from '../types';
import { generateBibleStudy, processBulletin } from '../services/geminiService';
import { saveStudy, saveBulletin } from '../services/storageService';
import { calculateDistance, getCurrentLocation, GEOFENCE_RADIUS_METERS } from '../services/geoService';

interface RecordViewProps {
  settings: UserSettings;
  onStudyGenerated: (study: SermonStudy) => void;
  setView: (view: AppView) => void;
  initialAction?: 'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT' | 'SCAN_BULLETIN' | null;
}

type ProcessingStep = 'IDLE' | 'OPTIMIZING' | 'ANALYZING' | 'RESEARCHING' | 'FINALIZING';

const RecordView: React.FC<RecordViewProps> = ({ settings, onStudyGenerated, setView, initialAction }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('IDLE');
  const [error, setError] = useState<{message: string, detail?: string} | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Checking location...");
  const [isInChurch, setIsInChurch] = useState(false);
  
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageMode, setImageMode] = useState<'STUDY' | 'BULLETIN'>('STUDY');
  
  const [transcriptInput, setTranscriptInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageGalleryRef = useRef<HTMLInputElement>(null);
  const imageCameraRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialAction) return;
    const timer = setTimeout(() => {
        if (initialAction === 'UPLOAD_AUDIO') fileInputRef.current?.click();
        else if (initialAction === 'SCAN_NOTES') initiateImageCapture('STUDY');
        else if (initialAction === 'PASTE_TEXT') setShowTranscriptModal(true);
        else if (initialAction === 'SCAN_BULLETIN') initiateImageCapture('BULLETIN');
    }, 100);
    return () => clearTimeout(timer);
  }, [initialAction]);

  useEffect(() => {
    if (!settings.geofenceEnabled || !settings.churchLocation) {
      setGeoStatus("Geofencing disabled");
      return;
    }
    const checkLocation = async () => {
      try {
        const current = await getCurrentLocation();
        const distance = calculateDistance(current, settings.churchLocation!);
        if (distance <= GEOFENCE_RADIUS_METERS) {
          setIsInChurch(true);
          setGeoStatus(`At ${settings.churchName || 'Church'}! (${Math.round(distance)}m)`);
        } else {
          setIsInChurch(false);
          setGeoStatus(`Away from church (${Math.round(distance)}m)`);
        }
      } catch (e) {
        setGeoStatus("Location unavailable");
      }
    };
    const interval = setInterval(checkLocation, 10000); 
    checkLocation();
    return () => clearInterval(interval);
  }, [settings]);

  useEffect(() => {
      return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, []);

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200; 
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { resolve(blob || file); }, 'image/jpeg', 0.85);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const startProcessing = (step: ProcessingStep = 'ANALYZING') => {
      setIsProcessing(true);
      setProcessingStep(step);
      setError(null);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
          if (isProcessing) {
              handleError("Processing Timeout", "The server is taking too long to respond. Don't worry, your data might still be processing in the background.");
              setIsProcessing(false);
          }
      }, 120000); // 2 minute timeout for Gemini
  };

  const handleError = (msg: string, detail?: string) => {
      setError({ message: msg, detail });
      setIsProcessing(false);
      setProcessingStep('IDLE');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startProcessing('ANALYZING');
    try {
        const newStudy = await generateBibleStudy({ audioBlob: file }, settings);
        setProcessingStep('FINALIZING');
        await saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err: any) {
        handleError("Audio Processing Failed", err.message);
    } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initiateImageCapture = (mode: 'STUDY' | 'BULLETIN') => {
      setImageMode(mode);
      setShowImageOptions(true);
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setShowImageOptions(false);
      const newImages = Array.from(files) as File[];
      setSelectedImages(prev => [...prev, ...newImages]);
      setShowImagePreview(true);
      if (imageGalleryRef.current) imageGalleryRef.current.value = '';
      if (imageCameraRef.current) imageCameraRef.current.value = '';
  };

  const removeImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessImages = async () => {
      if (selectedImages.length === 0) return;
      setShowImagePreview(false);
      startProcessing('OPTIMIZING');
      try {
          const processedImages = await Promise.all(selectedImages.map(img => resizeImage(img)));
          setProcessingStep('ANALYZING');
          if (imageMode === 'STUDY') {
            const newStudy = await generateBibleStudy({ images: processedImages }, settings);
            setProcessingStep('FINALIZING');
            await saveStudy(newStudy);
            onStudyGenerated(newStudy);
            setView(AppView.STUDY_DETAIL);
          } else {
             const bulletin = await processBulletin(processedImages);
             setProcessingStep('FINALIZING');
             await saveBulletin(bulletin);
             setView(AppView.EVENTS);
          }
      } catch (err: any) {
          handleError("Recognition Failed", err.message);
      } finally {
          setIsProcessing(false);
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          if (!error) setSelectedImages([]); 
      }
  }

  const handleTranscriptSubmit = async () => {
    if (!transcriptInput.trim()) return;
    setShowTranscriptModal(false);
    startProcessing('RESEARCHING');
    try {
        const newStudy = await generateBibleStudy({ text: transcriptInput }, settings);
        setProcessingStep('FINALIZING');
        await saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err: any) {
        handleError("Study Generation Failed", err.message);
    } finally {
         setIsProcessing(false);
    }
  };

  const stepMessages: Record<ProcessingStep, string> = {
      IDLE: "",
      OPTIMIZING: "Optimizing Images...",
      ANALYZING: "Reading Notes...",
      RESEARCHING: "Crafting Study Plan...",
      FINALIZING: "Saving Locally..."
  };

  const stepProgress: Record<ProcessingStep, number> = {
      IDLE: 0,
      OPTIMIZING: 20,
      ANALYZING: 40,
      RESEARCHING: 70,
      FINALIZING: 95
  };

  return (
    <div className="flex flex-col items-center h-full px-6 py-8 pb-24 space-y-6 relative overflow-y-auto no-scrollbar">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
      <input type="file" ref={imageGalleryRef} onChange={handleImageSelect} accept="image/*" multiple className="hidden" />
      <input type="file" ref={imageCameraRef} onChange={handleImageSelect} accept="image/*" capture="environment" className="hidden" />

      <div className="text-center space-y-2 mt-4">
        <h1 className="text-3xl font-serif font-bold text-white">My Church Bible Study</h1>
        <p className="text-gray-400 text-sm">Create a new study from this week's message.</p>
      </div>

      {settings.churchName && (
        <div className="w-full max-md">
            <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="mb-4">
                        <div className="flex items-center mb-1">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Home Church</span>
                        </div>
                        <h2 className="text-xl font-serif font-bold text-white leading-tight">{settings.churchName}</h2>
                    </div>
                     <div className="bg-gray-900/60 p-2 rounded-xl border border-gray-700/50 flex items-center space-x-2">
                        <span className={`h-2 w-2 rounded-full ${isInChurch ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                        <span className="text-xs text-gray-400">{isInChurch ? "You are here" : "Away from church"}</span>
                     </div>
                </div>
            </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-4">
          <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg">
             <div className="h-14 w-14 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></div>
             <div><h3 className="font-bold text-white text-lg">Upload Audio</h3><p className="text-sm text-gray-400">Use a recording or voice memo</p></div>
          </button>
          <button onClick={() => initiateImageCapture('STUDY')} disabled={isProcessing} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg">
             <div className="h-14 w-14 rounded-full bg-blue-900/20 text-blue-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
             <div><h3 className="font-bold text-white text-lg">Scan Notes</h3><p className="text-sm text-gray-400">Take photos of your sermon notes</p></div>
          </button>
          <button onClick={() => setShowTranscriptModal(true)} disabled={isProcessing} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg">
             <div className="h-14 w-14 rounded-full bg-purple-900/20 text-purple-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
             <div><h3 className="font-bold text-white text-lg">Paste Text</h3><p className="text-sm text-gray-400">Paste notes or a transcript</p></div>
          </button>
      </div>

      {isProcessing && (
           <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-6">
                <div className="bg-gray-800 p-8 rounded-3xl flex flex-col items-center shadow-2xl border border-gray-700 max-w-sm w-full animate-slide-up">
                    <div className="relative h-24 w-24 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold text-purple-400">{stepProgress[processingStep]}%</span></div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{stepMessages[processingStep]}</h3>
                    <p className="text-gray-400 text-sm text-center mb-6">Working with Gemini AI to craft your study.</p>
                </div>
           </div>
       )}

      {error && (
          <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6">
              <div className="bg-gray-800 p-8 rounded-3xl flex flex-col items-center shadow-2xl border border-red-900/50 max-w-sm w-full animate-slide-up">
                  <div className="h-16 w-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                  <h3 className="text-xl font-bold text-white mb-2">{error.message}</h3>
                  <p className="text-gray-400 text-sm text-center mb-6">{error.detail}</p>
                  <button onClick={() => setError(null)} className="w-full bg-gray-700 text-white font-bold py-3 rounded-xl">Try Again</button>
              </div>
          </div>
      )}

      {showImageOptions && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[70] sm:items-center">
            <div className="w-full max-w-sm p-4 space-y-3 animate-slide-up sm:animate-none">
                <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
                    <div className="p-4 text-center border-b border-gray-700"><h3 className="text-sm font-bold text-gray-400">{imageMode === 'STUDY' ? "Add Sermon Notes" : "Scan Bulletin"}</h3></div>
                    <button onClick={() => imageCameraRef.current?.click()} className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700 border-b border-gray-700">Take Photo</button>
                    <button onClick={() => imageGalleryRef.current?.click()} className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700">Choose from Gallery</button>
                </div>
                <button onClick={() => setShowImageOptions(false)} className="w-full py-4 bg-gray-800 rounded-2xl font-bold text-white border border-gray-700">Cancel</button>
            </div>
        </div>
      )}

      {showImagePreview && (
          <div className="fixed inset-0 bg-black/95 flex flex-col z-[60]">
              <div className="flex justify-between items-center p-4 border-b border-gray-800"><h3 className="text-white font-bold">Review Notes</h3><button onClick={() => { setShowImagePreview(false); setSelectedImages([]); }} className="text-gray-400 text-sm">Cancel</button></div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                  {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-[3/4] bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                          <img src={URL.createObjectURL(img)} alt={`scan-${idx}`} className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 bg-red-600/90 text-white rounded-full p-1.5 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                  ))}
                  <button onClick={() => setShowImageOptions(true)} className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 bg-gray-900"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span className="text-xs font-bold">Add Page</span></button>
              </div>
              <div className="p-4 border-t border-gray-800 bg-gray-900"><button onClick={handleProcessImages} disabled={selectedImages.length === 0} className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-lg hover:bg-purple-700 shadow-lg">{imageMode === 'STUDY' ? 'Create Bible Study' : 'Digitize Bulletin'}</button></div>
          </div>
      )}

      {showTranscriptModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
              <div className="bg-gray-800 w-full max-w-lg rounded-3xl border border-gray-700 shadow-2xl overflow-hidden animate-slide-up">
                  <div className="p-6 border-b border-gray-700"><h3 className="text-xl font-bold text-white">Paste Transcript</h3><p className="text-gray-400 text-sm mt-1">Paste your sermon notes or a message transcript.</p></div>
                  <div className="p-6"><textarea value={transcriptInput} onChange={(e) => setTranscriptInput(e.target.value)} placeholder="Start typing or paste here..." className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 text-white text-sm focus:border-purple-500 focus:outline-none min-h-[250px] resize-none" /></div>
                  <div className="p-6 pt-0 flex space-x-3"><button onClick={() => setShowTranscriptModal(false)} className="flex-1 py-3 bg-gray-700 rounded-xl text-white font-medium">Cancel</button><button onClick={handleTranscriptSubmit} disabled={!transcriptInput.trim()} className="flex-1 py-3 bg-purple-600 rounded-xl text-white font-bold hover:bg-purple-700 disabled:opacity-50">Create Study</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default RecordView;
