# WebSocket Proxying Implementation Plan

## Overview
Add WebSocket proxying capabilities to the night-worcoon2 proxy server, following existing plugin architecture patterns. Enable message inspection, modification, logging, and recording similar to current HTTP functionality.

---

## Implementation Steps

### 1. Create WebSocket Plugin (`server/plugins/websocket.js`)
Follow existing plugin interface pattern with WebSocket-specific functionality.

**Requirements:**
- Implement plugin structure matching `cors.js`, `logger.js`, `recorder.js` patterns
- Handler returns `modifyWebSocketMessage` function for bidirectional message interception
- Support both client→server and server→client message flows
- Configuration options schema:
  - `enabled: boolean` - Master toggle
  - `logMessages: boolean` - Log WS messages to console
  - `recordMessages: boolean` - Save messages to disk
  - `modificationRules: array` - User-defined message transformation rules

**Key Capabilities:**
- Access to WebSocket upgrade request context
- Message interception before forwarding
- Message modification/blocking
- Metadata attachment (timestamps, connection IDs, etc.)

---

### 2. Add WebSocket Proxy Handler (`server/server.js`)
Extend main server to handle WebSocket upgrade requests.

**Requirements:**
- Implement `server.on('upgrade')` event listener
- Execute WebSocket plugin pipeline via `pluginController.processRequest`
- Use `proxy.ws(req, socket, head, options)` from http-proxy library
- Manual socket event handling:
  - `socket.on('message')` - Intercept messages
  - `socket.on('close')` - Track connection termination
  - `socket.on('error')` - Error handling
- Apply plugin modifications to messages before forwarding
- Maintain connection state for tracking

**Integration Points:**
- Reuse existing `httpProxy.createProxyServer()` instance
- Follow `debugLog` pattern for WebSocket events
- Use existing error handling patterns
- Respect active config set's target URL

**Example Flow:**
```javascript
server.on('upgrade', async (req, socket, head) => {
  // 1. Execute plugin pipeline
  const decision = await pluginController.processWebSocketUpgrade({ req, config });
  
  // 2. Check if connection should be blocked
  if (decision.action === 'block') {
    socket.end();
    return;
  }
  
  // 3. Setup message interception
  const messageHandler = decision.modifyWebSocketMessage;
  
  // 4. Proxy WebSocket connection
  proxy.ws(req, socket, head, proxyOptions);
  
  // 5. Intercept messages bidirectionally
  setupMessageInterception(socket, messageHandler);
});
```

---

### 3. Extend Plugin Controller (`server/pluginController.js`)
Add WebSocket-specific plugin execution methods.

**Requirements:**
- New method: `processWebSocketUpgrade(context)` - Handle WS connection establishment
- New method: `processWebSocketMessage(context)` - Handle individual messages
- Context object for WebSocket upgrade:
  ```javascript
  {
    req,              // Upgrade request
    config,           // Active config set
    decision: {}      // Initial decision object
  }
  ```
- Context object for WebSocket messages:
  ```javascript
  {
    direction,        // 'client-to-server' | 'server-to-client'
    message,          // Buffer or string
    socket,           // WebSocket socket
    connectionId,     // Unique connection identifier
    config,           // Plugin config
    decision: {}      // Accumulated decision
  }
  ```

**Plugin Execution:**
- Execute enabled plugins in configured order
- Each plugin can modify message or metadata
- Support `stopProcessing` flag to halt pipeline
- Return aggregated decision object

---

### 4. WebSocket State Management (`stateManager.js`)
Extend state.json schema with WebSocket configuration.

**Requirements:**
- Add to state.json schema:
  ```json
  {
    "plugins": {
      "websocket": true
    },
    "websocketConfig": {
      "enabled": true,
      "logMessages": true,
      "recordMessages": false,
      "maxConnections": 100,
      "maxMessageSize": 1048576,
      "modificationRules": []
    },
    "activeWebSocketConnections": []
  }
  ```
- Hot-reload support via existing `saveState()` pattern
- Connection tracking in memory (not persisted)
- Message modification rules persistence

**State Operations:**
- `getWebSocketConfig(state)` - Retrieve WS config
- `updateWebSocketConfig(state, updates)` - Update and persist config
- Track active connections (in-memory only)

---

### 5. WebSocket API Endpoints (`server/routes/websocket.js`)
Create REST API for WebSocket monitoring and configuration.

**Required Endpoints:**

#### GET `/__api/websocket/connections`
- Returns list of active WebSocket connections
- Response format:
  ```json
  {
    "connections": [
      {
        "id": "conn_12345",
        "url": "ws://example.com/chat",
        "connectedAt": "2025-12-04T10:30:00Z",
        "messagesReceived": 42,
        "messagesSent": 38,
        "lastActivity": "2025-12-04T10:35:00Z"
      }
    ]
  }
  ```

#### GET `/__api/websocket/messages`
- Returns recent message log (last N messages)
- Query params: `?limit=100&connectionId=conn_12345`
- Response format:
  ```json
  {
    "messages": [
      {
        "id": "msg_67890",
        "connectionId": "conn_12345",
        "direction": "client-to-server",
        "timestamp": "2025-12-04T10:35:00Z",
        "size": 256,
        "preview": "First 100 chars...",
        "contentType": "json|text|binary"
      }
    ]
  }
  ```

#### POST `/__api/websocket/config`
- Updates WebSocket configuration
- Request body: partial websocketConfig object
- Hot-reloads plugin configuration
- Response: updated config

#### GET `/__api/websocket/recordings/:folder`
- Lists recorded WebSocket messages for folder
- Similar to existing `GET /__api/recordings/files/:folder`
- Returns file list with metadata

#### GET `/__api/websocket/recordings/content/:folder/:file`
- Retrieves recorded message content
- Similar to existing recordings content endpoint

---

### 6. WebSocket UI Component (`frontend/src/views/plugins/WebSocketPlugin.svelte`)
Create plugin-specific UI following existing patterns.

**Requirements:**
- Follow structure of `RecorderPlugin.svelte` and `MockPlugin.svelte`
- Use existing atomic components (Button, Card, Checkbox, Input, Badge, etc.)
- Register in `App.svelte` pluginComponents map

**UI Sections:**

#### Section 1: Configuration Panel
- Toggle: Enable WebSocket proxying
- Toggle: Log messages to console
- Toggle: Record messages to disk
- Input: Max connections limit
- Input: Max message size (bytes)

#### Section 2: Active Connections Monitor
- Table/Card list showing active WebSocket connections
- Columns: Connection ID, URL, Duration, Message Count, Last Activity
- Actions: Close connection, View messages, Enable/Disable recording per connection
- Auto-refresh every 2-3 seconds

#### Section 3: Message Log Viewer
- Real-time or near-real-time message log
- Filter by connection ID
- Filter by direction (client→server, server→client, both)
- Display: Timestamp, Direction badge, Message preview, Size
- Click to expand full message with syntax highlighting
- Copy message button
- Clear log button

#### Section 4: Message Modification Rules
- Similar to Mock Plugin's rule editor
- Rule structure:
  - URL pattern (regex or substring)
  - Direction filter
  - Message pattern (regex or JSON path)
  - Transformation (replace, modify JSON field, block, etc.)
- Add/Edit/Delete/Duplicate rule actions
- Enable/Disable per rule
- Rule priority/order

#### Section 5: Recordings Browser (Optional)
- Similar to Recordings view but for WebSocket messages
- Folder tree navigation
- File list with message previews
- "Use as Mock" button to create rule from recorded message

**Component Structure:**
```svelte
<script>
  import { onMount } from 'svelte';
  import { plugins } from '../../stores/plugins.js';
  import { wsConnections, wsMessages, wsConfig } from '../../stores/websocket.js';
  import Card from '../molecules/Card.svelte';
  import Button from '../atoms/Button.svelte';
  // ... other imports
  
  $: plugin = $plugins.find(p => p.name === 'websocket');
  
  onMount(async () => {
    await loadWebSocketConfig();
    startPolling(); // or establish WS connection for live updates
  });
</script>

<div class="websocket-plugin">
  <Card title="WebSocket Configuration">
    <!-- Config toggles and inputs -->
  </Card>
  
  <Card title="Active Connections ({$wsConnections.length})">
    <!-- Connection list -->
  </Card>
  
  <Card title="Message Log">
    <!-- Message viewer -->
  </Card>
  
  <Card title="Modification Rules">
    <!-- Rule editor -->
  </Card>
</div>
```

---

### 7. WebSocket Store (`frontend/src/stores/websocket.js`)
Create Svelte store for WebSocket state management.

**Requirements:**
- Follow patterns from `plugins.js` and `proxy.js` stores
- Writable stores for reactive UI updates
- API communication functions

**Store Structure:**
```javascript
import { writable, derived } from 'svelte/store';

// Core stores
export const connections = writable([]);
export const messageLog = writable([]);
export const wsConfig = writable({
  enabled: false,
  logMessages: true,
  recordMessages: false,
  maxConnections: 100,
  maxMessageSize: 1048576,
  modificationRules: []
});

// Derived stores
export const activeConnectionCount = derived(
  connections,
  $connections => $connections.length
);

export const filteredMessages = derived(
  [messageLog, /* filters */],
  ([$messageLog, /* filters */]) => {
    // Apply filtering logic
  }
);

// API functions
export async function fetchConnections() {
  const res = await fetch('/__api/websocket/connections');
  const data = await res.json();
  connections.set(data.connections);
}

export async function fetchMessages(limit = 100, connectionId = null) {
  const params = new URLSearchParams({ limit });
  if (connectionId) params.append('connectionId', connectionId);
  
  const res = await fetch(`/__api/websocket/messages?${params}`);
  const data = await res.json();
  messageLog.set(data.messages);
}

export async function updateConfig(updates) {
  const res = await fetch('/__api/websocket/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  wsConfig.set(data);
}

export async function closeConnection(connectionId) {
  await fetch(`/__api/websocket/connections/${connectionId}`, {
    method: 'DELETE'
  });
  await fetchConnections();
}

// Optional: Real-time updates via WebSocket
let updateSocket = null;

export function startLiveUpdates() {
  if (updateSocket) return;
  
  updateSocket = new WebSocket('ws://localhost:8079/__ws/updates');
  
  updateSocket.onmessage = (event) => {
    const update = JSON.parse(event.data);
    
    switch (update.type) {
      case 'connection':
        fetchConnections();
        break;
      case 'message':
        messageLog.update(log => [...log, update.message].slice(-1000));
        break;
    }
  };
}

export function stopLiveUpdates() {
  if (updateSocket) {
    updateSocket.close();
    updateSocket = null;
  }
}
```

---

### 8. Message Recording Implementation
Extend WebSocket plugin with recording functionality.

**Requirements:**
- Follow existing recorder plugin patterns
- Directory structure: `recordings/active/websocket/{pathname}/`
- Filename format: `WS_{direction}_{YYYYMMDD}_{HHMMSS}_{mmm}.json`
  - Direction: `C2S` (client-to-server) or `S2C` (server-to-client)
  - Example: `WS_C2S_20251204_103045_123.json`

**Recording File Format:**
```json
{
  "connectionId": "conn_12345",
  "url": "ws://example.com/chat",
  "direction": "client-to-server",
  "timestamp": "2025-12-04T10:30:45.123Z",
  "headers": {
    "upgrade": "websocket",
    "connection": "Upgrade",
    "sec-websocket-key": "...",
    "sec-websocket-version": "13"
  },
  "messageType": "text",
  "message": {
    "type": "chat",
    "content": "Hello World"
  },
  "metadata": {
    "size": 256,
    "encoding": "utf-8"
  }
}
```

**Recording Logic:**
- Only record when `recordMessages: true` in config
- Attempt to parse JSON messages for pretty storage
- Store binary messages as base64
- Create directory structure on-demand
- Optional: Implement duplicate detection similar to HTTP recorder
- Optional: Separate recordings by connection ID or URL pattern

**API Integration:**
- Reuse existing `/__api/recordings/*` endpoints where possible
- Add WebSocket-specific filtering in recordings list
- Support browsing WebSocket recordings separately from HTTP

---

## Further Considerations

### 1. Message Format Handling
**Question:** WebSocket messages can be text or binary. Should we auto-detect JSON and pretty-print, or provide format selector?

**Recommendation:** 
- Auto-detect JSON in text messages and parse for display
- Provide format selector dropdown: JSON / Text / Hex / Base64
- Store original format in recordings for accuracy
- Syntax highlighting for JSON messages using existing editor (ACE or highlight.js)

**Implementation:**
```javascript
function detectMessageFormat(message) {
  if (Buffer.isBuffer(message)) return 'binary';
  
  try {
    JSON.parse(message);
    return 'json';
  } catch {
    return 'text';
  }
}
```

---

### 2. Real-Time UI Updates
**Question:** Should the frontend WebSocket viewer use actual WebSocket connection to server for live message streaming, or rely on polling?

**Recommendation:**
- **Phase 1 (Initial):** Use polling every 2-3 seconds for simplicity
- **Phase 2 (Enhancement):** Add WebSocket connection for live updates

**Reasoning:**
- Polling is simpler to implement initially
- WebSocket for UI updates is more efficient for high-traffic scenarios
- Can add live updates later without breaking existing functionality

**Implementation Path:**
1. Start with `setInterval()` polling in `WebSocketPlugin.svelte`
2. Add optional `/__ws/updates` endpoint for live updates
3. Use feature flag to enable/disable live updates
4. Fallback to polling if WebSocket fails

---

### 3. Message Modification Rules
**Question:** Define rule format for conditional message modification.

**Recommendation:** Create dedicated WebSocket rule format similar to Mock plugin but simpler.

**Rule Structure:**
```javascript
{
  id: 'rule_123',
  enabled: true,
  name: 'Transform chat messages',
  urlPattern: '/chat',              // Substring or regex
  urlPatternType: 'substring',      // 'substring' | 'regex'
  direction: 'both',                // 'client-to-server' | 'server-to-client' | 'both'
  
  // Message matching
  messagePattern: {
    type: 'json-path',              // 'json-path' | 'regex' | 'exact' | 'any'
    value: '$.type',                // JSON path or regex pattern
    matchValue: 'chat'              // Expected value
  },
  
  // Transformation
  action: 'modify',                 // 'modify' | 'block' | 'replace' | 'log'
  transformation: {
    type: 'json-field',             // 'json-field' | 'regex-replace' | 'full-replace'
    path: '$.content',              // For json-field
    operation: 'replace',           // 'replace' | 'append' | 'remove'
    value: 'CENSORED'
  }
}
```

**Example Rules:**
```javascript
// Block all messages to /admin
{
  name: 'Block admin WebSocket',
  urlPattern: '/admin',
  direction: 'both',
  messagePattern: { type: 'any' },
  action: 'block'
}

// Censor profanity in chat
{
  name: 'Censor profanity',
  urlPattern: '/chat',
  direction: 'server-to-client',
  messagePattern: {
    type: 'json-path',
    value: '$.type',
    matchValue: 'message'
  },
  action: 'modify',
  transformation: {
    type: 'json-field',
    path: '$.content',
    operation: 'replace',
    value: (original) => original.replace(/badword/gi, '***')
  }
}
```

**Implementation:**
- Store rules in state.json under `websocketConfig.modificationRules`
- Execute rules in order (priority field for sorting)
- First matching rule wins (or all rules apply, configurable)
- Support JavaScript functions for complex transformations (eval with caution)

---

### 4. Connection Filtering
**Question:** With multiple WebSocket connections, how should users select which to monitor/modify?

**Recommendation:** Multi-level filtering approach.

**Filtering Options:**
1. **Global URL Pattern Matching:**
   - Configure in WebSocket plugin settings
   - Only proxy/monitor WebSockets matching pattern
   - Example: Only monitor WebSockets to `/api/*` paths

2. **Per-Connection Controls:**
   - Connection list shows all active WebSockets
   - Toggle buttons per connection:
     - 📊 Monitor (show messages in log)
     - 💾 Record (save to disk)
     - ✏️ Modify (apply modification rules)
   - Default: all enabled

3. **Message Log Filtering:**
   - Dropdown: Filter by connection ID
   - Dropdown: Filter by direction
   - Search: Filter by message content (client-side)
   - Date/time range picker

**UI Implementation:**
```svelte
<Card title="Active Connections">
  <div class="connection-list">
    {#each $wsConnections as conn}
      <div class="connection-item">
        <span class="conn-url">{conn.url}</span>
        <span class="conn-stats">{conn.messageCount} msgs</span>
        <div class="conn-controls">
          <Checkbox bind:checked={conn.monitor} label="📊" />
          <Checkbox bind:checked={conn.record} label="💾" />
          <Checkbox bind:checked={conn.modify} label="✏️" />
          <Button size="small" on:click={() => closeConnection(conn.id)}>
            Close
          </Button>
        </div>
      </div>
    {/each}
  </div>
</Card>
```

---

### 5. Performance Impact
**Question:** Message interception requires buffering and parsing. Should we add rate limits?

**Recommendation:** Add configurable limits with sensible defaults.

**Configuration Options:**
```javascript
websocketConfig: {
  // Connection limits
  maxConnections: 100,              // Max concurrent WebSocket connections
  connectionTimeout: 3600000,       // 1 hour max connection lifetime
  
  // Message limits
  maxMessageSize: 1048576,          // 1MB max message size
  maxMessagesPerSecond: 1000,       // Rate limit per connection
  maxBufferedMessages: 10000,       // Max messages in memory log
  
  // Recording limits
  maxRecordingSize: 104857600,      // 100MB max recording folder size
  autoArchiveAfterMB: 500,          // Auto-archive when exceeding
  maxRecordingsPerConnection: 1000  // Max recorded messages per connection
}
```

**Implementation:**
- Check `maxConnections` before accepting new WebSocket upgrade
- Check `maxMessageSize` before processing message
- Implement rate limiting per connection (token bucket algorithm)
- Circular buffer for in-memory message log
- Auto-archive or cleanup old recordings

**Error Handling:**
- Connection limit exceeded → Reject upgrade with 503 status
- Message size exceeded → Close connection with code 1009 (Message Too Big)
- Rate limit exceeded → Drop messages or close connection (configurable)
- Provide warnings in UI when approaching limits

---

### 6. Security Considerations
**Question:** WebSocket upgrades bypass some HTTP middleware. How to ensure security?

**Recommendation:** Run plugin pipeline on upgrade request before proxying.

**Security Checks:**
1. **Authentication/Authorization:**
   - Execute plugin pipeline on `upgrade` request
   - CORS plugin should validate Origin header
   - Custom auth plugins can block unauthorized upgrades
   - Return 401/403 before upgrade completion if unauthorized

2. **Input Validation:**
   - Validate WebSocket upgrade headers
   - Check Sec-WebSocket-Version, Sec-WebSocket-Key
   - Validate origin against allowlist (if configured)

3. **Rate Limiting:**
   - Implement connection rate limiting per IP
   - Track connection attempts in rolling window
   - Block IPs exceeding threshold

4. **Message Sanitization:**
   - Validate message format before proxying
   - Strip dangerous content if configured
   - Apply XSS protection for web-based message viewers

**Implementation:**
```javascript
server.on('upgrade', async (req, socket, head) => {
  // 1. Run plugin pipeline (includes auth, CORS, etc.)
  const decision = await pluginController.processWebSocketUpgrade({
    req,
    config: getActiveConfigSet(state)
  });
  
  // 2. Check if connection should be blocked
  if (decision.action === 'block' || decision.action === 'mock') {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // 3. Validate WebSocket headers
  if (!isValidWebSocketUpgrade(req)) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // 4. Rate limiting check
  if (isRateLimited(req)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // 5. Proceed with proxying
  proxy.ws(req, socket, head, proxyOptions);
});
```

**Plugin Integration:**
```javascript
// In cors.js plugin
handler: async ({ req, config, decision }) => {
  if (req.headers.upgrade === 'websocket') {
    const origin = req.headers.origin;
    if (config.origins && !config.origins.includes(origin)) {
      return { action: 'block' };
    }
  }
  return decision;
}
```

---

## Implementation Order

Recommended implementation order for incremental development:

1. **Phase 1: Basic Proxying (MVP)**
   - Create WebSocket plugin skeleton
   - Add `server.on('upgrade')` handler
   - Implement basic `proxy.ws()` proxying (no modification)
   - Add WebSocket config to state.json
   - Create basic UI toggle in WebSocketPlugin.svelte

2. **Phase 2: Message Interception**
   - Extend pluginController for WebSocket messages
   - Implement message interception in upgrade handler
   - Add logging to console (debugLog)
   - Create in-memory message log
   - Add API endpoint for message retrieval

3. **Phase 3: UI Development**
   - Build WebSocketPlugin.svelte component
   - Create websocket.js store
   - Implement active connections monitor
   - Implement message log viewer
   - Add polling for UI updates

4. **Phase 4: Recording**
   - Implement message recording to disk
   - Create directory structure
   - Add recording toggle in UI
   - Integrate with existing recordings browser
   - Add API endpoints for recorded messages

5. **Phase 5: Modification Rules**
   - Design rule format
   - Implement rule matching engine
   - Add rule editor UI
   - Implement message transformation logic
   - Add rule persistence

6. **Phase 6: Enhancement**
   - Add real-time UI updates via WebSocket
   - Implement rate limiting
   - Add security validations
   - Optimize performance
   - Add advanced filtering

---

## Testing Strategy

### Unit Tests
- Plugin handler functions
- Message transformation logic
- Rule matching engine
- State management functions

### Integration Tests
- WebSocket upgrade flow
- Message proxying with modifications
- Recording functionality
- API endpoints

### Manual Testing Scenarios
1. **Basic Proxying:**
   - Start proxy, connect WebSocket client, verify messages flow

2. **Message Modification:**
   - Create rule to modify JSON field
   - Send message, verify transformation

3. **Recording:**
   - Enable recording, send messages
   - Verify files created with correct format

4. **Multiple Connections:**
   - Open multiple WebSocket connections
   - Verify each tracked separately
   - Test connection filtering

5. **Error Handling:**
   - Test connection limits
   - Test message size limits
   - Test rate limiting
   - Test malformed messages

6. **UI Functionality:**
   - Test all toggles and controls
   - Verify message log updates
   - Test rule editor CRUD operations
   - Test connection list refresh

---

## Success Criteria

- [ ] WebSocket connections successfully proxied through server
- [ ] Messages visible in real-time or near-real-time UI
- [ ] Message modification rules working as configured
- [ ] Messages recorded to disk in correct format
- [ ] UI shows active connections with statistics
- [ ] Configuration persisted and hot-reloadable
- [ ] No breaking changes to existing HTTP proxy functionality
- [ ] Performance acceptable with 100+ concurrent connections
- [ ] Security validations prevent unauthorized access
- [ ] Documentation updated with WebSocket usage examples

---

## Documentation Requirements

After implementation, update:
1. **README.md** - Add WebSocket proxying feature description
2. **User Guide** - Add section on WebSocket configuration and usage
3. **API Documentation** - Document new WebSocket endpoints
4. **Plugin Documentation** - Explain WebSocket plugin options
5. **Examples** - Provide sample WebSocket modification rules

---

## Future Enhancements (Post-MVP)

- [ ] WebSocket message search/filtering in recordings
- [ ] Export messages as HAR or custom format
- [ ] WebSocket protocol inspection (subprotocols, extensions)
- [ ] Replay recorded WebSocket sessions
- [ ] Mock WebSocket server (respond without proxying)
- [ ] WebSocket testing tools (send custom messages)
- [ ] Performance metrics and analytics
- [ ] Connection grouping by URL pattern
- [ ] Advanced rule conditions (time-based, counter-based)
- [ ] Rule testing/simulation mode
