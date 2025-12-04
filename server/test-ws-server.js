import { WebSocketServer } from 'ws';

// Simple WebSocket echo server for testing
const wss = new WebSocketServer({ port: 8078 });

console.log('🔊 WebSocket Echo Server listening on ws://localhost:8078');
console.log('Configure your proxy to forward to: http://localhost:8078');
console.log('');

wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}`;
  console.log(`✓ New connection: ${clientId} (${req.url})`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to echo server',
    clientId,
    timestamp: new Date().toISOString()
  }));
  
  ws.on('message', (data) => {
    const messageStr = data.toString();
    console.log(`📨 ${clientId}: ${messageStr}`);
    
    try {
      // Try to parse as JSON and echo back with metadata
      const parsed = JSON.parse(messageStr);
      const response = {
        type: 'echo',
        original: parsed,
        clientId,
        receivedAt: new Date().toISOString()
      };
      ws.send(JSON.stringify(response));
    } catch (e) {
      // Not JSON, just echo back as-is
      ws.send(`Echo: ${messageStr}`);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 Disconnected: ${clientId}`);
  });
  
  ws.on('error', (err) => {
    console.error(`❌ Error for ${clientId}:`, err.message);
  });
});

// Send periodic ping to all connected clients
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    }
  });
}, 30000); // Every 30 seconds

console.log('Ready to accept connections!');
