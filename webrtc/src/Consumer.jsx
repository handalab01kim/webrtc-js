import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');
const socket = io('http://localhost:3001');

// Quality options for consumer
const qualityOptions = [
    { label: 'High Quality', value: 2 },
    { label: 'Medium Quality', value: 1 },
    { label: 'Low Quality', value: 0 }
];

function App() {
    const remoteVideo = useRef(null);
    const consumerTransportRef = useRef(null);
    const consumerRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [ready, setReady] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(2); // Default: High Quality

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

        // - 각 producer(video, audio)에 대해 consume
        for (const { kind, id: producerId } of producers) {
            const { id, kind, rtpParameters } = await new Promise((resolve, reject) => {
                socket.emit('consume', { producerId, rtpCapabilities: device.rtpCapabilities }, (res) => {
                    if (res.error) reject(res.error);
                    else resolve(res);
                });
            });

            const consumer = await consumerTransport.consume({ id, producerId, kind, rtpParameters });
            await consumer.resume();

            // console.log('consumer.rtpParameters.encodings:', consumer.rtpParameters.encodings);
            // console.log('setPreferredLayers:', typeof consumer.setPreferredLayers);

            // if (kind === 'video') {
            //     console.log(consumer);
            //     await consumer.setPreferredLayers({
            //         spatialLayer: 2,  // 해상도 선택 (고해상도 원본 / Producer.jsx encodings-scaleResolutionDownBy 커스텀 설정 값(idx)
            //         temporalLayer: 2  // 프레임레이트 선택 (0: 7.5fps, 1: 15fps, 2: 30fps), 기본값 자동 산정?
            //     });
            // }


            consumerRef.current = consumer;

            const stream = new MediaStream([consumer.track]);

            if (kind === 'video') {
                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = stream;
                }
                setConnected(true);
            } else if (kind === 'audio') {
                const audio = new Audio();
                audio.srcObject = stream;
                audio.play().catch((e) => console.warn('오디오 재생 실패:', e));
            }
        }
        socket.on('producerClosed', () => {
            console.log('Producer 연결 종료');
            setConnected(false);

            if (remoteVideo.current) {
                remoteVideo.current.srcObject = null;
                console.log("MY_DEBUG2")
            }

            if (consumerRef.current) {
                consumerRef.current.close();
                console.log("MY_DEBUG3")
            }
        });
    }

    const start = async () => {
        try {
            // device 생성
            const device = await createDevice();
            console.log("createDevice");

            // recvTransport 생성
            const consumerTransport = await setConsumer(device);
            console.log("setConsumer");

            // consume 시작
            await startConsuming(device, consumerTransport);
            console.log("startConsuming");


        } catch (e) {
            console.log(e);
        }
    };

    useEffect(() => {
        // start();

        return () => {
            if (consumerRef.current) {
                console.log("MY_DEBUG4")
                consumerRef.current.close();
            }

            if (consumerTransportRef.current) {
                console.log("MY_DEBUG5")
                consumerTransportRef.current.close();
            }

            socket.off('producerClosed');

            socket.disconnect();
        };
    }, []);


    return (
        <>
            <h2>WebRTC Consumer</h2>
            <div>
                {!ready && (
                    <button onClick ={()=>{setReady(true);start();}}>start consume</button>
                )}
                {ready &&(
                    <video
                        ref={remoteVideo}
                        autoPlay
                        playsInline
                        muted
                        controls
                        style={{
                            width: '100%',
                            maxWidth: '640px',
                            border: '1px solid #ccc',
                            display: connected ? 'block' : 'none'
                        }}
                    />
                )}
            </div>
        </>
    );
}

export default App;
