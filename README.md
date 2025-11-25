# Night Worcoon2 - HTTP/HTTPS Proxy Server

A minimalistic proxy server for development debugging and testing, with plugin system and web-based control interface.

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

- **Proxy Server**: HTTP/HTTPS proxy with configurable port and target
- **Plugin System**: Modular plugins with execution order control
  - **Logger**: Request/response logging
  - **CORS**: Cross-origin request handling
  - **Mock**: Mock response injection
  - **Recorder**: Request/response recording and replay
- **Web UI**: Svelte-based frontend for configuration and monitoring
- **Configuration Sets**: Save and switch between different proxy configurations
- **RESTful API**: Full control via HTTP endpoints

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

### GET `/__api/plugins`
Returns all plugins with their configuration and status.

### POST `/__api/plugins/:name`
Enable or disable a specific plugin.

### POST `/__api/plugins/order`
Update plugin execution order.

### GET `/__api/config`
Get current proxy configuration.

### POST `/__api/config`
Update proxy configuration.

### GET `/__api/config-sets`
Get all saved configuration sets.

### POST `/__api/config-sets`
Create a new configuration set.

### POST `/__api/config-sets/:id/activate`
Switch to a different configuration set.

## Usage

1. **Start the target service** (the service you want to proxy)
2. **Start the proxy server** (`npm start` in `/server`)
3. **Open the web interface** (`npm run dev` in `/frontend`)
4. **Configure plugins** - enable/disable and configure plugin options
5. **Configure target** - set target URL and request headers in Settings
6. **Send requests** to the proxy port - they will be processed through plugins and forwarded to the target

### Plugin System

Plugins process requests and responses in order:
1. **Logger** - Logs all requests and responses
2. **CORS** - Handles CORS headers
3. **Mock** - Can return mock responses instead of proxying
4. **Recorder** - Records and replays request/response pairs

## Request Flow

```
Client Request → Proxy Server → Plugins (Request Phase) → Target Service
                                  ↓ (Logger, CORS, Mock, Recorder)
                                  
Client Response ← Proxy Server ← Plugins (Response Phase) ← Target Service
                                  ↓ (Recorder, Logger)
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
