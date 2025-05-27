const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'},
});

// Mediasoup objects
let worker;
let router;
let producerTransport;
let producer = null;

// Store consumer transports and consumers
const consumerTransports = new Map();
const consumers = new Map();
const producers = new Map(); // key: "video" | "audio"

async function startMediasoup() {
    worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });

    router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {},
            },
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                parameters: {},
            },
        ],
    });

    console.log('Mediasoup worker and router created');
}

io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Clean up on disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        // Close and remove consumer transport
        const transport = consumerTransports.get(socket.id);
        if (transport) {
            transport.close();
            consumerTransports.delete(socket.id);
        }

        // Close and remove consumer
        const consumer = consumers.get(socket.id);
        if (consumer) {
            consumer.close();
            consumers.delete(socket.id);
        }
    });

    // Return router RTP capabilities
    socket.on('getRtpCapabilities', (callback) => {
        console.log('Get RTP Capabilities');
        callback(router.rtpCapabilities);
    });

    // Create producer transport
    socket.on('createProducerTransport', async (callback) => {
        try {
            // Create a new WebRTC transport
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            console.log('Producer transport created:', transport.id);

            // Store the transport
            producerTransport = transport;

            // Monitor transport state
            transport.on('dtlsstatechange', (dtlsState) => {
                console.log('Producer transport DTLS state changed to', dtlsState);
                if (dtlsState === 'closed') {
                    transport.close();
                }
            });

            // Return transport parameters to client
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (error) {
            console.error('Error creating producer transport:', error);
            callback({ error: error.message });
        }
    });

    // Connect producer transport
    socket.on('connectProducerTransport', async ({ dtlsParameters }, callback) => {
        try {
            await producerTransport.connect({ dtlsParameters });
            console.log('Producer transport connected');
            callback({ success: true });
        } catch (error) {
            console.error('Error connecting producer transport:', error);
            callback({ error: error.message });
        }
    });

    // Start producing (sending media)
    socket.on('produce', async ({ kind, rtpParameters }, callback) => {
        try {
            // Create producer
            producer = await producerTransport.produce({ kind, rtpParameters });
            console.log('Producer created:', producer.id, 'kind:', kind);

            // Handle producer events
            producer.on('transportclose', () => {
                console.log('Producer transport closed');
                producer = null;
            });

            callback({ id: producer.id });
        } catch (error) {
            console.error('Error producing:', error);
            callback({ error: error.message });
        }
    });


    // Create consumer transport
    socket.on('createConsumerTransport', async (callback) => {
        try {
            // Create a new WebRTC transport for this consumer
            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            console.log('Consumer transport created:', transport.id, 'for client:', socket.id);

            // Store the transport with the socket ID
            consumerTransports.set(socket.id, transport);

            // Monitor transport state
            transport.on('dtlsstatechange', (dtlsState) => {
                console.log('Consumer transport DTLS state changed to', dtlsState);
                if (dtlsState === 'closed') {
                    transport.close();
                }
            });

            // Return transport parameters to client
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (error) {
            console.error('Error creating consumer transport:', error);
            callback({ error: error.message });
        }
    });

    // Connect consumer transport
    socket.on('connectConsumerTransport', async ({ dtlsParameters }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            if (!transport) {
                throw new Error('Consumer transport not found');
            }

            await transport.connect({ dtlsParameters });
            console.log('Consumer transport connected for client:', socket.id);

            if (callback) callback({ success: true });
        } catch (error) {
            console.error('Error connecting consumer transport:', error);
            if (callback) callback({ error: error.message });
        }
    });

    socket.on('getProducers', (callback) => {
        // 예시: 모든 producerId를 배열로 반환
        callback([...producers.values()].map(p => p.id));
    });

    // Start consuming (receiving media)
    socket.on('consume', async ({ rtpCapabilities }, callback) => {
        try {
            // Check if producer exists
            if (!producer) {
                throw new Error('No producer available');
            }

            // Check if router can consume the producer
            if (!router.canConsume({
                producerId: producer.id,
                rtpCapabilities,
            })) {
                throw new Error('Cannot consume with current RTP capabilities');
            }

            const transport = consumerTransports.get(socket.id);
            if (!transport) {
                throw new Error('Consumer transport not found');
            }

            // Create consumer
            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: true, // Start paused, resume after client setup
            });

            // Store the consumer
            consumers.set(socket.id, consumer);

            console.log('Consumer created:', consumer.id, 'for client:', socket.id);

            // Handle consumer events
            consumer.on('transportclose', () => {
                console.log('Consumer transport closed for consumer:', consumer.id);
                consumer.close();
                consumers.delete(socket.id);
            });

            consumer.on('producerclose', () => {
                console.log('Producer closed for consumer:', consumer.id);
                consumer.close();
                consumers.delete(socket.id);
                socket.emit('producerClosed');
            });

            // Return consumer parameters to client
            callback({
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });

            // Resume the consumer
            await consumer.resume();
            console.log('Consumer resumed:', consumer.id);

        } catch (error) {
            console.error('Error consuming:', error);
            callback({ error: error.message });
        }
    });

    // ... 나머지 코드 유지 ...
});

startMediasoup().then(() => {
    server.listen(3001, () => {
        console.log('Server running on http://localhost:3001');
    });
});
