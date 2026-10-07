
// //new
// import { useState, useRef, useEffect, useCallback } from 'react';
// import { motion } from 'motion/react';
// import { Camera, StopCircle, Sparkles, Volume2, Copy, Trash2, Delete, Plus, Hand, Zap } from 'lucide-react';
// import { Button } from '../components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
// import { Badge } from '../components/ui/badge';
// import { toast } from 'sonner';
// import { HandLandmarker, FilesetResolver, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

// const SMOOTH_N = 6;
// const HOLD_FRAMES_REQUIRED = 18;
// const COOLDOWN_FRAMES = 25;
// const CONFIDENCE_THRESHOLD = 0.55;

// // Same model asset used during training (Python: HandLandmarkerOptions with
// // base_options=BaseOptions(model_asset_path=...) pointing at this exact
// // float16 hand_landmarker.task). Using the same model + same confidence
// // thresholds here keeps frontend feature extraction consistent with what
// // the Random Forest was actually trained on.
// const MODEL_ASSET_URL =
//   'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
// const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

// // ── Random Forest node shape, produced by the Python export script:
// //    { "f": featureIndex, "t": threshold, "l": leftNode, "r": rightNode }
// //    { "leaf": classIndex }
// type TreeNode =
//   | { f: number; t: number; l: TreeNode; r: TreeNode }
//   | { leaf: number };

// function isLeaf(node: TreeNode): node is { leaf: number } {
//   return (node as { leaf: number }).leaf !== undefined;
// }

// function predictTree(node: TreeNode, features: Float32Array): number {
//   let cur = node;
//   while (!isLeaf(cur)) {
//     cur = features[cur.f] <= cur.t ? cur.l : cur.r;
//   }
//   return cur.leaf;
// }

// // Runs every tree, majority-votes, and returns both the winning class
// // index and the fraction of trees that agreed (a real confidence score,
// // analogous to sklearn's predict_proba for a Random Forest).
// function predictForest(trees: TreeNode[], features: Float32Array): { classIdx: number; confidence: number } {
//   const votes: Record<number, number> = {};
//   for (const tree of trees) {
//     const c = predictTree(tree, features);
//     votes[c] = (votes[c] || 0) + 1;
//   }
//   let bestClass = -1;
//   let bestCount = -1;
//   for (const [cStr, count] of Object.entries(votes)) {
//     if (count > bestCount) {
//       bestCount = count;
//       bestClass = Number(cStr);
//     }
//   }
//   return { classIdx: bestClass, confidence: bestCount / trees.length };
// }

// export function SignToText() {
//   const [isRecording, setIsRecording] = useState(false);
//   const [inferenceError, setInferenceError] = useState<string | null>(null);
//   const [currentWord, setCurrentWord] = useState('');
//   const [words, setWords] = useState<string[]>([]);
//   const [holdPct, setHoldPct] = useState(0);
//   const [holdStatus, setHoldStatus] = useState('Hold a sign steady to type');
//   const [confPct, setConfPct] = useState(0);
//   const [labelName, setLabelName] = useState('No hand detected');
//   const [predLabel, setPredLabel] = useState('—');
//   const [statusText, setStatusText] = useState('Click Start to begin');
//   const [debugLogs, setDebugLogs] = useState<{ msg: string; type: 'info' | 'ok' | 'err' }[]>([
//     { msg: 'Log...', type: 'info' },
//   ]);

//   const videoRef = useRef<HTMLVideoElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const treesRef = useRef<TreeNode[] | null>(null);
//   const landmarkerRef = useRef<HandLandmarker | null>(null);
//   const labelsRef = useRef<Record<string, string>>({});
//   const isRunningRef = useRef(false);
//   const rafIdRef = useRef<number | null>(null);
//   const frameCountRef = useRef(0);
//   const labelBufRef = useRef<string[]>([]);
//   const confBufRef = useRef<number[]>([]);
//   const holdLabelRef = useRef<string | null>(null);
//   const holdCountRef = useRef(0);
//   const cooldownRef = useRef(0);
//   const handDetectedRef = useRef(false);
//   const currentWordRef = useRef('');
//   const wordsRef = useRef<string[]>([]);
//   const debugBoxRef = useRef<HTMLDivElement>(null);

//   currentWordRef.current = currentWord;
//   wordsRef.current = words;

//   const addLog = useCallback((msg: string, type: 'info' | 'ok' | 'err' = 'info') => {
//     const time = new Date().toLocaleTimeString();
//     setDebugLogs(prev => [...prev.slice(-50), { msg: `[${time}] ${msg}`, type }]);
//     setTimeout(() => {
//       if (debugBoxRef.current) debugBoxRef.current.scrollTop = debugBoxRef.current.scrollHeight;
//     }, 50);
//   }, []);

//   useEffect(() => {
//     fetch('/labels.json')
//       .then(r => r.json())
//       .then((data: { label_map?: Record<string, string>; classes?: string[] }) => {
//         if (data.label_map) {
//           labelsRef.current = data.label_map;
//         } else if (data.classes) {
//           data.classes.forEach((c, i) => { labelsRef.current[String(i)] = c; });
//         }
//         addLog('Labels: ' + Object.values(labelsRef.current).join(', '), 'ok');
//       })
//       .catch(err => addLog('labels.json error: ' + err.message, 'err'));

//     // trees.json is produced by exporting clf.estimators_ from the trained
//     // sklearn RandomForestClassifier — no ONNX conversion involved.
//     fetch('/trees.json')
//       .then(r => r.json())
//       .then((trees: TreeNode[]) => {
//         treesRef.current = trees;
//         addLog(`Forest ready. ${trees.length} trees loaded`, 'ok');
//       })
//       .catch(err => {
//         addLog('trees.json load failed: ' + err.message, 'err');
//         setInferenceError('Failed to load AI model: ' + err.message);
//       });

//     // Tasks API HandLandmarker — same model file + same confidence
//     // thresholds as the Python training pipeline, so landmarks extracted
//     // here match what the forest was trained on (unlike the legacy
//     // @mediapipe/hands API, which uses a different underlying model).
//     let cancelled = false;
//     (async () => {
//       try {
//         const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
//         const landmarker = await HandLandmarker.createFromOptions(vision, {
//           baseOptions: {
//             modelAssetPath: MODEL_ASSET_URL,
//             delegate: 'GPU',
//           },
//           runningMode: 'VIDEO',
//           numHands: 1,
//           minHandDetectionConfidence: 0.5,
//           minHandPresenceConfidence: 0.5,
//           minTrackingConfidence: 0.5,
//         });
//         if (cancelled) {
//           landmarker.close();
//           return;
//         }
//         landmarkerRef.current = landmarker;
//         addLog('HandLandmarker ready (tasks-vision)', 'ok');
//       } catch (err) {
//         addLog('HandLandmarker init failed: ' + (err instanceof Error ? err.message : err), 'err');
//         setInferenceError('Failed to load hand detector: ' + (err instanceof Error ? err.message : String(err)));
//       }
//     })();

//     return () => {
//       cancelled = true;
//       landmarkerRef.current?.close();
//       landmarkerRef.current = null;
//     };
//   }, []);

//   useEffect(() => {
//     const handler = (e: KeyboardEvent) => {
//       if (e.key === 'Backspace') { e.preventDefault(); deleteLetter(); }
//       if (e.key === 'Enter') { e.preventDefault(); addSpace(); }
//       if (e.key === 'Escape') { e.preventDefault(); clearAll(); }
//     };
//     window.addEventListener('keydown', handler);
//     return () => window.removeEventListener('keydown', handler);
//   }, []);

//   // NOTE: no horizontal flip here — training extracted landmarks straight
//   // from the raw (unmirrored) frame, and both-hand recognition is handled
//   // by mirror-augmenting the training set itself, not by flipping features
//   // at inference time. Any left/right mirroring in the UI is a CSS/display
//   // concern only (see the video/canvas scaleX(-1) below), never applied to
//   // the landmark coordinates themselves.
// function extractFeatures(landmarks: Array<{ x: number; y: number; z: number }>) {
//   const features = new Float32Array(42);
//   let idx = 0;
//   for (let i = 0; i < 21; i++) {
//     features[idx++] = landmarks[i].x;
//     features[idx++] = landmarks[i].y;
//   }
//   return features;
// }
//   function drawLandmarks(landmarks: Array<{ x: number; y: number }> | null) {
//     const canvas = canvasRef.current;
//     const video = videoRef.current;
//     if (!canvas || !video) return;
//     canvas.width = video.videoWidth || 640;
//     canvas.height = video.videoHeight || 480;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     if (!landmarks?.length) return;
//     const W = canvas.width, H = canvas.height;
//     const pts = landmarks.map(p => ({ x: p.x * W, y: p.y * H }));
//     const conns = [
//       [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],
//       [0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]
//     ];
//     ctx.strokeStyle = 'rgba(255,165,0,0.85)'; ctx.lineWidth = 2;
//     conns.forEach(([a, b]) => {
//       ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
//     });
//     pts.forEach((p, i) => {
//       ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2);
//       ctx.fillStyle = i === 0 ? '#facc15' : '#00ffff'; ctx.fill();
//     });
//   }

//   function onHandResults(result: HandLandmarkerResult) {
//     const lmList = result.landmarks;

//     if (!lmList || lmList.length === 0) {
//       drawLandmarks(null);
//       if (handDetectedRef.current) {
//         setPredLabel('—');
//         setLabelName('No hand detected');
//         setConfPct(0);
//         setHoldPct(0);
//         setHoldStatus('Hold a sign steady to type');
//         handDetectedRef.current = false;
//         labelBufRef.current = [];
//         confBufRef.current = [];
//       }
//       holdLabelRef.current = null; holdCountRef.current = 0;
//       if (cooldownRef.current > 0) cooldownRef.current--;
//       return;
//     }

//     if (!handDetectedRef.current) { addLog('Hand detected', 'ok'); handDetectedRef.current = true; }
//     drawLandmarks(lmList[0] as any);

//     frameCountRef.current++;
//     if (frameCountRef.current % 2 !== 0) return;
//     if (!treesRef.current) return;

//     const features = extractFeatures(lmList[0]);

//     try {
//       const { classIdx, confidence } = predictForest(treesRef.current, features);
//       const label = labelsRef.current[String(classIdx)] ?? ('?' + classIdx);

//       labelBufRef.current.push(label);
//       confBufRef.current.push(confidence);
//       if (labelBufRef.current.length > SMOOTH_N) labelBufRef.current.shift();
//       if (confBufRef.current.length > SMOOTH_N) confBufRef.current.shift();

//       // Majority label across the recent-frame window (temporal smoothing).
//       const freq: Record<string, number> = {};
//       labelBufRef.current.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
//       const smoothed = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

//       // Real confidence = average tree-vote-agreement over the frames that
//       // actually predicted the smoothed/majority label (not just frame
//       // agreement frequency — this reflects the forest's own certainty).
//       const matchingConfs = labelBufRef.current
//         .map((lbl, i) => (lbl === smoothed ? confBufRef.current[i] : null))
//         .filter((c): c is number => c !== null);
//       const conf = matchingConfs.length
//         ? matchingConfs.reduce((a, b) => a + b, 0) / matchingConfs.length
//         : 0;
//       const pct = Math.round(conf * 100);

//       setPredLabel(smoothed);
//       setLabelName(smoothed === 'Nothing' ? 'No sign' : smoothed === 'Space' ? 'SPACE — hold to end word' : 'Sign: ' + smoothed);
//       setConfPct(pct);

//       if (cooldownRef.current > 0) {
//         cooldownRef.current--;
//         holdLabelRef.current = null; holdCountRef.current = 0;
//         setHoldPct(0);
//         setHoldStatus(`Cooldown... (${cooldownRef.current})`);
//         return;
//       }

//       if (smoothed === 'Nothing' || conf < CONFIDENCE_THRESHOLD) {
//         holdLabelRef.current = null; holdCountRef.current = 0;
//         setHoldPct(0);
//         setHoldStatus('Hold a sign steady to type');
//         return;
//       }

//       if (smoothed === holdLabelRef.current) {
//         holdCountRef.current++;
//       } else {
//         holdLabelRef.current = smoothed;
//         holdCountRef.current = 1;
//       }

//       const hp = Math.min((holdCountRef.current / HOLD_FRAMES_REQUIRED) * 100, 100);
//       setHoldPct(hp);
//       setHoldStatus(hp >= 100 ? '✓ Held!' : `Holding "${smoothed}"... ${Math.round(hp)}%`);

//       if (holdCountRef.current >= HOLD_FRAMES_REQUIRED) {
//         holdCountRef.current = 0;
//         cooldownRef.current = COOLDOWN_FRAMES;

//         if (smoothed === 'Space') {
//           const completedWord = currentWordRef.current.trim();
//           if (completedWord) {
//             setWords(prev => [...prev, completedWord]);
//             wordsRef.current = [...wordsRef.current, completedWord];
//             setCurrentWord('');
//             currentWordRef.current = '';
//             toast.success(`Word "${completedWord}" added!`);
//             addLog('Word committed: ' + completedWord, 'ok');
//           } else {
//             toast.info('Space — no word to save');
//           }
//         } else {
//           setCurrentWord(prev => prev + smoothed);
//           toast.success(`+ ${smoothed}`);
//         }
//       }
//     } catch (err) {
//       if (frameCountRef.current <= 20) addLog('Inference error: ' + (err instanceof Error ? err.message : err), 'err');
//     }
//   }

//   function processLoop() {
//     if (!isRunningRef.current) return;
//     const video = videoRef.current;
//     const landmarker = landmarkerRef.current;
//     if (video && landmarker && video.readyState >= 2 && video.videoWidth > 0) {
//       try {
//         const result = landmarker.detectForVideo(video, performance.now());
//         onHandResults(result);
//       } catch (_) {
//         // transient decode/timing errors are fine to skip a frame on
//       }
//     }
//     rafIdRef.current = requestAnimationFrame(processLoop);
//   }

//   const handleStartRecording = async () => {
//     addLog('Loading model...', 'info');
//     setStatusText('Loading model...');
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         await new Promise<void>(r => { videoRef.current!.onloadedmetadata = () => r(); });
//         await videoRef.current.play();
//       }
//       isRunningRef.current = true;
//       frameCountRef.current = 0;
//       setIsRecording(true);
//       setStatusText('Running — hold a sign steady to type!');
//       addLog('Camera ready', 'ok');
//       toast.success('Recording started');
//       processLoop();
//     } catch (err) {
//       addLog('Camera error: ' + (err instanceof Error ? err.message : err), 'err');
//       setStatusText('Camera error');
//       toast.error('Could not access camera.');
//     }
//   };

//   const handleStopRecording = () => {
//     isRunningRef.current = false;
//     if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
//     if (videoRef.current?.srcObject) {
//       (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
//       videoRef.current.srcObject = null;
//     }
//     const canvas = canvasRef.current;
//     if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
//     setIsRecording(false);
//     setPredLabel('—');
//     setLabelName('No hand detected');
//     setConfPct(0);
//     setHoldPct(0);
//     setHoldStatus('Hold a sign steady to type');
//     setStatusText('Stopped.');
//     holdLabelRef.current = null; holdCountRef.current = 0;
//     labelBufRef.current = [];
//     confBufRef.current = [];
//     handDetectedRef.current = false;
//     addLog('Stopped.', 'info');
//   };

//   function deleteLetter() {
//     if (currentWordRef.current.length > 0) {
//       setCurrentWord(prev => prev.slice(0, -1));
//       toast.info('Deleted letter');
//     } else if (wordsRef.current.length > 0) {
//       const last = wordsRef.current[wordsRef.current.length - 1];
//       setWords(prev => prev.slice(0, -1));
//       setCurrentWord(last);
//       toast.info('Restored last word for editing');
//     }
//   }

//   function addSpace() {
//     const w = currentWordRef.current.trim();
//     if (w) {
//       setWords(prev => [...prev, w]);
//       setCurrentWord('');
//       toast.success(`Word "${w}" added!`);
//     } else {
//       toast.error('Type a word first');
//     }
//   }

//   function clearWord() {
//     setCurrentWord('');
//     toast.info('Word cleared');
//   }

//   function clearAll() {
//     setCurrentWord('');
//     setWords([]);
//     toast.info('Cleared everything');
//   }

//   function copySentence() {
//     const s = (wordsRef.current.join(' ') + (currentWordRef.current ? (wordsRef.current.length > 0 ? ' ' + currentWordRef.current : currentWordRef.current) : '')).trim();
//     if (!s) { toast.error('Nothing to copy'); return; }
//     navigator.clipboard.writeText(s).then(() => toast.success('Copied!'));
//   }

//   function speakSentence() {
//     const s = (wordsRef.current.join(' ') + (currentWordRef.current ? (wordsRef.current.length > 0 ? ' ' + currentWordRef.current : currentWordRef.current) : '')).trim();
//     if (!s) { toast.error('Nothing to speak'); return; }
//     const utt = new SpeechSynthesisUtterance(s);
//     utt.rate = 0.9;
//     speechSynthesis.speak(utt);
//     toast.info('Speaking...');
//   }

//   const sentence = words.join(' ') + (currentWord ? (words.length > 0 ? ' ' + currentWord : currentWord) : '');
//   const confBarColor = confPct / 100 > 0.7 ? '#4ade80' : confPct / 100 > 0.4 ? '#facc15' : '#f87171';
//   const predColor = predLabel === 'Nothing' ? '#6b7280' : predLabel === 'Space' ? '#ca8a04' : '#16a34a';

//   return (
//     <div className="relative">
//       {/* Animated Background */}
//       <div className="fixed inset-0 overflow-hidden pointer-events-none">
//         <motion.div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
//           animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
//           transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
//         <motion.div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
//           animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
//           transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} />
//         <motion.div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"
//           animate={{ scale: [1, 1.5, 1], rotate: [0, 180, 360] }}
//           transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
//       </div>

//       <div className="relative z-10 max-w-6xl mx-auto space-y-6 px-4 sm:px-0">

//         {/* ── Header ── */}
//         <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-1">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
//               <Hand className="w-5 h-5 text-white" />
//             </div>
//             <div>
//               <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
//                 Sign to Text
//               </h1>
//               <p className="text-sm text-gray-500">Real-time ASL recognition powered by AI</p>
//             </div>
//           </div>
//         </motion.div>

//         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

//             {/* ── LEFT — Camera ── */}
//             <div className="flex flex-col gap-4">
//               <Card className="shadow-xl border border-white/60 bg-white/90 backdrop-blur-sm overflow-hidden">
//                 <div className="px-5 pt-5 pb-0 flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <Camera className="w-4 h-4 text-blue-600" />
//                     <span className="text-sm font-semibold text-gray-700">Camera Feed</span>
//                   </div>
//                   {isRecording && (
//                     <motion.div className="flex items-center gap-1.5"
//                       animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
//                       <div className="w-2 h-2 rounded-full bg-red-500" />
//                       <span className="text-xs font-medium text-red-500">LIVE</span>
//                     </motion.div>
//                   )}
//                 </div>

//                 <CardContent className="p-4 space-y-4">
//                   {/* Video */}
//                   <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 aspect-video shadow-inner">
//                     <video ref={videoRef} className="w-full h-full object-cover block" style={{ transform: 'scaleX(-1)' }}
//                       autoPlay playsInline muted />
//                     <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
//                       style={{ transform: 'scaleX(-1)' }} />
//                     {!isRecording && (
//                       <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-sm">
//                         <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
//                           className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-400/40 flex items-center justify-center">
//                           <Camera className="w-7 h-7 text-blue-400" />
//                         </motion.div>
//                         <p className="text-sm text-slate-300 font-medium">Camera is off</p>
//                         <p className="text-xs text-slate-500">Press Start to begin recognition</p>
//                       </div>
//                     )}
//                   </div>

//                   {/* Hold progress */}
//                   <div className="space-y-1.5">
//                     <div className="flex items-center justify-between">
//                       <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hold Progress</span>
//                       <span className="text-xs font-semibold text-purple-600">{Math.round(holdPct)}%</span>
//                     </div>
//                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
//                       <motion.div className="h-full rounded-full"
//                         style={{ background: holdPct >= 100 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#6366f1,#a855f7)' }}
//                         animate={{ width: `${holdPct}%` }} transition={{ duration: 0.08 }} />
//                     </div>
//                     <p className="text-xs text-gray-400">{holdStatus}</p>
//                   </div>

//                   {/* Prediction */}
//                   <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm">
//                     <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-white border-2 shadow-sm"
//                       style={{ borderColor: predColor + '55' }}>
//                       <span className="text-3xl font-bold leading-none" style={{ color: predColor }}>{predLabel}</span>
//                     </div>
//                     <div className="flex-1 space-y-2">
//                       <p className="text-sm font-medium text-gray-700">{labelName}</p>
//                       <div className="space-y-1">
//                         <div className="flex items-center justify-between">
//                           <span className="text-xs text-gray-400">Confidence</span>
//                           <span className="text-xs font-semibold" style={{ color: confBarColor }}>{confPct}%</span>
//                         </div>
//                         <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
//                           <div className="h-full rounded-full transition-all duration-150"
//                             style={{ width: `${confPct}%`, background: confBarColor }} />
//                         </div>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Status chip */}
//                   <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
//                     <Zap className="w-3.5 h-3.5 text-amber-500" />
//                     <p className="text-xs font-medium text-amber-700">{statusText}</p>
//                   </div>

//                   {/* Start / Stop */}
//                   {!isRecording ? (
//                     <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
//                       <Button onClick={handleStartRecording}
//                         className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-md shadow-blue-500/25 transition-all">
//                         <Camera className="w-4 h-4 mr-2" /> Start Recognition
//                       </Button>
//                     </motion.div>
//                   ) : (
//                     <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
//                       <Button onClick={handleStopRecording}
//                         className="w-full h-11 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md shadow-red-500/25 transition-all">
//                         <StopCircle className="w-4 h-4 mr-2" /> Stop Camera
//                       </Button>
//                     </motion.div>
//                   )}

//                   {inferenceError && (
//                     <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
//                       <span className="text-red-500 text-sm">⚠</span>
//                       <p className="text-xs text-red-600">{inferenceError}</p>
//                     </div>
//                   )}
//                 </CardContent>
//               </Card>
//             </div>

//             {/* ── RIGHT — Communication Panel ── */}
//             <div className="flex flex-col gap-4">
//               <Card className="shadow-xl border border-white/60 bg-white/90 backdrop-blur-sm h-full">
//                 <div className="px-5 pt-5 pb-0 flex items-center gap-2">
//                   <Sparkles className="w-4 h-4 text-purple-600" />
//                   <span className="text-sm font-semibold text-gray-700">Communication Panel</span>
//                 </div>

//                 <CardContent className="p-5 space-y-5">

//                   {/* Current Word */}
//                   <div className="space-y-2">
//                     <div className="flex items-center justify-between">
//                       <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Current Word</span>
//                       <div className="flex gap-1.5">
//                         <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
//                           onClick={deleteLetter}
//                           className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
//                           <Delete className="w-3 h-3" /> Backspace
//                         </motion.button>
//                         <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
//                           onClick={clearWord}
//                           className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
//                           <Trash2 className="w-3 h-3" /> Clear
//                         </motion.button>
//                       </div>
//                     </div>
//                     <div className="flex items-center gap-1 rounded-xl border-2 border-purple-200 bg-purple-50/50 px-4 py-3 min-h-[60px] shadow-inner">
//                       <span className="text-2xl font-bold tracking-[6px] text-purple-700 font-mono">
//                         {currentWord || <span className="text-purple-300 tracking-normal font-sans text-base font-normal italic">Spell a word...</span>}
//                       </span>
//                       <motion.span className="text-2xl text-purple-400 ml-0.5"
//                         animate={{ opacity: [1, 0, 1] }}
//                         transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>|</motion.span>
//                     </div>
//                     <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
//                       onClick={addSpace}
//                       className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold shadow shadow-green-500/20 transition-all">
//                       <Plus className="w-4 h-4" /> Confirm Word
//                     </motion.button>
//                   </div>

//                   <div className="border-t border-gray-100" />

//                   {/* Sentence */}
//                   <div className="space-y-2">
//                     <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Full Sentence</span>
//                     <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 px-4 py-3 min-h-[72px] shadow-inner">
//                       {sentence
//                         ? <p className="text-gray-800 text-sm leading-relaxed break-words font-medium">{sentence}</p>
//                         : <p className="text-blue-300 italic text-sm">Your sentence will appear here...</p>
//                       }
//                     </div>
//                   </div>

//                   {/* Sentence actions */}
//                   <div className="grid grid-cols-3 gap-2">
//                     <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
//                       onClick={speakSentence}
//                       className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-indigo-200 transition-all shadow-sm">
//                       <Volume2 className="w-4 h-4" />
//                       <span className="text-xs font-semibold">Speak</span>
//                     </motion.button>
//                     <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
//                       onClick={copySentence}
//                       className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200 text-slate-700 hover:from-slate-100 hover:to-slate-200 transition-all shadow-sm">
//                       <Copy className="w-4 h-4" />
//                       <span className="text-xs font-semibold">Copy</span>
//                     </motion.button>
//                     <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
//                       onClick={clearAll}
//                       className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gradient-to-b from-red-50 to-red-100 border border-red-200 text-red-600 hover:from-red-100 hover:to-red-200 transition-all shadow-sm">
//                       <Trash2 className="w-4 h-4" />
//                       <span className="text-xs font-semibold">Clear All</span>
//                     </motion.button>
//                   </div>

//                   <div className="border-t border-gray-100" />

//                   {/* Keyboard shortcuts */}
//                   <div className="space-y-2">
//                     <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Keyboard Shortcuts</span>
//                     <div className="grid grid-cols-3 gap-1.5">
//                       {[
//                         { key: '⌫', label: 'Delete letter' },
//                         { key: '↵', label: 'Next word' },
//                         { key: 'Esc', label: 'Clear all' },
//                       ].map(({ key, label }) => (
//                         <div key={key} className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 py-2 px-1">
//                           <kbd className="text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded px-1.5 py-0.5 shadow-sm">{key}</kbd>
//                           <span className="text-[10px] text-gray-400 text-center leading-tight">{label}</span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>

//                 </CardContent>
//               </Card>
//             </div>
//           </div>

//           {/* ── Tips ── */}
//           <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 shadow-lg">
//             <CardContent className="pt-4 pb-4">
//               <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
//                 <Sparkles className="w-4 h-4 text-purple-600" />
//                 Tips for Better Recognition
//               </h3>
//               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
//                 {[
//                   { icon: '💡', text: 'Ensure good lighting' },
//                   { icon: '🖐️', text: 'Keep hand visible in frame' },
//                   { icon: '⏱️', text: 'Hold each sign ~1 second' },
//                   { icon: '🎨', text: 'Use a plain background' },
//                 ].map((tip, i) => (
//                   <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2 border border-blue-100 shadow-sm">
//                     <span className="text-base leading-none mt-0.5">{tip.icon}</span>
//                     <p className="text-xs text-blue-800 leading-snug">{tip.text}</p>
//                   </div>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>

//         </motion.div>
//       </div>
//     </div>
//   );
// }








import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Camera, StopCircle, Volume2, Copy, Trash2, Delete, Plus, Zap, Wand2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { logActivityEvent } from '../../lib/activityApi';

const SMOOTH_N = 8;
const HOLD_FRAMES_REQUIRED = 12;       // fewer frames needed since capture is already throttled
const COOLDOWN_FRAMES = 14;
const CONFIDENCE_THRESHOLD = 0.40;
const CAPTURE_INTERVAL_MS = 150;       // ~6-7 requests/sec to the Flask server

// Point this at your FastAPI backend's sign recognition route.
const PREDICT_URL = 'http://localhost:8000/sign/predict';
const HEALTH_URL = 'http://localhost:8000/sign/health';
const GRAMMAR_URL = 'http://localhost:8000/grammar/correct';

type PredictResponse = {
  hand_detected: boolean;
  label: string | null;
  confidence: number;
  landmarks: Array<{ x: number; y: number }>;
  error?: string;
};

export function SignToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [currentWord, setCurrentWord] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [holdPct, setHoldPct] = useState(0);
  const [holdStatus, setHoldStatus] = useState('Hold a sign steady to type');
  const [confPct, setConfPct] = useState(0);
  const [labelName, setLabelName] = useState('No hand detected');
  const [predLabel, setPredLabel] = useState('—');
  const [statusText, setStatusText] = useState('Click Start to begin');
  const [debugLogs, setDebugLogs] = useState<{ msg: string; type: 'info' | 'ok' | 'err' }[]>([
    { msg: 'Log...', type: 'info' },
  ]);
  const [correctedSentence, setCorrectedSentence] = useState('');
  const [isFixingGrammar, setIsFixingGrammar] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);        // overlay (landmark drawing)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null); // offscreen, for frame capture
  const isRunningRef = useRef(false);
  const intervalIdRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const labelBufRef = useRef<string[]>([]);
  const confBufRef = useRef<number[]>([]);
  const holdLabelRef = useRef<string | null>(null);
  const holdCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const handDetectedRef = useRef(false);
  const currentWordRef = useRef('');
  const wordsRef = useRef<string[]>([]);
  const debugBoxRef = useRef<HTMLDivElement>(null);

  currentWordRef.current = currentWord;
  wordsRef.current = words;

  const addLog = useCallback((msg: string, type: 'info' | 'ok' | 'err' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-50), { msg: `[${time}] ${msg}`, type }]);
    setTimeout(() => {
      if (debugBoxRef.current) debugBoxRef.current.scrollTop = debugBoxRef.current.scrollHeight;
    }, 50);
  }, []);

  // Quick health check on mount so errors show up before the user hits Start
  useEffect(() => {
    fetch(HEALTH_URL)
      .then(r => r.json())
      .then((data: { status: string; classes: string[] }) => {
        addLog(`Backend ready. Classes: ${data.classes.join(', ')}`, 'ok');
      })
      .catch(err => {
        addLog('Backend unreachable: ' + (err instanceof Error ? err.message : err), 'err');
        setInferenceError('Cannot reach the sign recognition backend. Is uvicorn running on port 8000?');
      });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') { e.preventDefault(); deleteLetter(); }
      if (e.key === 'Enter') { e.preventDefault(); addSpace(); }
      if (e.key === 'Escape') { e.preventDefault(); clearAll(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function drawLandmarks(landmarks: Array<{ x: number; y: number }> | null) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks?.length) return;
    const W = canvas.width, H = canvas.height;
    const pts = landmarks.map(p => ({ x: p.x * W, y: p.y * H }));
    const conns = [
      [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]
    ];
    ctx.strokeStyle = 'rgba(255,165,0,0.85)'; ctx.lineWidth = 2;
    conns.forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
    });
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#facc15' : '#00ffff'; ctx.fill();
    });
  }

  function captureFrameAsBase64(): string | null {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = captureCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // NOTE: not mirrored here — we send the raw camera frame, matching
    // training images. The visible <video>/<canvas> elements are mirrored
    // via CSS for display only (see scaleX(-1) below).
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  function processHandResult(result: PredictResponse) {
    if (result.error) {
      addLog('Server error: ' + result.error, 'err');
      return;
    }

    if (!result.hand_detected) {
      drawLandmarks(null);
      if (handDetectedRef.current) {
        setPredLabel('—');
        setLabelName('No hand detected');
        setConfPct(0);
        setHoldPct(0);
        setHoldStatus('Hold a sign steady to type');
        handDetectedRef.current = false;
        labelBufRef.current = [];
        confBufRef.current = [];
      }
      holdLabelRef.current = null; holdCountRef.current = 0;
      if (cooldownRef.current > 0) cooldownRef.current--;
      return;
    }

    if (!handDetectedRef.current) { addLog('Hand detected', 'ok'); handDetectedRef.current = true; }
    drawLandmarks(result.landmarks);

    const label = result.label ?? '?';
    const confidence = result.confidence;

    labelBufRef.current.push(label);
    confBufRef.current.push(confidence);
    if (labelBufRef.current.length > SMOOTH_N) labelBufRef.current.shift();
    if (confBufRef.current.length > SMOOTH_N) confBufRef.current.shift();

    // Majority label across the recent-frame window (temporal smoothing).
    const freq: Record<string, number> = {};
    labelBufRef.current.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
    const smoothed = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

    // Real confidence = average predict_proba over the frames that actually
    // predicted the smoothed/majority label.
    const matchingConfs = labelBufRef.current
      .map((lbl, i) => (lbl === smoothed ? confBufRef.current[i] : null))
      .filter((c): c is number => c !== null);
    const conf = matchingConfs.length
      ? matchingConfs.reduce((a, b) => a + b, 0) / matchingConfs.length
      : 0;
    const pct = Math.round(conf * 100);

    setPredLabel(smoothed);
    setLabelName(smoothed === 'Nothing' ? 'No sign' : smoothed === 'Space' ? 'SPACE — hold to end word' : 'Sign: ' + smoothed);
    setConfPct(pct);

    if (cooldownRef.current > 0) {
      cooldownRef.current--;
      holdLabelRef.current = null; holdCountRef.current = 0;
      setHoldPct(0);
      setHoldStatus(`Cooldown... (${cooldownRef.current})`);
      return;
    }

    if (smoothed === 'Nothing' || conf < CONFIDENCE_THRESHOLD) {
      holdLabelRef.current = null; holdCountRef.current = 0;
      setHoldPct(0);
      setHoldStatus('Hold a sign steady to type');
      return;
    }

    if (smoothed === holdLabelRef.current) {
      holdCountRef.current++;
    } else {
      holdLabelRef.current = smoothed;
      holdCountRef.current = 1;
    }

    const hp = Math.min((holdCountRef.current / HOLD_FRAMES_REQUIRED) * 100, 100);
    setHoldPct(hp);
    setHoldStatus(hp >= 100 ? '✓ Held!' : `Holding "${smoothed}"... ${Math.round(hp)}%`);

    if (holdCountRef.current >= HOLD_FRAMES_REQUIRED) {
      holdCountRef.current = 0;
      cooldownRef.current = COOLDOWN_FRAMES;

      if (smoothed === 'Space') {
        const completedWord = currentWordRef.current.trim();
        if (completedWord) {
          setWords(prev => [...prev, completedWord]);
          wordsRef.current = [...wordsRef.current, completedWord];
          setCurrentWord('');
          currentWordRef.current = '';
          toast.success(`Word "${completedWord}" added!`);
          addLog('Word committed: ' + completedWord, 'ok');
        } else {
          toast.info('Space — no word to save');
        }
      } else {
        setCurrentWord(prev => prev + smoothed);
        toast.success(`+ ${smoothed}`);
        logActivityEvent('sign_practiced', { sign: smoothed });
      }
    }
  }

  async function captureAndPredict() {
    if (!isRunningRef.current || inFlightRef.current) return;

    const imageB64 = captureFrameAsBase64();
    if (!imageB64) return;

    inFlightRef.current = true;
    try {
      const res = await fetch(PREDICT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageB64 }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const result: PredictResponse = await res.json();
      processHandResult(result);
    } catch (err) {
      addLog('Predict request failed: ' + (err instanceof Error ? err.message : err), 'err');
    } finally {
      inFlightRef.current = false;
    }
  }

  const handleStartRecording = async () => {
    setStatusText('Starting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>(r => { videoRef.current!.onloadedmetadata = () => r(); });
        await videoRef.current.play();
      }
      isRunningRef.current = true;
      setIsRecording(true);
      setStatusText('Running — hold a sign steady to type!');
      addLog('Camera ready', 'ok');
      toast.success('Recording started');
      intervalIdRef.current = window.setInterval(captureAndPredict, CAPTURE_INTERVAL_MS);
    } catch (err) {
      addLog('Camera error: ' + (err instanceof Error ? err.message : err), 'err');
      setStatusText('Camera error');
      toast.error('Could not access camera.');
    }
  };

  const handleStopRecording = () => {
    isRunningRef.current = false;
    if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
    setIsRecording(false);
    setPredLabel('—');
    setLabelName('No hand detected');
    setConfPct(0);
    setHoldPct(0);
    setHoldStatus('Hold a sign steady to type');
    setStatusText('Stopped.');
    holdLabelRef.current = null; holdCountRef.current = 0;
    labelBufRef.current = [];
    confBufRef.current = [];
    handDetectedRef.current = false;
    addLog('Stopped.', 'info');
  };

  function deleteLetter() {
    setCorrectedSentence('');
    if (currentWordRef.current.length > 0) {
      setCurrentWord(prev => prev.slice(0, -1));
      toast.info('Deleted letter');
    } else if (wordsRef.current.length > 0) {
      const last = wordsRef.current[wordsRef.current.length - 1];
      setWords(prev => prev.slice(0, -1));
      setCurrentWord(last);
      toast.info('Restored last word for editing');
    }
  }

  function addSpace() {
    setCorrectedSentence('');
    const w = currentWordRef.current.trim();
    if (w) {
      setWords(prev => [...prev, w]);
      setCurrentWord('');
      toast.success(`Word "${w}" added!`);
    } else {
      toast.error('Type a word first');
    }
  }

  function clearWord() {
    setCurrentWord('');
    toast.info('Word cleared');
  }

  function clearAll() {
    setCurrentWord('');
    setWords([]);
    setCorrectedSentence('');
    toast.info('Cleared everything');
  }

  async function handleFixGrammar() {
    const s = (wordsRef.current.join(' ') + (currentWordRef.current ? (wordsRef.current.length > 0 ? ' ' + currentWordRef.current : currentWordRef.current) : '')).trim();
    if (!s) { toast.error('Type a sentence first'); return; }
    setIsFixingGrammar(true);
    try {
      const res = await fetch(GRAMMAR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: s }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { corrected: string } = await res.json();
      setCorrectedSentence(data.corrected);
      toast.success('Grammar fixed!');
    } catch (err) {
      toast.error('Could not fix grammar: ' + (err instanceof Error ? err.message : err));
    } finally {
      setIsFixingGrammar(false);
    }
  }

  function copySentence() {
    const s = (wordsRef.current.join(' ') + (currentWordRef.current ? (wordsRef.current.length > 0 ? ' ' + currentWordRef.current : currentWordRef.current) : '')).trim();
    if (!s) { toast.error('Nothing to copy'); return; }
    navigator.clipboard.writeText(s).then(() => toast.success('Copied!'));
  }

  function speakSentence() {
    const s = (wordsRef.current.join(' ') + (currentWordRef.current ? (wordsRef.current.length > 0 ? ' ' + currentWordRef.current : currentWordRef.current) : '')).trim();
    if (!s) { toast.error('Nothing to speak'); return; }
    const utt = new SpeechSynthesisUtterance(s);
    utt.rate = 0.9;
    speechSynthesis.speak(utt);
    toast.info('Speaking...');
  }

  const sentence = words.join(' ') + (currentWord ? (words.length > 0 ? ' ' + currentWord : currentWord) : '');
  const confBarColor = confPct / 100 > 0.7 ? '#4ade80' : confPct / 100 > 0.4 ? '#facc15' : '#f87171';
  const predColor = predLabel === 'Nothing' ? '#6b7280' : predLabel === 'Space' ? '#ca8a04' : '#16a34a';

  return (
    <div className="relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.5, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6 px-4 sm:px-0">

        {/* ── Header ── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-teal-900/15">
              <img src="/logo-signtalk.jpeg" alt="SignTalk logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-[1.3] pb-1 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">
                Sign to Text
              </h1>
              <p className="text-sm text-slate-600">Real-time ASL recognition powered by AI</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── LEFT — Camera ── */}
            <div className="flex flex-col gap-4">
              <Card className="shadow-xl border border-white/60 bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="px-5 pt-5 pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-teal-700" />
                    <span className="text-sm font-semibold text-slate-700">Camera Feed</span>
                  </div>
                  {isRecording && (
                    <motion.div className="flex items-center gap-1.5"
                      animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-medium text-red-500">LIVE</span>
                    </motion.div>
                  )}
                </div>

                <CardContent className="p-4 space-y-4">
                  {/* Video */}
                  <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 aspect-video shadow-inner">
                    <video ref={videoRef} className="w-full h-full object-cover block" style={{ transform: 'scaleX(-1)' }}
                      autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
                      style={{ transform: 'scaleX(-1)' }} />
                    {!isRecording && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-sm">
                        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-16 h-16 rounded-full bg-teal-500/20 border-2 border-teal-400/40 flex items-center justify-center">
                          <Camera className="w-7 h-7 text-teal-300" />
                        </motion.div>
                        <p className="text-sm text-slate-300 font-medium">Camera is off</p>
                        <p className="text-xs text-slate-500">Press Start to begin recognition</p>
                      </div>
                    )}
                  </div>

                  {/* Hold progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hold Progress</span>
                      <span className="text-xs font-semibold text-teal-700">{Math.round(holdPct)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <motion.div className="h-full rounded-full"
                        style={{ background: holdPct >= 100 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#0f766e,#f97316)' }}
                        animate={{ width: `${holdPct}%` }} transition={{ duration: 0.08 }} />
                    </div>
                    <p className="text-xs text-gray-400">{holdStatus}</p>
                  </div>

                  {/* Prediction */}
                  <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 shadow-sm">
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-white border-2 shadow-sm"
                      style={{ borderColor: predColor + '55' }}>
                      <span className="text-3xl font-bold leading-none" style={{ color: predColor }}>{predLabel}</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-gray-700">{labelName}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Confidence</span>
                          <span className="text-xs font-semibold" style={{ color: confBarColor }}>{confPct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-150"
                            style={{ width: `${confPct}%`, background: confBarColor }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status chip */}
                  <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs font-medium text-amber-700">{statusText}</p>
                  </div>

                  {/* Start / Stop */}
                  {!isRecording ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      <Button onClick={handleStartRecording}
                        className="w-full h-11 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-white font-semibold shadow-md shadow-teal-900/15 transition-all">
                        <Camera className="w-4 h-4 mr-2" /> Start Recognition
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      <Button onClick={handleStopRecording}
                        className="w-full h-11 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md shadow-red-500/25 transition-all">
                        <StopCircle className="w-4 h-4 mr-2" /> Stop Camera
                      </Button>
                    </motion.div>
                  )}

                  {inferenceError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <span className="text-red-500 text-sm">⚠</span>
                      <p className="text-xs text-red-600">{inferenceError}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── RIGHT — Communication Panel ── */}
            <div className="flex flex-col gap-4">
              <Card className="shadow-xl border border-white/60 bg-white/90 backdrop-blur-sm h-full">
                <div className="px-5 pt-5 pb-0">
                  <span className="text-sm font-semibold text-slate-700">Communication Panel</span>
                </div>

                <CardContent className="p-5 space-y-5">

                  {/* Current Word */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Word</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={deleteLetter}
                          className="h-7 px-2.5 text-xs font-medium text-slate-600"
                        >
                          <Delete className="w-3.5 h-3.5" /> Backspace
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearWord}
                          className="h-7 px-2.5 text-xs font-medium text-slate-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Clear
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 min-h-[60px]">
                      <span className="text-2xl font-semibold tracking-[4px] text-slate-800">
                        {currentWord || <span className="text-slate-400 tracking-normal text-base font-normal italic">Spell a word...</span>}
                      </span>
                      <motion.span className="text-2xl text-teal-600 ml-0.5"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>|</motion.span>
                    </div>
                    <Button
                      onClick={addSpace}
                      className="w-full h-9 bg-teal-700 hover:bg-teal-800 text-sm font-semibold"
                    >
                      <Plus className="w-4 h-4" /> Confirm Word
                    </Button>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Sentence */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Full Sentence</span>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 min-h-[72px]">
                      {sentence
                        ? <p className="text-slate-800 text-sm leading-relaxed break-words font-medium">{sentence}</p>
                        : <p className="text-slate-400 italic text-sm">Your sentence will appear here...</p>
                      }
                    </div>
                  </div>

                  {/* Grammatically corrected sentence */}
                  {correctedSentence && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grammatically Correct</span>
                      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                        <p className="text-teal-900 text-sm leading-relaxed break-words font-medium">{correctedSentence}</p>
                      </div>
                    </div>
                  )}

                  {/* Sentence actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      onClick={speakSentence}
                      className="h-auto flex-col gap-1.5 py-3 text-slate-700"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">Speak</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleFixGrammar}
                      disabled={isFixingGrammar}
                      className="h-auto flex-col gap-1.5 py-3 text-slate-700"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">{isFixingGrammar ? 'Fixing...' : 'Fix Grammar'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={copySentence}
                      className="h-auto flex-col gap-1.5 py-3 text-slate-700"
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-xs font-semibold">Copy</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearAll}
                      className="h-auto flex-col gap-1.5 py-3 text-slate-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">Clear All</span>
                    </Button>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Keyboard shortcuts */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Keyboard Shortcuts</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: '⌫', label: 'Delete letter' },
                        { key: '↵', label: 'Next word' },
                        { key: 'Esc', label: 'Clear all' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 py-2 px-1">
                          <kbd className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.5">{key}</kbd>
                          <span className="text-[10px] text-slate-400 text-center leading-tight">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Tips ── */}
          <Card className="bg-gradient-to-r from-teal-50 to-orange-50 border-teal-200 shadow-lg">
            <CardContent className="pt-4 pb-4">
              <h3 className="font-semibold text-teal-900 mb-3">
                Tips for Better Recognition
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: '💡', text: 'Ensure good lighting' },
                  { icon: '🖐️', text: 'Keep hand visible in frame' },
                  { icon: '⏱️', text: 'Hold each sign ~1 second' },
                  { icon: '🎨', text: 'Use a plain background' },
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2 border border-teal-100 shadow-sm">
                    <span className="text-base leading-none mt-0.5">{tip.icon}</span>
                    <p className="text-xs text-teal-800 leading-snug">{tip.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </motion.div>
      </div>
    </div>
  );
}