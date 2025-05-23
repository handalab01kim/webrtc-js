const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'},
});

let worker, router, transportProducer, transportConsumer, transport;
let producerStreaming = null;

async function startMediasoup() {
    worker = await mediasoup.createWorker();
    router = await worker.createRouter({
        mediaCodecs: [
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {},
            },
        ],
    });
}

io.on('connection', async (socket) => {
    console.log('Client connected');

    socket.on('getRtpCapabilities', (cb) => {
        cb(router.rtpCapabilities);
    });

    socket.on('createTransport', async (cb) => {
        if (transport) return;
        transport = await router.createWebRtcTransport({
            // announcedIp: null => 내부망
            listenIps: [{ip: '127.0.0.1', announcedIp: null}],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') transport.close();
        });

        const transportType = transportProducer ? 'consumer' : 'producer';
        if (transportType === 'producer') transportProducer = transport;
        // else transportConsumer = transport;
        else {
            console.log("MYDEBUG**");
            return;
        }

        cb({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });

        socket.on('connectTransport', async ({dtlsParameters}) => {
            if (transport._isConnected) return;
            // await transport.connect({ dtlsParameters });
            try {
                console.log("MYDEBUG_connect?");
                await transport.connect({dtlsParameters});
                transport._isConnected = true; // flag로 1회만 실행
            } catch (err) {
                console.error("connectTransport error:", err);
            }
        });

        if (transportType === 'producer') {
            console.log("MYDEBUG0", transportType);
            socket.on('produce', async ({kind, rtpParameters}, cb) => {
                console.log("MYDEBUG");
                const producer = await transport.produce({kind, rtpParameters}); // 영상 송출 시작
                console.log("MYDEBUG2");
                producerStreaming = producer;
                cb({id: producer.id});
                console.log("MYDEBUG3");
            });
        } else {
            socket.on('consume', async ({rtpCapabilities}, cb) => {
                if (!router.canConsume({producerId: transportProducer.producers[0].id, rtpCapabilities})) {
                    return cb({error: 'Cannot consume'});
                }

                const consumer = await transport.consume({
                    producerId: transportProducer.producers[0].id,
                    rtpCapabilities,
                });

                cb({
                    id: consumer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });

                consumer.resume();
            });
        }
    });


    socket.on('createConsumerTransport', async (cb) => {
        // const transport = await router.createWebRtcTransport({
        //     // announcedIp: null => 내부망
        //     listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
        //     enableUdp: true,
        //     enableTcp: true,
        //     preferUdp: true,
        // });

        // transport.on('dtlsstatechange', dtlsState => {
        //     if (dtlsState === 'closed') transport.close();
        // });

        // const transportType = 'consumer'
        // if (transportType === 'producer') transportProducer = transport;
        transportConsumer = transport;


        cb({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });

        socket.on('connectConsumerTransport', async ({dtlsParameters}) => {
            await transport.connect({dtlsParameters});
        });

        socket.on('consume', async ({rtpCapabilities}, cb) => {
            if (!producerStreaming) {
                return cb({error: 'No producer available'});
            }

            if (!router.canConsume({producerId: producerStreaming.id, rtpCapabilities})) {
                return cb({error: 'Cannot consume'});
            }

            const consumer = await transport.consume({
                producerId: producerStreaming.id,
                rtpCapabilities,
            });

            cb({
                id: consumer.id,
                producerId: producerStreaming.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            });

            consumer.resume();
        });

    });
});

startMediasoup().then(() => {
    server.listen(3001, () => {
        console.log('Server running on http://localhost:3001');
    });
});
