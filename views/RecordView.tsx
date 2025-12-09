
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

const RecordView: React.FC<RecordViewProps> = ({ settings, onStudyGenerated, setView, initialAction }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Checking location...");
  const [isInChurch, setIsInChurch] = useState(false);
  
  // Manual Upload State
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageMode, setImageMode] = useState<'STUDY' | 'BULLETIN'>('STUDY');
  
  const [transcriptInput, setTranscriptInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageGalleryRef = useRef<HTMLInputElement>(null);
  const imageCameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialAction) return;
    const timer = setTimeout(() => {
        if (initialAction === 'UPLOAD_AUDIO') {
            fileInputRef.current?.click();
        } else if (initialAction === 'SCAN_NOTES') {
            initiateImageCapture('STUDY');
        } else if (initialAction === 'PASTE_TEXT') {
            setShowTranscriptModal(true);
        } else if (initialAction === 'SCAN_BULLETIN') {
            initiateImageCapture('BULLETIN');
        }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
        const newStudy = await generateBibleStudy({ audioBlob: file }, settings);
        // Note: originalAudioDuration will be 0 as we don't parse it client-side easily here, 
        // but that's fine for the generated study.
        await saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err: any) {
        console.error(err);
        if (err.message && err.message.includes("database")) {
           setError("Study generated but failed to save to database.");
        } else {
           setError("Failed to process file. Ensure it is a valid audio file.");
        }
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
      setIsProcessing(true);
      setError(null);
      try {
          if (imageMode === 'STUDY') {
            const newStudy = await generateBibleStudy({ images: selectedImages }, settings);
            await saveStudy(newStudy);
            onStudyGenerated(newStudy);
            setView(AppView.STUDY_DETAIL);
          } else {
             const bulletin = await processBulletin(selectedImages);
             await saveBulletin(bulletin);
             setView(AppView.EVENTS);
          }
      } catch (err: any) {
          console.error(err);
          if (err.message && err.message.includes("database")) {
              setError("Content generated but failed to save to database.");
          } else {
              setError(imageMode === 'STUDY' ? "Failed to generate study from notes." : "Failed to parse bulletin.");
          }
          setShowImagePreview(true); 
      } finally {
          setIsProcessing(false);
          if (!error) setSelectedImages([]); 
      }
  }

  const handleTranscriptSubmit = async () => {
    if (!transcriptInput.trim()) return;
    setShowTranscriptModal(false);
    setIsProcessing(true);
    setError(null);
    try {
        const newStudy = await generateBibleStudy({ text: transcriptInput }, settings);
        await saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err: any) {
        console.error(err);
         if (err.message && err.message.includes("database")) {
            setError("Study generated but failed to save to database.");
         } else {
            setError("Failed to process transcript.");
         }
    } finally {
         setIsProcessing(false);
         setTranscriptInput("");
    }
  };

  const simulateArrival = () => {
      setIsInChurch(true);
      setGeoStatus("Simulated: At Church");
  };

  return (
    <div className="flex flex-col items-center h-full px-6 py-8 pb-24 space-y-6 relative overflow-y-auto">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" className="hidden" />
      <input type="file" ref={imageGalleryRef} onChange={handleImageSelect} accept="image/*" multiple className="hidden" />
      <input type="file" ref={imageCameraRef} onChange={handleImageSelect} accept="image/*" capture="environment" className="hidden" />

      {/* Header */}
      <div className="text-center space-y-2 mt-4">
        <h1 className="text-3xl font-serif font-bold text-white">My Church Bible Study</h1>
        <p className="text-gray-400 text-sm">Create a new study from this week's message.</p>
      </div>

      {/* Location Status / Home Church Card */}
      {settings.churchName ? (
        <div className="w-full max-w-md">
            <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                 {/* Decorative background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163l-4 3.316v13.358h3v-6h2v6h3V5.479l-4-3.316zm-6 4.975L12 2.5l6 4.638v13.7h-5v-6h-2v6H6v-13.7z" />
                    </svg>
                </div>

                <div className="relative z-10">
                    <div className="mb-4">
                        <div className="flex items-center mb-1">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                             </svg>
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Home Church</span>
                        </div>
                        <h2 className="text-xl font-serif font-bold text-white leading-tight">
                            {settings.churchName}
                        </h2>
                    </div>

                     {/* Status & Check-in */}
                     <div className="space-y-3">
                         <div className="bg-gray-900/60 p-1.5 rounded-xl border border-gray-700/50 flex items-center justify-between pl-3 pr-1.5">
                             <div className="flex items-center space-x-2.5">
                                 <span className="relative flex h-2 w-2">
                                    {isInChurch && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isInChurch ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                                 </span>
                                 <span className={`text-xs font-bold ${isInChurch ? 'text-green-400' : 'text-gray-400'}`}>
                                     {isInChurch ? "You are here" : "Not at church"}
                                 </span>
                             </div>
                             
                             {!isInChurch && settings.geofenceEnabled && (
                                <button 
                                    onClick={simulateArrival}
                                    className="bg-gray-800 hover:bg-gray-700 text-[10px] text-white font-medium px-3 py-1.5 rounded-lg border border-gray-600 transition-colors shadow-sm"
                                >
                                    Check In
                                </button>
                             )}
                         </div>

                         {/* Service Times */}
                         {settings.serviceTimes && settings.serviceTimes.length > 0 && (
                             <div className="flex items-center text-[10px] text-gray-500 px-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Services: <span className="text-gray-400">{settings.serviceTimes.join(', ')}</span></span>
                             </div>
                         )}
                     </div>
                </div>
            </div>
        </div>
      ) : (
          /* Fallback for no church set */
          <div className="flex flex-col items-center space-y-2">
              <div className={`px-4 py-1.5 rounded-full text-xs font-medium border ${isInChurch ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                {geoStatus}
              </div>
              {!isInChurch && settings.geofenceEnabled && (
                <button onClick={simulateArrival} className="text-xs text-gray-500 underline hover:text-white">Simulate Arrival</button>
              )}
          </div>
      )}

      {/* Action Cards */}
      <div className="w-full max-w-md space-y-4">
          
          {/* Upload Audio (Primary) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg text-left relative overflow-hidden"
          >
             <div className="h-14 w-14 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform flex-shrink-0 relative z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
             </div>
             <div className="relative z-10">
                 <h3 className="font-bold text-white text-lg group-hover:text-red-400 transition-colors">Upload Audio</h3>
                 <p className="text-sm text-gray-400">Use a recording from Voice Memos</p>
             </div>
          </button>

          {/* Scan Notes */}
          <button
            onClick={() => initiateImageCapture('STUDY')}
            disabled={isProcessing}
            className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg text-left"
          >
             <div className="h-14 w-14 rounded-full bg-blue-900/20 text-blue-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </div>
             <div>
                 <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">Scan Notes</h3>
                 <p className="text-sm text-gray-400">Take photos of handwritten notes</p>
             </div>
          </button>
          
          {/* Paste Text */}
          <button
            onClick={() => setShowTranscriptModal(true)}
            disabled={isProcessing}
            className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 p-5 rounded-2xl flex items-center transition-all group shadow-lg text-left"
          >
             <div className="h-14 w-14 rounded-full bg-purple-900/20 text-purple-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
             </div>
             <div>
                 <h3 className="font-bold text-white text-lg group-hover:text-purple-400 transition-colors">Paste Text</h3>
                 <p className="text-sm text-gray-400">Use a transcript or digital notes</p>
             </div>
          </button>
      </div>

      {/* Bulletin Section */}
      <div className="w-full max-w-md pt-4">
           <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Church Life</h3>
           <button
            onClick={() => initiateImageCapture('BULLETIN')}
            disabled={isProcessing}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-xl flex items-center justify-between group transition-colors"
           >
               <div className="flex items-center">
                   <div className="bg-gray-700 p-2 rounded-lg mr-3 group-hover:bg-gray-600">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                       </svg>
                   </div>
                   <span className="text-gray-300 font-medium group-hover:text-white">Scan Bulletin for Events</span>
               </div>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
               </svg>
           </button>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
           <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                <div className="bg-gray-800 p-8 rounded-2xl flex flex-col items-center shadow-2xl border border-gray-700 animate-slide-up">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
                    <h3 className="text-lg font-bold text-white mb-2">Generating Study...</h3>
                    <p className="text-gray-400 text-sm text-center max-w-xs">This takes about 30-60 seconds. AI is analyzing the content.</p>
                </div>
           </div>
       )}

      {/* Image Picker Modal */}
      {showImageOptions && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[70] sm:items-center">
            <div className="w-full max-w-sm p-4 space-y-3 animate-slide-up sm:animate-none">
                <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
                    <div className="p-4 text-center border-b border-gray-700"><h3 className="text-sm font-bold text-gray-400">{imageMode === 'STUDY' ? "Add Sermon Notes" : "Scan Church Bulletin"}</h3></div>
                    <button onClick={() => imageCameraRef.current?.click()} className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700">Take Photo</button>
                    <button onClick={() => imageGalleryRef.current?.click()} className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors">Choose from Gallery</button>
                </div>
                <button onClick={() => setShowImageOptions(false)} className="w-full py-4 bg-gray-800 rounded-2xl font-bold text-white hover:bg-gray-700 transition-colors border border-gray-700">Cancel</button>
            </div>
        </div>
      )}

      {/* Image Review Modal */}
      {showImagePreview && (
          <div className="fixed inset-0 bg-black/95 flex flex-col z-[60]">
              <div className="flex justify-between items-center p-4 border-b border-gray-800">
                  <h3 className="text-white font-bold">Review Images</h3>
                  <button onClick={() => { setShowImagePreview(false); setSelectedImages([]); }} className="text-gray-400 text-sm">Cancel</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                  {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-[3/4] bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                          <img src={URL.createObjectURL(img)} alt={`scan-${idx}`} className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 bg-red-600/90 text-white rounded-full p-1.5 shadow-lg">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      </div>
                  ))}
                  <button onClick={() => setShowImageOptions(true)} className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:border-purple-500 hover:text-purple-400 transition-colors bg-gray-900">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      <span className="text-xs font-bold">Add Another</span>
                  </button>
              </div>
              <div className="p-4 border-t border-gray-800 bg-gray-900">
                  <button onClick={handleProcessImages} disabled={selectedImages.length === 0} className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
                      {imageMode === 'STUDY' ? 'Generate Bible Study' : 'Digitize Bulletin'}
                  </button>
              </div>
          </div>
      )}
      
      {/* Transcript Modal */}
      {showTranscriptModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-lg p-6 border border-gray-700 shadow-2xl animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-4">Paste Sermon Transcript</h3>
                <textarea value={transcriptInput} onChange={(e) => setTranscriptInput(e.target.value)} className="w-full h-64 bg-gray-900 text-gray-300 p-4 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none mb-4 resize-none" placeholder="Paste the full text of the sermon here..." />
                <div className="flex space-x-3">
                    <button onClick={() => setShowTranscriptModal(false)} className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors">Cancel</button>
                    <button onClick={handleTranscriptSubmit} disabled={!transcriptInput.trim()} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Generate Study</button>
                </div>
            </div>
        </div>
      )}

      {error && (
            <div className="fixed bottom-24 w-full max-w-md px-6">
                <div className="bg-red-900/90 backdrop-blur border border-red-700 p-4 rounded-xl text-red-200 text-sm shadow-xl flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
                </div>
            </div>
       )}
    </div>
  );
};

export default RecordView;
