import express from 'express';
import http from 'http';
import signaling from "./src/signaling.js";
import createRouter from "./src/createRouter.js";

const app = express();
const server = http.createServer(app);

// worker, router 생성
const router = await createRouter();

// signaling io server 생성
signaling(server, router);

const port = 4011;
server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});
