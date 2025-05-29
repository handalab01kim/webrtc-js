import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import {serverUrl} from "../config/config.js";


const mediasoupClient = await import('mediasoup-client');
const socket = io(serverUrl);

function App() {
    const remoteVideo = useRef(null);
    const consumerTransportRef = useRef(null);
    const consumerRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [ready, setReady] = useState(false);

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

            // if (kind === 'video') {
            //     socket.emit('setConsumerPreferredLayers', {
            //         consumerId: id,
            //         spatialLayer: 2,
            //         temporalLayer: 2
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
        // /*

        // setInterval(()=>{
        //     console.log(remoteVideo.current);
        // }, 2000);

        setTimeout(() => {
            console.log("MY_DEBUG1",consumerRef.current)
            console.log("MY_DEBUG2",consumerRef.current.track)
            console.log("MY_DEBUG3",typeof consumerRef.current.track.getStats)
            if (
                consumerRef.current &&
                consumerRef.current.track &&
                typeof consumerRef.current.track.getStats === 'function'
            ) {
                consumerRef.current.track.getStats().then((stats) => {
                    stats.forEach((report) => {
                        if (report.type === 'inbound-rtp' && report.kind === 'video') {
                            console.log('📡 영상 수신 중:', {
                                frameWidth: report.frameWidth,
                                frameHeight: report.frameHeight,
                                framesPerSecond: report.framesPerSecond,
                                packetsReceived: report.packetsReceived,
                                bytesReceived: report.bytesReceived,
                            });
                        }
                    });
                });
            }
        }, 2000);


        // * */
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
                    <button onClick ={()=>{
                        setReady(true);
                        start();
                    }}>
                        start consume
                    </button>
                )}
                {ready &&(
                    <>
                    test
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
                    </>
                )}
            </div>
        </>
    );
}

export default App;
