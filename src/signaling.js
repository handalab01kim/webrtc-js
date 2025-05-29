import {Server} from "socket.io";

export default function(server, router) {
    let producerTransport;

    const consumerTransports = new Map();
    const consumers = new Map();
    const producers = new Map(); // { video | audio }

    const io = new Server(server, {
        cors: {origin: '*'},
    });

    io.on('connection', async (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);

            const transport = consumerTransports.get(socket.id);
            if (transport) {
                transport.close();
                consumerTransports.delete(socket.id);
            }

            const consumer = consumers.get(socket.id);
            if (consumer) {
                consumer.close();
                consumers.delete(socket.id);
            }
        });

        // RTP capabilities 반환
        socket.on('getRtpCapabilities', (callback) => {
            try{
                console.log('Get RTP Capabilities');
                callback(router.rtpCapabilities);
            }catch(e){
                console.log("getRtpCapabilities Error: ",e);
            }
        });

        // ------------------------ producer ------------------------------//
        // producer - sendTransport 생성
        socket.on('createProducerTransport', async (callback) => {
            try {
                const transport = await router.createWebRtcTransport({
                    listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                });

                console.log('Producer transport created:', transport.id);

                producerTransport = transport;

                transport.on('dtlsstatechange', (dtlsState) => {
                    console.log('Producer transport DTLS state changed to', dtlsState);
                    if (dtlsState === 'closed') {
                        transport.close();
                    }
                    console.log("MY_DEBUG##########");
                });

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

        // producerTransport 연결
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

        // 미디어 전송 시작
        socket.on('produce', async ({ kind, rtpParameters }, callback) => {
            try {
                const newProducer = await producerTransport.produce({ kind, rtpParameters });

                producers.set(kind, newProducer); // kind 기준 저장
                console.log('Producer created:', newProducer.id, 'kind:', kind);

                newProducer.on('transportclose', () => {
                    console.log('Producer transport closed for kind:', kind);
                    producers.delete(kind);
                });

                callback({ id: newProducer.id });
            } catch (error) {
                console.error('Error producing:', error);
                callback({ error: error.message });
            }
        });


        // ------------------------ consumer ------------------------------//
        // consumerTransport 생성
        socket.on('createConsumerTransport', async (callback) => {
            try {
                const transport = await router.createWebRtcTransport({
                    listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                });

                console.log('Consumer transport created:', transport.id, 'for client:', socket.id);

                consumerTransports.set(socket.id, transport);

                transport.on('dtlsstatechange', (dtlsState) => {
                    console.log('Consumer transport DTLS state changed to', dtlsState);
                    if (dtlsState === 'closed') {
                        transport.close();
                    }
                });

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
            const list = [...producers.entries()].map(([kind, prod]) => ({
                kind,
                id: prod.id
            }));
            callback(list);
        });


        // 미디어 consume 시작
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


        // socket.on('setConsumerPreferredLayers', async ({ consumerId, spatialLayer, temporalLayer }) => {
        //     const consumer = consumers.get(socket.id);
        //
        //     if (!consumer) {
        //         console.warn(`No consumer found for socket ${socket.id}`);
        //         return;
        //     }
        //
        //     if (consumer.id !== consumerId) {
        //         console.warn(`Mismatched consumerId for socket ${socket.id}`);
        //         return;
        //     }
        //
        //     if (typeof consumer.setPreferredLayers === 'function') {
        //         try {
        //             await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
        //             console.log(`Consumer ${consumerId}: setPreferredLayers(${spatialLayer}, ${temporalLayer})`);
        //         } catch (err) {
        //             console.error(`Failed to setPreferredLayers for consumer ${consumerId}`, err);
        //         }
        //     } else {
        //         console.warn(`Consumer ${consumerId} does not support setPreferredLayers`);
        //     }
        // });


    });
    // return io;
}