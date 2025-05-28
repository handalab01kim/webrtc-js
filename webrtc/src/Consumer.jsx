import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');
const socket = io('http://localhost:3001');

const TEST_ROOM = 1;

const createDevice = async () => {
    const device = new mediasoupClient.Device();

    const rtpCapabilities = await new Promise((resolve, reject) => {
        socket.emit('getRtpCapabilities', resolve);
    });

    await device.load({routerRtpCapabilities: rtpCapabilities});
    return device;
};

function App() {
    const remoteVideo = useRef(null);
    const consumerTransportRef = useRef(null);
    const consumerRef = useRef(null);
    const [connected, setConnected] = useState(false);

    const start = async () => {
        try {
            const device = await createDevice();
            console.log("createDevice");



            const transportInfo = await new Promise((resolve, reject) => {
                socket.emit('createConsumerTransport', resolve);
            });

            const consumerTransport = device.createRecvTransport(transportInfo);
            consumerTransportRef.current = consumerTransport;

            // Transport 이벤트 핸들러 설정
            consumerTransport.on('connect', async ({dtlsParameters}, callback, errback) => {
                try {
                    console.log('Consumer Transport 연결 중...');
                    await new Promise((resolve, reject) => {
                        socket.emit('connectConsumerTransport', {dtlsParameters}, resolve);
                    });
                    callback();
                } catch (error) {
                    errback(error);
                    console.log('Transport 연결 실패: ' + error.message);
                }
            });

            // 미디어 소비 시작
            // 1. producers 목록 요청
            let producers;
            try{
                producers = await new Promise((resolve, reject) => {
                    socket.emit('getProducers', {roomIds:[TEST_ROOM]}, (list)=>{
                        if(list.error || list.length === 0){
                            reject(new Error("producer가 없습니다"));
                            return;
                        }
                        resolve(list);
                    }); // [{kind: "video", id: "..."}]
                });
            } catch (e){
                console.log(e);
                return;
            }
            console.log("MY_DEBUG11111", producers);
            // 2. 각 producer에 대해 consume 수행
            for(const p of producers){
                console.log(p);
                for (const { kind, id: producerId } of p) {
                    const { id, kind, rtpParameters } = await new Promise((resolve, reject) => {
                        socket.emit('consume', { producerId, rtpCapabilities: device.rtpCapabilities }, (res) => {
                            if (res.error) reject(res.error);
                            else resolve(res);
                        });
                    });

                    const consumer = await consumerTransport.consume({ id, producerId, kind, rtpParameters });
                    await consumer.resume();

                    consumerRef.current = consumer;

                    const stream = new MediaStream([consumer.track]);

                    if (kind === 'video') {
                        if (remoteVideo.current) {
                            remoteVideo.current.srcObject = stream;
                        }
                        setConnected(true);
                        console.log('비디오 스트림 수신 중...');
                    } else if (kind === 'audio') {
                        const audio = new Audio();
                        audio.srcObject = stream;
                        audio.play().catch((e) => console.warn('오디오 재생 실패:', e));
                    }
                }

            }


            // Producer가 닫힐 때 이벤트 처리
            socket.on('producerClosed', () => {
                console.log('Producer가 연결을 종료했습니다');
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

        } catch (error) {
            console.log('consumer 초기화 실패: ' + error.message);
        }
    };

    // 재연결 시도 함수
    const reconnect = () => {
        console.log('재연결 시도 중...');

        // 기존 리소스 정리
        if (consumerRef.current) {
            consumerRef.current.close();
            consumerRef.current = null;
        }

        if (consumerTransportRef.current) {
            consumerTransportRef.current.close();
            consumerTransportRef.current = null;
        }

        if (remoteVideo.current) {
            remoteVideo.current.srcObject = null;
        }

        // 재연결 시작
        start();
    };

    useEffect(() => {
        start();

        return () => {
            // 정리 작업
            if (consumerRef.current) {
                console.log("MY_DEBUG4")
                consumerRef.current.close();
            }

            if (consumerTransportRef.current) {
                console.log("MY_DEBUG5")
                consumerTransportRef.current.close();
            }

            // 소켓 이벤트 리스너 제거
            socket.off('producerClosed');

            // 소켓 연결 해제
            socket.disconnect();
        };
    }, []);


    return (
        <div>
            <h2>WebRTC Consumer</h2>
            <div>
                {!connected && (
                    <div className="waiting-message">
                        Producer 연결 대기 중...
                    </div>
                )}
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
            </div>
        </div>
    );
}

export default App;
