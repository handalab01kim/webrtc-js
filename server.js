const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'},
});

let worker;
let router;
let producerTransport;

// Store consumer transports and consumers
const consumerTransports = new Map();
const consumers = new Map();
const producers = new Map(); // { video | audio }

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
    // roomId == socket.id(클라 측에서 socket.id로 보냄 -> 향후 socket.id를 다른 고유한 값으로 변경 가능)
    socket.on('produce', async ({ kind, roomId, rtpParameters }, callback) => {
        try {
            const newProducer = await producerTransport.produce({ kind, rtpParameters });

            if(!producers.has(roomId)){
                producers.set(roomId, new Map());
            }
            const roomProducers = producers.get(roomId);
            roomProducers.set(kind, newProducer); // roomId + kind 기준 저장
            console.log('Producer created:', roomId, newProducer.id, 'kind:', kind);

            newProducer.on('transportclose', () => {
                console.log('Producer transport closed for kind:', kind, roomId);
                producers.delete(roomId);
            });

            callback({ id: newProducer.id });
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

    socket.on('getProducers', (data, callback) => {
        const {roomIds} = data;
        console.log("my_debug!!!!!!!!!!", roomIds);
        try{
            const resultList = [];
            for(const roomId of roomIds){
                const roomProducers = producers.get(roomId); // audio + video
                // if (!roomProducers) {
                //     return callback([]); // 해당 roomId에 대한 producer 없음
                // }
                if(roomProducers) {
                    for(const roomProducer of roomProducers){
                    // console.log("new_debug@@@@@@@@@@@@@@\n",roomProducer)
                        resultList.push(
                            {
                                kind: roomProducer[0].kind,
                                id: roomProducer[0].id
                            }
                        );
                        console.log("new_debug@@@@@@@@@@@@@@\n",roomProducer[0]);
                    } // my_debug_here@@@@@@@@@@
                }
                // const list = [...producers.entries()].map(([kind, prod]) => ({
                //     kind,
                //     id: prod.id
                // }));

            }
            console.log("my_debug", producers);
            callback(resultList);
        } catch(e){
            console.log(e);
            callback([]);
        }
    });


    // Start consuming (receiving media)
    socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
        try {
            const selectedProducer = [...producers.values()].find(p => p.id === producerId);
            if (!selectedProducer) throw new Error('Producer not found');

            if (!router.canConsume({ producerId: selectedProducer.id, rtpCapabilities })) {
                throw new Error('Cannot consume with current RTP capabilities');
            }

            const transport = consumerTransports.get(socket.id);
            if (!transport) throw new Error('Consumer transport not found');

            const consumer = await transport.consume({
                producerId: selectedProducer.id,
                rtpCapabilities,
                paused: true,
            });

            consumers.set(socket.id, consumer);

            consumer.on('transportclose', () => consumers.delete(socket.id));
            consumer.on('producerclose', () => {
                consumers.delete(socket.id);
                socket.emit('producerClosed');
            });

            callback({
                id: consumer.id,
                producerId: selectedProducer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });

            await consumer.resume();
        } catch (err) {
            console.error('Error consuming:', err);
            callback({ error: err.message });
        }
    });


    // ... 나머지 코드 유지 ...
});

startMediasoup().then(() => {
    server.listen(3001, () => {
        console.log('Server running on http://localhost:3001');
    });
});
//
// setInterval(() => {
//     console.log("MY_DEBUG1", producers);
// }, 3000);