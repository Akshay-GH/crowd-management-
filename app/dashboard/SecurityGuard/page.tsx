"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Send,
  LogOut,
  AlertTriangle,
  Play,
  Square,
  Video,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// YOLO Backend URL
const YOLO_API = "http://localhost:8000";
// // YOLO API proxy (routed through Next.js to avoid browser extension blocking)
// const YOLO_API = "/api/yolo";

interface DetectionData {
  ready: boolean;
  ts: number | null;
  fps: number | null;
  counts: Record<string, number>;
  detections: { cls: string; conf: number; xyxy: number[] }[];
  message?: string;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<string[]>([]);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [videoIndex, setVideoIndex] = useState(0);

  // YOLO detection state
  const [yoloRunning, setYoloRunning] = useState(false);
  const [detectionData, setDetectionData] = useState<DetectionData | null>(
    null,
  );
  const [yoloError, setYoloError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if user is logged in and is a teacher/security via API
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/signin");
          return;
        }
        const data = await res.json();
        if (data.user.role !== "SecurityGuard") {
          router.push("/signin");
        } else {
          setUser(data.user);
        }
      } catch {
        router.push("/signin");
      }
    }
    checkAuth();
  }, [router]);

  // ---- YOLO start / stop ----
  const startYolo = useCallback(async () => {
    try {
      setYoloError(null);
      const res = await fetch(`${YOLO_API}/start`, { method: "POST" });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to start YOLO");
        }
      setYoloRunning(true);
    } catch (err: any) {
      setYoloError(err.message ?? "Cannot reach YOLO backend");
    }
  }, []);

  const stopYolo = useCallback(async () => {
    try {
      await fetch(`${YOLO_API}/stop`, { method: "POST" });
      setYoloRunning(false);
      setDetectionData(null);
    } catch {
      // ignore
    }
  }, []);

  // Poll /latest every second for crowd counts
  useEffect(() => {
    if (!yoloRunning) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${YOLO_API}/latest`);
        const data: DetectionData = await res.json();
        if (data.ready) setDetectionData(data);
      } catch {
        /* backend unreachable */
      }
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [yoloRunning]);

  // Check YOLO health on mount
  useEffect(() => {
    async function checkYolo() {
      try {
        const res = await fetch(`${YOLO_API}/health`);
        const data = await res.json();
        setYoloRunning(data.running);
      } catch {
        setYoloError("YOLO backend not reachable at " + YOLO_API);
      }
    }
    checkYolo();
  }, []);

  const totalDetections = detectionData
    ? Object.values(detectionData.counts).reduce((a, b) => a + b, 0)
    : 0;

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real app, you would send this message to your backend
      console.log("Message sent:", message);
      setMessage("");
      // Simulate receiving a response
      setTimeout(() => {
        setNotifications((prev) => [
          ...prev,
          "Your message has been received. Help is on the way.",
        ]);
      }, 1000);
    }
  };

  const handleEmergencyAlert = () => {
    // In a real app, you would send an emergency alert to your backend
    console.log("Emergency alert triggered");
    setNotifications((prev) => [
      ...prev,
      "Emergency alert sent! Help is on the way.",
    ]);
  };

  const handleMedicalEmergency = () => {
    // In a real app, you would send a medical emergency alert to your backend
    console.log("Medical emergency alert triggered");
    setNotifications((prev) => [
      ...prev,
      "Medical emergency alert sent! Ambulance has been notified.",
    ]);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Security Guard Dashboard</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Feed
              </CardTitle>
              <CardDescription>
                {videoIndex === 0
                  ? "Live AI crowd detection stream"
                  : "Original camera feed"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="aspect-video bg-black rounded-md overflow-hidden relative">
                {videoIndex === 0 ? (
                  yoloRunning ? (
                    <img
                      src={`${YOLO_API}/stream`}
                      alt="YOLO live detection stream"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white gap-3">
                      <Video className="h-12 w-12 opacity-50" />
                      <p className="text-sm opacity-70">
                        Detection not running
                      </p>
                      <Button onClick={startYolo} variant="secondary" size="sm">
                        <Play className="mr-2 h-4 w-4" /> Start Detection
                      </Button>
                      {yoloError && (
                        <p className="text-red-400 text-xs mt-2">{yoloError}</p>
                      )}
                    </div>
                  )
                ) : (
                  <video
                    src="/videos/original_crowd.mp4"
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={videoIndex === 0}
                    onClick={() => setVideoIndex(0)}
                  >
                    ← AI Detection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={videoIndex === 1}
                    onClick={() => setVideoIndex(1)}
                  >
                    Original Feed →
                  </Button>
                </div>
                {videoIndex === 0 && (
                  <div className="flex gap-2">
                    {!yoloRunning ? (
                      <Button
                        onClick={startYolo}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Play className="mr-1 h-4 w-4" /> Start
                      </Button>
                    ) : (
                      <Button
                        onClick={stopYolo}
                        size="sm"
                        variant="destructive"
                      >
                        <Square className="mr-1 h-4 w-4" /> Stop
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Crowd Detection Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Crowd Detection Stats
              </CardTitle>
              <CardDescription>
                {yoloRunning
                  ? "Live data from AI detection engine"
                  : "Start detection to see live stats"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {yoloRunning && detectionData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {totalDetections}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        People Detected
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {detectionData.fps ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">FPS</p>
                    </div>
                  </div>
                  {Object.keys(detectionData.counts).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Detected Classes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(detectionData.counts).map(
                          ([cls, count]) => (
                            <Badge key={cls} variant="secondary">
                              {cls}: {count}
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {totalDetections > 50 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>High Crowd Density</AlertTitle>
                      <AlertDescription>
                        {totalDetections} people detected — consider alerting
                        authorities.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {yoloError ? (
                    <p className="text-red-500 text-sm">{yoloError}</p>
                  ) : (
                    <p>No detection data available</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Alerts</CardTitle>
              <CardDescription>
                Press the appropriate button in case of emergency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={handleEmergencyAlert}
              >
                <Bell className="mr-2 h-4 w-4" />
                Security Emergency
              </Button>

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleMedicalEmergency}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Medical Emergency
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Message</CardTitle>
              <CardDescription>
                Send a message to describe the situation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Recent alerts and messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <Alert key={index}>
                    <Bell className="h-4 w-4" />
                    <AlertTitle>Notification</AlertTitle>
                    <AlertDescription>{notification}</AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No notifications yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
