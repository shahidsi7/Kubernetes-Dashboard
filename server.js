// server.js
// This is the main backend entry point for the Kubernetes Cluster Manager application.
// It sets up the Express server, WebSocket server, and integrates the API routes
// and WebSocket handlers for Kubernetes operations.

const express = require("express");
const http = require('http'); // Required for creating an HTTP server to attach WebSocket
const WebSocket = require('ws'); // WebSocket library for real-time communication

// Import the Kubernetes API routes
const kubernetesRoutes = require('./routes/kubernetesRoutes');
// Import the Kubernetes WebSocket connection handler
const { handleKubernetesWebSocketConnection } = require('./websocket/kubernetesWsHandlers');
const { execPromise } = require("./utils/kubectlUtils");

const app = express();
const port = 3000; // The port on which the server will listen

// Define API_BASE_URL for backend fetch calls.
// This ensures that the backend knows its own address when making requests to its own routes.
const API_BASE_URL = `http://localhost:${port}`;

// Middleware to parse JSON request bodies from incoming HTTP requests
app.use(express.json());

// Create an HTTP server and attach the Express application to it.
// This is necessary because the WebSocket server will also attach to the same HTTP server.
const server = http.createServer(app);

// Create a WebSocket server instance and bind it to the HTTP server.
// This allows both HTTP and WebSocket connections to be handled by the same port.
const wss = new WebSocket.Server({ server });

// Serve static files from the 'public' directory.
// This includes your HTML, CSS, and client-side JavaScript files.
app.use(express.static('public'));

// Mount the Kubernetes API routes.
// All routes defined in kubernetesRoutes.js will be accessible under the root path '/'.
app.use('/', kubernetesRoutes);

// Initialize a global reference for the port-forwarding process
app.locals.portForwardProcess = null;

// WebSocket connection handling.
// This listener fires whenever a new WebSocket connection is established.
wss.on('connection', function connection(ws, req) {
    // Parse URL parameters from the WebSocket request URL.
    // This is used to determine the type of WebSocket connection (e.g., EKS CLI stream, Kube logs).
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const type = urlParams.get('type'); // 'eks-cli-stream' or 'kube-logs'

    // Delegate the WebSocket connection handling to the appropriate module based on the 'type'.
    if (['eks-cli-stream', 'kube-logs'].includes(type)) {
        // If the type is related to Kubernetes, pass it to the dedicated handler.
        handleKubernetesWebSocketConnection(ws, req);
    } else {
        // For any unrecognized or invalid WebSocket connection type, log an error
        // and send an error message back to the client before closing the connection.
        console.error('WebSocket: Invalid connection type provided.');
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid WebSocket connection type.' }));
            ws.close();
        }
    }
});

// Start the HTTP server, which also serves the WebSocket connections.
server.listen(port, function() {
    console.log(`Server started successfully on port ${port}...`);
    console.log(`Access the Kubernetes app at http://localhost:${port}/`); // Main entry point for the UI
    console.log(`Access the Kubernetes Dashboard at http://localhost:${port}/kubernetes-dashboard.html`); // Direct link to dashboard
});

// Graceful shutdown: Ensure port-forwarding is killed when the server stops
process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server and killing port-forward process.');
    if (app.locals.portForwardProcess) {
        app.locals.portForwardProcess.kill('SIGTERM');
    }
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});
