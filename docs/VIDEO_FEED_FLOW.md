# Video Feed Flow — Security Guard Dashboard

## Overview

The Security Guard dashboard displays a **live AI-powered crowd detection video stream** powered by a YOLOv5 backend. The system consists of two parts:

1. **YOLO Backend** (`yolo-backend/yolo_api.py`) — FastAPI server that runs YOLOv5 object detection on a video and streams annotated frames.
2. **Next.js Frontend** (`app/dashboard/SecurityGuard/page.tsx`) — Displays the live MJPEG stream and polls for detection statistics.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Next.js Frontend                       │
│            (SecurityGuard Dashboard)                    │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────┐     │
│  │  Video Feed Card  │    │ Crowd Detection Stats  │    │
│  │                   │    │                        │    │
│  │  <img> ──────────────── GET /stream (MJPEG)     │    │
│  │  (AI Detection)   │    │                        │    │
│  │       or          │    │  Poll GET /latest      │    │
│  │  <video>          │    │  every 1 second        │    │
│  │  (Original Feed)  │    │  → people count        │    │
│  └──────────────────┘    │  → FPS                  │    │
│                           │  → class breakdown     │    │
│  Start → POST /start      └────────────────────────┘    │
│  Stop  → POST /stop                                     │
│  Health check → GET /health                             │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (localhost:8000)
┌────────────────────▼────────────────────────────────────┐
│               YOLO Backend (FastAPI)                     │
│  ┌────────────┐   ┌──────────┐   ┌───────────────────┐  │
│  │ Video File │──▶│ OpenCV   │──▶│ YOLOv5 Inference  │  │
│  │ .mp4       │   │ Capture  │   │ (torch.hub)       │  │
│  └────────────┘   └──────────┘   └─────────┬─────────┘  │
│                                             │            │
│                              ┌──────────────▼──────────┐ │
│                              │ Annotate Frame (bbox)   │ │
│                              │ + Encode as JPEG        │ │
│                              └──────────────┬──────────┘ │
│                                             │            │
│                    ┌────────────────────────▼──────────┐ │
│                    │ Shared State (_latest, _jpeg)     │ │
│                    │  → /stream  (MJPEG generator)     │ │
│                    │  → /latest  (JSON stats)          │ │
│                    └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### 1. Page Load (Frontend)

```
User opens /dashboard/SecurityGuard
         │
         ▼
   Auth check (GET /api/auth/me)
         │
         ├── Not authenticated → redirect to /signin
         │
         ▼
   YOLO health check (GET http://localhost:8000/health)
         │
         ├── Backend reachable → set yoloRunning = data.running
         └── Backend unreachable → show error message
```

### 2. Starting Detection

```
User clicks "Start Detection" button
         │
         ▼
   POST http://localhost:8000/start
         │
         ▼
   Backend spawns a worker thread (_worker_loop)
         │
         ├── Load YOLOv5 model (custom weights or pretrained yolov5s)
         ├── Open video file with OpenCV
         └── Begin processing loop
```

### 3. Backend Processing Loop (Worker Thread)

```
┌─────────────────── LOOP ───────────────────┐
│                                             │
│  1. Read frame from video (cap.read())      │
│     └── If end of video → loop back to 0    │
│                                             │
│  2. Convert BGR → RGB                       │
│                                             │
│  3. Run YOLOv5 inference (model(rgb))       │
│     └── Returns bounding boxes + classes    │
│                                             │
│  4. Parse detections:                       │
│     └── class name, confidence, xyxy coords │
│     └── Count per class                     │
│                                             │
│  5. Annotate frame (draw bboxes + labels)   │
│                                             │
│  6. Encode annotated frame as JPEG          │
│                                             │
│  7. Update shared state (thread-safe):      │
│     └── _latest = {ts, fps, counts, dets}   │
│     └── _latest_jpeg = jpeg bytes           │
│                                             │
│  8. Sleep 1ms → next frame                  │
└─────────────────────────────────────────────┘
```

### 4. MJPEG Stream Delivery (`GET /stream`)

```
Browser <img src="http://localhost:8000/stream">
         │
         ▼
   StreamingResponse (multipart/x-mixed-replace)
         │
         ▼
   Generator loop:
     ┌───────────────────────────────────┐
     │ Read _latest_jpeg from shared state│
     │ Yield as MJPEG frame boundary     │
     │ Sleep 30ms (~33 fps max)          │
     └───────────────────────────────────┘
         │
         ▼
   Browser renders each JPEG frame
   as a continuously updating image
```

### 5. Stats Polling (`GET /latest`)

```
Frontend setInterval (every 1 second)
         │
         ▼
   GET http://localhost:8000/latest
         │
         ▼
   Response JSON:
   {
     "ready": true,
     "ts": 1739500000,
     "fps": 12.5,
     "counts": { "person": 23 },
     "detections": [
       { "cls": "person", "conf": 0.87, "xyxy": [100, 200, 300, 400] },
       ...
     ]
   }
         │
         ▼
   Frontend updates:
     → People Detected count
     → FPS display
     → Class breakdown badges
     → High Crowd Density alert (>50 people)
```

### 6. Stopping Detection

```
User clicks "Stop" button
         │
         ▼
   POST http://localhost:8000/stop
         │
         ▼
   Backend sets _running = False
         │
         ▼
   Worker thread exits loop → releases video capture
   Frontend clears polling interval
   Stream <img> is replaced with placeholder UI
```

---

## API Endpoints

| Method | Endpoint  | Description                            |
| ------ | --------- | -------------------------------------- |
| GET    | `/health` | Returns `{ ok, running, ts }`          |
| POST   | `/start`  | Starts the detection worker thread     |
| POST   | `/stop`   | Stops the detection worker thread      |
| GET    | `/latest` | Returns latest detection stats as JSON |
| GET    | `/stream` | MJPEG stream of annotated video frames |
| GET    | `/docs`   | FastAPI Swagger UI (auto-generated)    |

---

## Frontend Components

### Video Feed Card (Two Views)

| View          | Source                         | Type          |
| ------------- | ------------------------------ | ------------- |
| AI Detection  | `http://localhost:8000/stream` | MJPEG `<img>` |
| Original Feed | `/videos/original_crowd.mp4`   | `<video>` tag |

- Toggle between views using "AI Detection" / "Original Feed" buttons
- Start/Stop buttons appear only on the AI Detection view

### Crowd Detection Stats Card

- **People Detected** — total count from `detectionData.counts`
- **FPS** — inference speed from the backend
- **Detected Classes** — badges showing each class and count
- **High Crowd Density Alert** — red alert when count exceeds 50

---

## File Locations

```
crowd-resq-updated/
├── yolo-backend/
│   ├── yolo_api.py                  ← FastAPI YOLO server
│   ├── dataset/test_video/
│   │   └── original_crowd.mp4       ← Source video for detection
│   └── runs/train/.../best.pt       ← Custom trained weights (optional)
│
└── crowd-management-/
    ├── app/dashboard/SecurityGuard/
    │   └── page.tsx                  ← Dashboard with live stream
    └── public/videos/
        └── original_crowd.mp4        ← Static video for "Original Feed"
```

---

## How to Run

1. **Start YOLO backend:**

   ```bash
   cd yolo-backend
   venv\Scripts\activate
   python -m uvicorn yolo_api:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Start Next.js frontend:**

   ```bash
   cd crowd-management-
   pnpm dev
   ```

3. **Open dashboard:** http://localhost:3000/dashboard/SecurityGuard

4. **Click "Start Detection"** to begin the live AI video feed.

---

## CORS Configuration

The YOLO backend allows requests from the Next.js dev server:

```python
allow_origins=["http://localhost:3000"]
```

If deploying to a different domain, update this in `yolo_api.py`.

---

## Troubleshooting

| Issue                        | Cause                  | Fix                                           |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| "YOLO backend not reachable" | Backend not running    | Start uvicorn server on port 8000             |
| Stream loads but no video    | Worker not started     | Click "Start Detection" or call `POST /start` |
| `ModuleNotFoundError`        | Missing Python package | `pip install ultralytics pandas seaborn tqdm` |
| Video file not found         | Wrong path in config   | Check `SOURCE_VIDEO` in `yolo_api.py`         |
| CORS error in browser        | Origin not allowed     | Add your frontend URL to `allow_origins`      |
