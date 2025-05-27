const express = require('express');
const http = require('http');
const {Server} = require('socket.io');

// Import modules
const { createWorker } = require('./server/workerManager');
const { createRouter } = require('./server/routerManager');
const { initializeWebSocketHandlers } = require('./server/websocketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'},
});

// Initialize WebSocket handlers
initializeWebSocketHandlers(io);

// Initialize mediasoup
async function startMediasoup() {
    // Create worker
    await createWorker();

    // Create router
    await createRouter();

    console.log('Mediasoup worker and router created');
}

// Start the server
startMediasoup().then(() => {
    server.listen(3001, () => {
        console.log('Server running on http://localhost:3001');
    });
});
