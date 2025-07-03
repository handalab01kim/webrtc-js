import {Server} from "socket.io";

export default function(server, router) {

    const producerTransports = new Map();
    const consumerTransports = new Map();
    const consumers = new Map();
    const producers = new Map(); // { video | audio }

    const io = new Server(server, {
        cors: {origin: '*'},
    });

    io.on('connection', async (socket) => {

        // 연결된 socket에 사용자 ID를 저장
        const userId = socket.handshake.query.userId;
        socket.data.userId = userId;
        console.mine('Client connected:', socket.data.userId);
        setTimeout(()=>{
            console.mine("###producers.size", producers.size, socket.data.userId)
            console.mine("###producerTransports.size", producerTransports.size, socket.data.userId)
            console.mine("###consumers", consumers.size, socket.data.userId)
            console.mine("###consumerTransports", consumerTransports.size, socket.data.userId)
        }, 1500);

        socket.on('disconnect', () => {
            setTimeout(()=>{
                console.mine('Client disconnected:', socket.data.userId);
                console.mine("@@@producers.size", producers.size, socket.data.userId)
                console.mine("@@@producerTransports.size", producerTransports.size, socket.data.userId)
                console.mine("@@@consumers", consumers.size, socket.data.userId)
                console.mine("@@@consumerTransports", consumerTransports.size, socket.data.userId)
            }, 1500);

            const consumerTransport = consumerTransports.get(socket.data.userId);
            if (consumerTransport) {
                consumerTransport.close();
                consumerTransports.delete(socket.data.userId);
            }

            const socketConsumers = consumers.get(socket.data.userId);
            if (socketConsumers) {
                for(const consumer of socketConsumers.values()){
                    consumer.close();
                }
                consumers.delete(socket.data.userId);
            }

            const producerTransport = producerTransports.get(socket.data.userId);
            if(producerTransport) {
                producerTransport.close();
                producerTransports.delete(socket.data.userId);
            }

            socket.broadcast.emit('producerClosed', {
                userId: socket.data.userId,
            });
            // producers.get(socket.data.userId) 구조: Map(kind → producer)
            const socketProducers = producers.get(socket.data.userId);
            // console.log(producers)
            if (socketProducers) {
                for (const [kind, producer] of socketProducers.entries()) {
                    // 다른 consumer에게 알려줌
                    producer.close(); // 리소스 정리
                }
                producers.delete(socket.data.userId);
            }
        }); // disconnect //

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
                    listenIps: [{ ip: '0.0.0.0', announcedIp: "172.30.1.88" }],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                });

                console.log('Producer transport created:', transport.id);

                if (!socket.connected) {
                    console.log("!!!!    createProducerTransport: !SOCKET.CONNECTED");
                    return;
                } // socket 연결 없는 Transport 생성 방지
                producerTransports.set(socket.data.userId, transport);

                transport.on('dtlsstatechange', (dtlsState) => {
                    console.log('Producer transport DTLS state changed to', dtlsState);
                    if (dtlsState === 'closed') {
                        console.log("MY_DEBUG dtlsstatechange close !!!!!A")
                        transport.close();
                    }
                    // console.log("MY_DEBUG##########");
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
                const transport = producerTransports.get(socket.data.userId);
                if (!transport) {
                    console.log("producerTransport not found(connectProducerTransport): Producer 리소스 생성 중 연결 닫음");
                    return;
                    // throw new Error('Producer transport not found');
                }

                await transport.connect({ dtlsParameters });
                console.log('Producer transport connected');

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('Error connecting producer transport:', error);
                if (callback) callback({ error: error.message });
            }
        });

        // 미디어 전송 시작
        socket.on('produce', async ({ kind, rtpParameters }, callback) => {
            console.mine("my_debug produce userId:", socket.data.userId);
            try {
                let isSecond=false;
                const transport = producerTransports.get(socket.data.userId);
                if (!transport) {
                    console.log("producerTransport not found(produce):");
                    return;
                    // throw new Error('produce: producerTransport not found');
                }

                const newProducer = await transport.produce({ kind, rtpParameters });

                if (!producers.has(socket.data.userId)) producers.set(socket.data.userId, new Map()); // audio/video 중 첫번 째 producer 전달
                else isSecond=true; // 두번째 전달
                producers.get(socket.data.userId).set(kind, newProducer);

                console.log('Producer created:', newProducer.id, 'kind:', kind);

                newProducer.on('transportclose', () => {
                    console.log('Producer transport closed for kind:', kind);
                    producers.get(socket.data.userId)?.delete(kind);
                });

                if (isSecond){ // audio+video producer 기존 consumer들에게 알림
                    socket.broadcast.emit('newProducer', {
                        // socketId: socket.data.userId,
                        // streams:[
                        //     {
                        //         kind,
                        //         producerId: newProducer.id,
                        //     },
                        //     {
                        //     }
                        // ],
                    });
                }

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
                    listenIps: [{ ip: '0.0.0.0', announcedIp: "172.30.1.88" }],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                });

                console.log('Consumer transport created:', transport.id, 'for client:', socket.data.userId);

                consumerTransports.set(socket.data.userId, transport);

                transport.on('dtlsstatechange', (dtlsState) => {
                    console.log('Consumer transport DTLS state changed to', dtlsState);
                    if (dtlsState === 'closed') {
                        console.log("MY_DEBUG dtlsstatechange close !!!!!B")
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
                const transport = consumerTransports.get(socket.data.userId);
                if (!transport) {
                    console.log("consumerTransport not found(connectConsumerTransport): Consumer 리소스 생성 중 연결 닫음");
                    return;
                    // throw new Error('Consumer transport not found');
                }

                await transport.connect({ dtlsParameters });
                console.log('Consumer transport connected for client:', socket.data.userId);

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('Error connecting consumer transport:', error);
                if (callback) callback({ error: error.message });
            }
        });

        // socket.on('getProducers', (callback) => {
        //     console.log("MYMYMYMY_DEBUG", producers);
        //     // const list = [...producers.entries()].map(([kind, prod]) => ({
        //     //     kind,
        //     //     id: prod.id
        //     // }));
        //     // console.log("NEW_DEBUG", list);
        //     // callback(list);
        //     const list = [];
        //     for (const [sockId, kindMap] of producers.entries()) {
        //         for (const [kind, producer] of kindMap.entries()) {
        //             list.push({ socketId: sockId, kind, id: producer.id });
        //         }
        //     }
        //     console.log("Getting list of producers", list);
        //     callback(list);
        // });

        socket.on('getProducers', (callback) => {
            const list = [];

            for (const [userId, kindMap] of producers.entries()) {
                const streams = [];

                for (const [kind, producer] of kindMap.entries()) {
                    streams.push({
                        kind,
                        producerId: producer.id
                    });
                }

                list.push({
                    userId,
                    streams
                });
            }

            console.log("Structured producer list:", list);
            callback(list);
        });




        // 미디어 consume 시작
        socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
            try {
                // const selectedProducer = [...producers.values()].find(p => p.id === producerId);
                // if (!selectedProducer) throw new Error('Producer not found');
                let selectedProducer = null;
                // console.log("###1", producers)
                // console.log("###1.1", producers.values())
                for (const kindMap of producers.values()) {
                    // console.log("###2", kindMap)
                    // console.log("###2.1", kindMap.values())
                    for (const producer of kindMap.values()) {
                        // console.log("###3", producer)
                        // console.log("###3.1", producer.id)
                        // console.log("###3.2", producerId)
                        if (producer.id === producerId) {
                            selectedProducer = producer;
                            break;
                        }
                    }
                }
                if (!selectedProducer) {
                    console.log("producerTransport not found(consume): Producer 리소스 생성 중 연결 닫음");
                    return;
                    // throw new Error('Producer not found');
                }

                if (!router.canConsume({ producerId: selectedProducer.id, rtpCapabilities })) {
                    throw new Error('Cannot consume with current RTP capabilities');
                }

                const transport = consumerTransports.get(socket.data.userId);
                if (!transport) {
                    console.log('Consumer transport not found(not created)')
                    return;
                };

                const consumer = await transport.consume({
                    producerId: selectedProducer.id,
                    rtpCapabilities,
                    paused: true,
                });

                if (!consumers.has(socket.data.userId)) consumers.set(socket.data.userId, new Map());
                consumers.get(socket.data.userId).set(producerId, consumer);


                consumer.on('transportclose', () => {
                    const userConsumers = consumers.get(socket.data.userId);
                    if (userConsumers) {
                        userConsumers.delete(producerId); // 해당 producerId만 제거

                        if (userConsumers.size === 0) {
                            consumers.delete(socket.data.userId); // 더 이상 없으면 user 자체도 삭제?
                        }
                    }
                    // console.mine("CALLED2 consumer.on('transportclose', () => {}", consumers.size, socket.data.userId);
                });

                consumer.on('producerclose', () => {
                    const userConsumers = consumers.get(socket.data.userId);
                    if (userConsumers) {
                        userConsumers.delete(producerId);
                        if (userConsumers.size === 0) {
                            consumers.delete(socket.data.userId);
                        }
                    }
                    socket.emit('producerClosed');
                });


                callback({
                    id: consumer.id,
                    producerId: selectedProducer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                });
                if (consumer && !consumer.closed) {
                    // console.log("consumer.resume() rejected; Consumer resource has been terminated(consume)");
                    // return;
                    // await consumer.resume();
                    try {
                        await consumer.resume();
                    } catch (e) {
                        if (e.message.includes("Channel request handler") && e.message.includes("not found")) {
                            console.log("consumer.resume() failed: Consumer already closed.");
                        } else {
                            throw e;
                        }
                    }
                }
            } catch (err) {
                console.error('Error consuming:', err);
                callback({ error: err.message });
            }
        });


        // socket.on('setConsumerPreferredLayers', async ({ consumerId, spatialLayer, temporalLayer }) => {
        //     const consumer = consumers.get(socket.data.userId);
        //
        //     if (!consumer) {
        //         console.warn(`No consumer found for socket ${socket.data.userId}`);
        //         return;
        //     }
        //
        //     if (consumer.id !== consumerId) {
        //         console.warn(`Mismatched consumerId for socket ${socket.data.userId}`);
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