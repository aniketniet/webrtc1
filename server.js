const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3000 });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

console.log("Signaling server running on ws://localhost:3000");
