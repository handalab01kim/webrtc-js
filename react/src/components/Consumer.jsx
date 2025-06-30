import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import {serverUrl} from "../config/config.js";


const mediasoupClient = await import('mediasoup-client');
const socket = io(serverUrl);

function Consumer({remoteStreams, onStreams}) {
    const consumerTransportRef = useRef(null); // 하나의 transport로 multiplexing
    const consumerRefs = useRef(new Map());
    // let producerList;

    // device 생성
    const createDevice = async () => {
        const device = new mediasoupClient.Device();

        const rtpCapabilities = await new Promise((resolve, reject) => {
            socket.emit('getRtpCapabilities', resolve);
        });

        await device.load({routerRtpCapabilities: rtpCapabilities});
        return device;
    }

    // recvTransport 생성
    const setConsumer = async (device) => {
        const transportInfo = await new Promise((resolve, reject) => {
            socket.emit('createConsumerTransport', resolve);
        });
        console.log("new_debug", transportInfo);
        console.log('Consumer Transport 정보 받음');

        const consumerTransport = device.createRecvTransport(transportInfo);
        consumerTransportRef.current = consumerTransport;

        consumerTransport.on('connect', async ({dtlsParameters}, callback, errback) => {
            try {
                console.log('Consumer Transport 연결 중...');
                await new Promise((resolve, reject) => {
                    socket.emit('connectConsumerTransport', {dtlsParameters}, resolve);
                });
                console.log('Consumer Transport 연결됨');
                callback();
            } catch (error) {
                errback(error);
                console.log('Transport 연결 실패: ' + error.message);
            }
        });

        return consumerTransport;
    }

    const startConsuming = async (device, consumerTransport) => {
        // - producers 목록 받아오기
        const producers = await new Promise((resolve) => {
            socket.emit('getProducers', resolve); // [{kind: "video", id: "..."}]
        });
        console.log("my_debug, producers", producers);

        // - 각 producer(video, audio)에 대해 consume
        const streamsMap = new Map();

        for (const { socketId, streams } of producers) {
            const mediaStream = new MediaStream();
            for (const { kind, producerId } of streams) {
                const { id, rtpParameters } = await new Promise((resolve, reject) => {
                    socket.emit('consume', { producerId, rtpCapabilities: device.rtpCapabilities }, (res) => {
                        if (res.error) reject(res.error);
                        else resolve(res);
                    });
                });

                const consumer = await consumerTransport.consume({ id, producerId, kind, rtpParameters });
                await consumer.resume();
                consumerRefs.current.set(id, consumer);
                mediaStream.addTrack(consumer.track);
            }
            streamsMap.set(socketId, mediaStream);
        }
        // producerList = producers; // producer 리스트 저장(후에 갱신 시 비교 위함) => remoteStreams
        const newRemoteStreams = Array.from(streamsMap.entries()).map(([socketId, stream]) => ({ socketId, stream }));
        if (onStreams) onStreams([...newRemoteStreams]);
    };

    const renewProducers = async (device, consumerTransport)=>{ // 새로운 producer 갱신
        // remoteStreams: 기존 history 목록(CamChat.jsx에서 유지중인 목록)
        // - producers 목록 받아오기
        const producers = await new Promise((resolve) => {
            socket.emit('getProducers', resolve); // [{kind: "video", id: "..."}]
        });
        
        
        // - 각 producer(video, audio)에 대해 consume
        const streamsMap = new Map();

        for (const { socketId, streams } of producers) {
            if(remoteStreams.some(p=>p.socketId==socketId)) // 존재하는 producer면 continue
                continue;
            const mediaStream = new MediaStream();
            for (const { kind, producerId } of streams) {
                const { id, rtpParameters } = await new Promise((resolve, reject) => {
                    socket.emit('consume', { producerId, rtpCapabilities: device.rtpCapabilities }, (res) => {
                        if (res.error) reject(res.error);
                        else resolve(res);
                    });
                });

                const consumer = await consumerTransport.consume({ id, producerId, kind, rtpParameters });
                await consumer.resume();
                consumerRefs.current.set(id, consumer);
                mediaStream.addTrack(consumer.track);
            }
            streamsMap.set(socketId, mediaStream);
        }

        const newRemoteStreams = Array.from(streamsMap.entries()).map(([socketId, stream]) => ({ socketId, stream }));
        if (onStreams) onStreams([...remoteStreams.concat(newRemoteStreams)]);

    };



    useEffect(() => {
        const start = async () => {
            try {
                // device 생성
                const device = await createDevice();

                // recvTransport 생성
                const consumerTransport = await setConsumer(device);

                // consume 시작
                await startConsuming(device, consumerTransport);
                console.log("startConsuming");
                socket.on("newProducer", ()=>{renewProducers(device, consumerTransport);});

            } catch (e) {
                console.log(e);
            }
        };
        start();
        return () => {
            for (const consumer of consumerRefs.current.values()) {
                consumer.close();
            }
            consumerRefs.current.clear();
            if (consumerTransportRef.current) consumerTransportRef.current.close();
            socket.off('producerClosed');
            socket.disconnect();
        };
    }, []);


    return null;
}

export default Consumer;
