import express from 'express';
import http from 'http';
import signaling from "./src/signaling.js";
import createRouter from "./src/createRouter.js";
import path from 'path';

const app = express();
const buildPath = path.join(process.cwd(), "react", "dist");
app.use(express.static(buildPath));
app.get(["/", "/producer", "/consumer"], (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
});
const server = http.createServer(app);

// worker, router 생성
const router = await createRouter();

// signaling io server 생성
signaling(server, router);

const port = 4011;
server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});
