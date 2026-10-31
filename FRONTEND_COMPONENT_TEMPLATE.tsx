/**
 * VideoCallWithSignDetection Component
 * 
 * Integrates real-time sign language detection into video calls.
 * Captures video frames, sends to backend via WebSocket, displays predictions.
 * 
 * Usage:
 * <VideoCallWithSignDetection
 *   token={liveKitToken}
 *   url={liveKitUrl}
 *   roomId={roomId}
 *   authToken={jwtToken}
 * />
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SignPrediction {
  type: 'prediction';
  room_id: string;
  user_id: string;
  frame_number: number;
  prediction_number: number;
  sign: string | null;
  confidence: number;
  processing_time_ms: number;
  hand_detected: boolean;
  error?: string;
}

interface VideoCallWithSignDetectionProps {
  token: string;
  url: string;
  roomId: string;
  authToken: string;
}

const VideoCallWithSignDetection: React.FC<VideoCallWithSignDetectionProps> = ({
  token,
  url,
  roomId,
  authToken,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [prediction, setPrediction] = useState<SignPrediction | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    framesReceived: 0,
    predictionsReceived: 0,
    lastPredictionTime: 0,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const initWebSocket = () => {
      try {
        // Construct WebSocket URL
        const wsProtocol = url.includes('https') ? 'wss' : 'ws';
        const baseUrl = url
          .replace(/^https?:\/\//, '')
          .replace(/^wss?:\/\//, '')
          .replace(/\/$/, '');
        
        const wsUrl = `${wsProtocol}://${baseUrl}/meetings/ws/${roomId}/sign-detect?token=${authToken}`;
        
        console.log('Connecting to sign detection WebSocket...');
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('✅ Sign detection WebSocket connected');
          setConnected(true);
          setError(null);
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as SignPrediction;
            
            if (data.type === 'prediction') {
              setPrediction(data);
              setStats((prev) => ({
                ...prev,
                predictionsReceived: prev.predictionsReceived + 1,
                lastPredictionTime: Date.now(),
              }));
              
              if (data.sign) {
                console.log(
                  `📍 Detected: ${data.sign} (${(data.confidence * 100).toFixed(1)}%)`
                );
              }
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        wsRef.current.onerror = (event) => {
          console.error('❌ WebSocket error:', event);
          setError('WebSocket connection error');
          setConnected(false);
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket connection closed');
          setConnected(false);
        };
      } catch (e) {
        console.error('Error initializing WebSocket:', e);
        setError(String(e));
      }
    };

    initWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, authToken, url]);

  // Capture and send video frames
  useEffect(() => {
    const captureAndSendFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions to match video
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        // Draw video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0);

        // Convert canvas to blob (JPEG)
        canvas.toBlob(
          (blob) => {
            if (!blob || wsRef.current?.readyState !== WebSocket.OPEN) return;

            // Convert blob to base64
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              
              // Send to backend
              wsRef.current?.send(
                JSON.stringify({
                  type: 'frame',
                  data: base64,
                })
              );

              setStats((prev) => ({
                ...prev,
                framesReceived: prev.framesReceived + 1,
              }));
            };
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.8 // JPEG quality (80%)
        );
      } catch (e) {
        console.error('Error capturing frame:', e);
      }
    };

    // Send frames every 100ms (10 FPS)
    frameIntervalRef.current = setInterval(captureAndSendFrame, 100);

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="video-call-with-sign-detection">
      {/* Video Container */}
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-element"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Prediction Overlay */}
        {prediction && prediction.sign && (
          <div className="prediction-overlay">
            <div className="prediction-content">
              <h3 className="prediction-label">Sign Detected</h3>
              <p className="sign-name">{prediction.sign.toUpperCase()}</p>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${prediction.confidence * 100}%`,
                  }}
                />
              </div>
              <p className="confidence-text">
                {(prediction.confidence * 100).toFixed(1)}% Confidence
              </p>
              <p className="processing-time">
                ⚡ {prediction.processing_time_ms.toFixed(1)}ms
              </p>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="status-badge">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'}
          </span>
          <span className="status-text">
            {connected ? 'Sign Detection Active' : 'Connecting...'}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
          </div>
        )}
      </div>

      {/* Stats Panel (Optional - for debugging) */}
      <div className="stats-panel">
        <h4>Sign Detection Stats</h4>
        <ul>
          <li>Status: {connected ? '✅ Connected' : '❌ Disconnected'}</li>
          <li>Frames Sent: {stats.framesReceived}</li>
          <li>Predictions Received: {stats.predictionsReceived}</li>
          {prediction && (
            <li>Last Sign: {prediction.sign} ({(prediction.confidence * 100).toFixed(0)}%)</li>
          )}
        </ul>
      </div>

      {/* Styles */}
      <style>{`
        .video-call-with-sign-detection {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #000;
        }

        .video-container {
          position: relative;
          flex: 1;
          width: 100%;
          height: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .prediction-overlay {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.85);
          border: 2px solid #4CAF50;
          border-radius: 8px;
          padding: 16px;
          min-width: 280px;
          animation: slideIn 0.3s ease-out;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .prediction-content {
          color: white;
        }

        .prediction-label {
          margin: 0 0 8px 0;
          font-size: 11px;
          font-weight: bold;
          color: #4CAF50;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .sign-name {
          margin: 0 0 12px 0;
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          text-transform: capitalize;
        }

        .confidence-bar {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #45a049);
          transition: width 0.2s ease;
        }

        .confidence-text {
          margin: 0 0 6px 0;
          font-size: 13px;
          color: #aaa;
          font-weight: 500;
        }

        .processing-time {
          margin: 0;
          font-size: 12px;
          color: #888;
        }

        .status-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .status-indicator {
          font-size: 12px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          color: white;
          font-size: 12px;
          font-weight: 500;
        }

        .error-message {
          position: absolute;
          top: 60px;
          right: 12px;
          background: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 13px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .error-message p {
          margin: 0;
        }

        .stats-panel {
          background: rgba(50, 50, 50, 0.9);
          color: white;
          padding: 12px 16px;
          font-size: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          max-height: 120px;
          overflow-y: auto;
        }

        .stats-panel h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #4CAF50;
          text-transform: uppercase;
        }

        .stats-panel ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .stats-panel li {
          margin: 4px 0;
          color: #aaa;
        }
      `}</style>
    </div>
  );
};

export default VideoCallWithSignDetection;
