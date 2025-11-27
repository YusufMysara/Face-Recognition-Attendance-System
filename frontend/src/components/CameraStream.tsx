import { useEffect, useRef } from "react";

import { attendanceService } from "../services/api";

interface Props {
  sessionId: number | null;
  active: boolean;
  onMarked: (response: any) => void;
}

const CameraStream = ({ sessionId, active, onMarked }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      if (!videoRef.current) return;
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
    };

    const stopCamera = () => {
      intervalRef.current && clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    if (active && sessionId) {
      startCamera();
      intervalRef.current = window.setInterval(async () => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const response = await attendanceService.markFrame(sessionId, blob);
            onMarked(response);
          } catch (err) {
            console.error(err);
          }
        }, "image/jpeg");
      }, 5000);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [active, sessionId, onMarked]);

  return (
    <div>
      <video ref={videoRef} style={{ width: "100%", maxWidth: 500 }} muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default CameraStream;

