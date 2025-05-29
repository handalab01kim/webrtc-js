import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import {serverUrl} from "../config/config.js";

const mediasoupClient = await import('mediasoup-client');
const socket = io(serverUrl);

const TEST_ROOM = 1;

function waitForSocketId(socket) {
    return new Promise((resolve) => {
        if (socket.id) return resolve(socket.id);
        socket.once('connect', () => resolve(socket.id));
    });
}// const socketId = await waitForSocketId(socket);

function App() {
    const localVideo = useRef(null);
    const webcamStream = useRef(null); // 연결 종료를 위한 useRef
    const producerTransportRef = useRef(null); // 연결 종료를 위한 useRef
    const producerRef = useRef(null); // 연결 종료를 위한 useRef

    // 웹캠 useRef로 받아오기
    const getWebcamVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920  },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                // video: true,
                audio: true,
            });
            webcamStream.current = stream;
            if (localVideo.current) {
                localVideo.current.srcObject = stream;
            }
            return stream;
        } catch (error) {
            console.error('웹캠 접근 실패:', error.message);
            throw error;
        }
    }
    // device 생성, rtpCapabilities 등록
    const createDevice = async () => {
        // Device 생성: 미디어를 보내거나 받기 위해 mediasoup 라우터에 연결하는 엔드포인트 == 클라이언트가 서버의 라우터와의 연결점
        const device = new mediasoupClient.Device();

        // callback 함수를 보내 rtpCapabilities(mediasoup Router가 지원하는 RTP 미디어 코덱/설정의 목록)를 동기적으로 받음
        const rtpCapabilities = await new Promise((resolve) => {
            socket.emit('getRtpCapabilities', resolve);
        });

        // 미디어숲 라우터의 RTP 기능을 기기에 로드 => 지원하는 RTP 미디어 코덱/설정 파악
        await device.load({routerRtpCapabilities: rtpCapabilities});
        return device;
    }

    // Producer 전송 설정
    const setProducer = async (device) => {
        // Send Transport 생성
        const transportInfo = await new Promise((resolve) => {
            socket.emit('createProducerTransport', resolve);
        });
        const producerTransport = device.createSendTransport(transportInfo);
        producerTransportRef.current = producerTransport;

        // Transport 이벤트 핸들러 설정
        // 'connect': 서버측에서 전송하는 이벤트 X, mediasoup-client가 호출하는 추상적인 이벤트
        // connect 이벤트 발생 시 서버에 DTLS 매개변수 전달
        producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                await new Promise((resolve) => {
                    // 로컬 DTLS 매개변수를 서버 측 transport에 신호 전달
                    socket.emit('connectProducerTransport', { dtlsParameters }, resolve);
                });
                // transport에 parameters들이 전송되었다는 것을 알려주는 역할
                callback();
            } catch (error) {
                errback(error);
                console.log('Transport 연결 실패: ' + error.message);
            }
        });

        // 미디어 전송 시작 이벤트
        producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            try {
                console.log("MY_DEBUG^^^^^ rtpParameters; ", rtpParameters);
                const { id } = await new Promise(async(resolve) => {
                    const socketId = await waitForSocketId(socket);
                    // socket.emit('produce', { kind, roomId: socketId, rtpParameters }, resolve);
                    socket.emit('produce', { kind, roomId: TEST_ROOM, rtpParameters }, resolve);
                    // socket.emit('produce', { kind, rtpParameters }, resolve);
                });
                callback({ id });
            } catch (error) {
                errback(error);
                console.log('미디어 스트림 생성 실패: ' + error.message);
            }
        });

        return producerTransport;
    }

    // 비디오 스트림 전송
    const startVideoStreaming = async (stream, producerTransport) => {
        const videoTrack = stream.getVideoTracks()[0];


        const settings = videoTrack.getSettings();
        console.log(`my_debug; 해상도: ${settings.width}x${settings.height}`);


        // await producerTransport.produce({ track: videoTrack });
        producerRef.current = await producerTransport.produce({
            track: videoTrack,
            // encodings: [
            //     { maxBitrate: 100_000, scaleResolutionDownBy: 4 }, // 저화질 1/4
            //     { maxBitrate: 300_000, scaleResolutionDownBy: 2 }, // 중화질 1/2
            //     { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 } // 원본 해상도
            // ],
            // // codecOptions: {
            // //     videoGoogleStartBitrate: 1000
            // // }
        });
        // console.log("MY_DEBUGGGGGGGGGGGGGG", producerRef.current.rtpParameters.encodings.length);
    }

    // 오디오 스트림 전송
    const startAudioStreaming = async (stream, producerTransport) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            const audioTrack = audioTracks[0];
            await producerTransport.produce({ track: audioTrack });
        }
    }





    const start = async () => {
        try {
            // 웹캠 useRef로 받아오기
            const stream = await getWebcamVideo();
            console.log("getWebcamVideo");

            // device 생성, rtpCapabilities 등록
            const device = await createDevice();
            console.log("createDevice");

            // Producer 전송 설정
            const producerTransport = await setProducer(device);
            console.log("setProducer");

            // 비디오 스트림 전송 시작
            await startVideoStreaming(stream, producerTransport);
            console.log("startVideoStreaming");

            // 오디오 스트림 전송 시작
            await startAudioStreaming(stream, producerTransport);
            console.log("startAudioStreaming");

            console.log("PRODUCER START");

        } catch (error) {
            console.error('Producer 초기화 실패:', error);
        }
    }

    useEffect(() => {
        start();

        return () => {
            if (webcamStream.current) {
                webcamStream.current.getTracks().forEach(track => track.stop());
            }
            if (producerRef.current) {
                producerRef.current.close();
            }
            if (producerTransportRef.current) {
                producerTransportRef.current.close();
            }
            socket.disconnect();
        };
    }, []);

    return (
        <>
            <h2>WebRTC Producer</h2>
            <div>
                <video
                    ref={localVideo}
                    autoPlay
                    playsInline
                    controls
                    muted
                    style={{ width: '100%', maxWidth: '640px', border: '1px solid #ccc' }}
                />
            </div>
        </>
    );
}

export default App;
