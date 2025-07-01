import React, {useEffect, useRef, useState} from 'react';
// import {io} from 'socket.io-client';
// import {serverUrl} from "../config/config.js";
import { useStreamStore } from '../store/streamStore'; 
import { socket } from "../components/WebSocket";


const mediasoupClient = await import('mediasoup-client');

// function Consumer({remoteStreams, onStreams}) {
function Consumer() {
    const consumerTransportRef = useRef(null); // 하나의 transport로 multiplexing
    const consumerRefs = useRef(new Map());
    const {remoteStreams,setRemoteStreams,addRemoteStreams,deleteRemoteStream} = useStreamStore(); 
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
        console.log('Consumer Transport 정보 받음', transportInfo);

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

    // 최초 producers load
    const startConsuming = async (device, consumerTransport) => {
        // - producers 목록 받아오기
        const producers = await new Promise((resolve) => {
            socket.emit('getProducers', resolve); // [{kind: "video", id: "..."}]
        });
        console.log("my_debug: producers", producers);

        // - 각 producer(video, audio)에 대해 consume
        const streamsMap = new Map();

        for (const { socketId, streams } of producers) {
            if(socketId==socket.id) continue; // 자기 자신의 producer consume 하지 않음 // 현재는 producer, consumer 소켓 각자 열기에 작동하지 않음
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
        setRemoteStreams([...newRemoteStreams]);
    };

    // 새로운 producer 추가하여 producer 목록 갱신
    const renewProducers = async (device, consumerTransport)=>{ 
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
            if(socketId==socket.id) continue; // 자기 자신의 producer consume 하지 않음
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
        setRemoteStreams([...remoteStreams.concat(newRemoteStreams)]);
        // addRemoteStreams([...newRemoteStreams]);
    };

    // const logToServer = (args) => {
    //     fetch('https://172.30.1.88:9876/log', {
    //         method: 'POST',
    //         body: JSON.stringify({ message: args}),
    //         headers: { 'Content-Type': 'application/json' }
    //     });
    // };
    const deleteProducer = async (socketId)=>{
        deleteRemoteStream(socketId);
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
                
                // producer 추가/제거 이벤트 등록
                socket.on("newProducer", ()=>{renewProducers(device, consumerTransport);});
                socket.on("producerClosed", (socketId)=>{
                    deleteProducer(socketId);
                    // alert("TEST");
                });
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
