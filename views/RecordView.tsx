import React, { useState, useRef, useEffect } from 'react';
import { UserSettings, AppView, SermonStudy } from '../types';
import AudioVisualizer from '../components/AudioVisualizer';
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Checking location...");
  const [isInChurch, setIsInChurch] = useState(false);
  
  // Manual Upload State
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageMode, setImageMode] = useState<'STUDY' | 'BULLETIN'>('STUDY');
  
  const [transcriptInput, setTranscriptInput] = useState("");
  
  // Multi-image state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageGalleryRef = useRef<HTMLInputElement>(null);
  const imageCameraRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Handle Initial Actions passed from other views
  useEffect(() => {
    if (!initialAction) return;

    // Small timeout to ensure DOM is ready and state is clean
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

  // Geofencing Logic (Simulated Poll)
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
          // In a real app, we'd trigger a system notification here
          if (!isRecording && Notification.permission === "granted") {
             new Notification("My Church Bible Study", { body: "You're at church! Don't forget to record the message." });
          }
        } else {
          setIsInChurch(false);
          setGeoStatus(`Away from church (${Math.round(distance)}m)`);
        }
      } catch (e) {
        setGeoStatus("Location unavailable");
      }
    };

    const interval = setInterval(checkLocation, 10000); // Check every 10s
    checkLocation(); // Initial check

    return () => clearInterval(interval);
  }, [settings, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
            // Pass full settings to respect duration and reference counts
            const newStudy = await generateBibleStudy({ audioBlob }, settings);
            newStudy.originalAudioDuration = recordingTime;
            saveStudy(newStudy);
            onStudyGenerated(newStudy);
            setView(AppView.STUDY_DETAIL);
        } catch (err) {
            console.error(err);
            setError("Failed to generate study. Please try again.");
        } finally {
            setIsProcessing(false);
            // Stop tracks
            stream.getTracks().forEach(track => track.stop());
            setMediaStream(null);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    
    try {
        const newStudy = await generateBibleStudy({ audioBlob: file }, settings);
        saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err) {
        console.error(err);
        setError("Failed to process file. Ensure it is a valid audio file.");
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

      // Clear inputs to allow re-selection
      if (imageGalleryRef.current) imageGalleryRef.current.value = '';
      if (imageCameraRef.current) imageCameraRef.current.value = '';
  };

  const removeImage = (index: number) => {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
      if (selectedImages.length <= 1) {
          // If we removed the last one (async update), close? No, let user decide.
      }
  };

  const handleProcessImages = async () => {
      if (selectedImages.length === 0) return;
      
      setShowImagePreview(false);
      setIsProcessing(true);
      setError(null);

      try {
          if (imageMode === 'STUDY') {
            const newStudy = await generateBibleStudy({ images: selectedImages }, settings);
            saveStudy(newStudy);
            onStudyGenerated(newStudy);
            setView(AppView.STUDY_DETAIL);
          } else {
             const bulletin = await processBulletin(selectedImages);
             saveBulletin(bulletin);
             setView(AppView.EVENTS);
          }
      } catch (err) {
          console.error(err);
          setError(imageMode === 'STUDY' ? "Failed to generate study from notes." : "Failed to parse bulletin.");
          setShowImagePreview(true); // Re-open on error
      } finally {
          setIsProcessing(false);
          if (!error) setSelectedImages([]); // Clear if successful
      }
  }

  const handleTranscriptSubmit = async () => {
    if (!transcriptInput.trim()) return;
    setShowTranscriptModal(false);
    setIsProcessing(true);
    setError(null);

    try {
        const newStudy = await generateBibleStudy({ text: transcriptInput }, settings);
        saveStudy(newStudy);
        onStudyGenerated(newStudy);
        setView(AppView.STUDY_DETAIL);
    } catch (err) {
        console.error(err);
        setError("Failed to process transcript.");
    } finally {
         setIsProcessing(false);
         setTranscriptInput("");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulation helper
  const simulateArrival = () => {
      setIsInChurch(true);
      setGeoStatus("Simulated: At Church");
      if (Notification.permission === "granted") {
         new Notification("My Church Bible Study", { body: "You're at church! Start recording?" });
      } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
      }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 pb-24 space-y-6 relative">
      
      {/* Hidden inputs always mounted for accessibility */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="audio/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={imageGalleryRef} 
        onChange={handleImageSelect} 
        accept="image/*"
        multiple 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={imageCameraRef} 
        onChange={handleImageSelect} 
        accept="image/*"
        capture="environment"
        className="hidden" 
      />

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-serif font-bold text-white">My Church Bible Study</h1>
        <p className="text-gray-400 text-sm">Capture the message. Deepen your week.</p>
      </div>

      {/* Geofence Status Pill */}
      <div className={`px-4 py-1.5 rounded-full text-xs font-medium border ${isInChurch ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
        {geoStatus}
      </div>

      {!isInChurch && settings.geofenceEnabled && (
           <button onClick={simulateArrival} className="text-xs text-gray-500 underline hover:text-white">Simulate Arrival</button>
      )}

      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl relative z-0">
        <div className="mb-6">
            <AudioVisualizer stream={mediaStream} isRecording={isRecording} />
        </div>
        
        <div className="text-center mb-8">
          <div className="text-5xl font-mono font-light tracking-wider text-white">
            {formatTime(recordingTime)}
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {isRecording ? "Recording in progress..." : "Ready to record"}
          </p>
        </div>

        <div className="flex justify-center">
          {!isRecording && !isProcessing ? (
            <button
              onClick={startRecording}
              className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-red-600 transition-all hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/50 active:scale-95 shadow-lg"
            >
               <div className="h-8 w-8 rounded-full bg-white shadow-sm"></div>
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 border-2 border-red-500 transition-all hover:bg-gray-600 focus:outline-none active:scale-95 shadow-lg"
            >
              <div className="h-6 w-6 rounded bg-red-500 shadow-sm"></div>
            </button>
          ) : (
             <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                <span className="text-sm text-purple-400 animate-pulse text-center">Processing content...<br/>This may take a minute.</span>
             </div>
          )}
        </div>
        {error && <p className="text-red-400 text-xs text-center mt-4">{error}</p>}
      </div>

      {/* Manual Entry Options */}
      {!isRecording && !isProcessing && (
          <div className="w-full max-w-md grid grid-cols-2 gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-xs font-medium"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                 </svg>
                 <span>Upload Audio</span>
              </button>

              <button 
                onClick={() => initiateImageCapture('STUDY')}
                className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-xs font-medium"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
                 <span>Scan Notes</span>
              </button>

              <button 
                onClick={() => setShowTranscriptModal(true)}
                className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-xs font-medium"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
                 <span>Paste Text</span>
              </button>

              <button 
                onClick={() => initiateImageCapture('BULLETIN')}
                className="flex flex-col items-center justify-center space-y-1 p-3 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-xs font-medium"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
                 <span>Scan Bulletin</span>
              </button>
          </div>
      )}

      {/* Image Source Selection Modal */}
      {/* Increased Z-Index to 70 to appear ABOVE the preview modal (which is 60) */}
      {showImageOptions && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[70] sm:items-center">
            <div className="w-full max-w-sm p-4 space-y-3 animate-slide-up sm:animate-none">
                <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
                    <div className="p-4 text-center border-b border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400">
                            {imageMode === 'STUDY' ? "Add Sermon Notes" : "Scan Church Bulletin"}
                        </h3>
                    </div>
                    <button 
                        onClick={() => imageCameraRef.current?.click()}
                        className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700"
                    >
                        Take Photo
                    </button>
                    <button 
                        onClick={() => imageGalleryRef.current?.click()}
                        className="w-full py-4 text-center text-blue-400 font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors"
                    >
                        Choose from Gallery
                    </button>
                </div>
                
                <button 
                    onClick={() => setShowImageOptions(false)}
                    className="w-full py-4 bg-gray-800 rounded-2xl font-bold text-white hover:bg-gray-700 transition-colors border border-gray-700"
                >
                    Cancel
                </button>
            </div>
        </div>
      )}

      {/* Captured Image Preview Modal */}
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
                          <button 
                              onClick={() => removeImage(idx)}
                              className="absolute top-2 right-2 bg-red-600/90 text-white rounded-full p-1.5 shadow-lg"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                      </div>
                  ))}
                  
                  {/* Add Another Button */}
                  <button 
                      onClick={() => setShowImageOptions(true)}
                      className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 hover:border-purple-500 hover:text-purple-400 transition-colors bg-gray-900"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs font-bold">Add Another</span>
                  </button>
              </div>

              <div className="p-4 border-t border-gray-800 bg-gray-900">
                  <button 
                      onClick={handleProcessImages}
                      disabled={selectedImages.length === 0}
                      className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                      {imageMode === 'STUDY' ? 'Generate Bible Study' : 'Digitize Bulletin'}
                  </button>
              </div>
          </div>
      )}
      
      {/* Transcript Modal */}
      {showTranscriptModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-lg p-6 border border-gray-700 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Paste Sermon Transcript</h3>
                <textarea 
                    value={transcriptInput}
                    onChange={(e) => setTranscriptInput(e.target.value)}
                    className="w-full h-64 bg-gray-900 text-gray-300 p-4 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none mb-4 resize-none"
                    placeholder="Paste the full text of the sermon here..."
                />
                <div className="flex space-x-3">
                    <button 
                        onClick={() => setShowTranscriptModal(false)}
                        className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleTranscriptSubmit}
                        disabled={!transcriptInput.trim()}
                        className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Generate Study
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default RecordView;