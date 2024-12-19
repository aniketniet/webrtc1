const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 3005 });

// Maintain a map of connected clients
const clients = new Map();

wss.on("connection", (ws) => {
  // Assign a unique ID to each client
  const clientId = Date.now().toString();
  clients.set(clientId, ws);

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    data.from = clientId; // Add sender ID to the message

    // Broadcast the message to all other clients
    clients.forEach((client, id) => {
      if (id !== clientId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    clients.delete(clientId); // Remove the client on disconnect
  });
});

console.log("Signaling server running on ws://localhost:3005");
