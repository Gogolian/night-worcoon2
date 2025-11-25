# Night Worcoon2 - Proxy Server with Frontend Control

A proxy server that listens on port 8079 and forwards requests to port 8078, with optional 5xx error blocking controlled via a Svelte frontend.

## Project Structure

```
night-worcoon2/
├── server/           # Node.js proxy server
│   ├── package.json
│   └── server.js
└── frontend/         # Svelte web interface
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js
        └── App.svelte
```

## Features

- **Proxy Server**: Listens on port 8079, forwards requests to port 8078
- **5xx Error Blocking**: Optional blocking of responses with 5xx status codes
- **Web UI**: Svelte-based frontend to toggle 5xx blocking on/off
- **Status API**: RESTful endpoints to check and update blocking status
- **CORS Support**: Cross-origin requests enabled for frontend

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Two separate services: one on port 8078 (target service), one on port 8079 (proxy)

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start          # Production mode
npm run dev        # Development mode with auto-reload
```

The server will log:
```
Proxy server listening on port 8079
Forwarding requests to http://localhost:8078
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### GET `/api/status`
Returns the current status of 5xx blocking.

**Response:**
```json
{
  "block5xxEnabled": false
}
```

### POST `/api/status`
Updates the 5xx blocking status.

**Request Body:**
```json
{
  "block5xxEnabled": true
}
```

**Response:**
```json
{
  "block5xxEnabled": true
}
```

## Usage

1. **Start the backend service** on port 8078 (your existing service)
2. **Start the proxy server** (`npm start` in `/server`)
3. **Open the frontend** (`npm run dev` in `/frontend`)
4. **Toggle the checkbox** to enable/disable 5xx error blocking
5. **Send requests** to `http://localhost:8079` - they will be proxied to `http://localhost:8078`

When 5xx blocking is enabled:
- If the target service returns a 5xx error, the proxy will return a 502 (Bad Gateway) with a custom error message
- When disabled, all responses pass through unchanged

## Request Flow

```
Client Request → Port 8079 (Proxy) → Port 8078 (Target Service)
                                    ↓
Client Response ← Port 8079 (Proxy) ← Port 8078 (Response)
                  (5xx blocked if enabled)
```

## Development

### Modifying the Proxy Server
- Edit `server/server.js` to add new API endpoints or modify proxy behavior
- Changes in dev mode will auto-reload with `npm run dev`

### Customizing the Frontend
- Edit `frontend/src/App.svelte` to change UI or add features
- Vite will hot-reload changes automatically

## Troubleshooting

- **Port already in use**: Change ports in `server.js` (line ~45) and `vite.config.js` (line ~8)
- **CORS errors**: The proxy has CORS enabled, but verify your target service also allows requests
- **Cannot connect to port 8078**: Ensure your target service is running on port 8078
- **Frontend shows error**: Check browser console and server logs for detailed error messages

## Production Deployment

For production, build the frontend:
```bash
cd frontend
npm run build
```

This creates a `dist` folder with optimized static files.
