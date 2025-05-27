import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');
const socket = io('http://localhost:3001');

function App() {
    const remoteVideo = useRef(null);
    const deviceRef = useRef(null);
    const consumerTransportRef = useRef(null);
    const consumerRef = useRef(null);
    const [status, setStatus] = useState('초기화 중...');
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);

    const start = async () => {
        try {
            // Mediasoup Device 초기화
            setStatus('Mediasoup Device 초기화 중...');
            const device = new mediasoupClient.Device();
            deviceRef.current = device;

            const rtpCapabilities = await new Promise((resolve, reject) => {
                socket.emit('getRtpCapabilities', (data) => {
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data);
                    }
                });
            });

            await device.load({routerRtpCapabilities: rtpCapabilities});
            setStatus('Mediasoup Device 초기화됨');

            // Consumer Transport 생성
            setStatus('Consumer Transport 생성 중...');
            const transportInfo = await new Promise((resolve, reject) => {
                socket.emit('createConsumerTransport', (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            setStatus('Consumer Transport 정보 받음');

            // Consumer Transport 설정
            const consumerTransport = device.createRecvTransport(transportInfo);
            consumerTransportRef.current = consumerTransport;

            // Transport 이벤트 핸들러 설정
            consumerTransport.on('connect', async ({dtlsParameters}, callback, errback) => {
                try {
                    setStatus('Consumer Transport 연결 중...');
                    await new Promise((resolve, reject) => {
                        socket.emit('connectConsumerTransport', {dtlsParameters}, (response) => {
                            if (response && response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve();
                            }
                        });
                    });
                    setStatus('Consumer Transport 연결됨');
                    callback();
                } catch (error) {
                    errback(error);
                    setError('Transport 연결 실패: ' + error.message);
                }
            });

            // 미디어 소비 시작
// 1. producers 목록 요청
            const producers = await new Promise((resolve) => {
                socket.emit('getProducers', (list) => resolve(list)); // [{kind: "video", id: "..."}]
            });

// 2. 각 producer에 대해 consume 수행
            for (const { kind, id: producerId } of producers) {
                const { id, kind, rtpParameters } = await new Promise((resolve, reject) => {
                    socket.emit('consume', { producerId, rtpCapabilities: device.rtpCapabilities }, (res) => {
                        if (res.error) reject(res.error);
                        else resolve(res);
                    });
                });

                const consumer = await consumerTransport.consume({ id, producerId, kind, rtpParameters });
                await consumer.resume();

                consumerRef.current = consumer; // 원하면 따로 리스트에 저장해도 됨

                const stream = new MediaStream([consumer.track]);

                if (kind === 'video') {
                    if (remoteVideo.current) {
                        remoteVideo.current.srcObject = stream;
                    }
                    setConnected(true);
                    setStatus('비디오 스트림 수신 중...');
                } else if (kind === 'audio') {
                    const audio = new Audio();
                    audio.srcObject = stream;
                    audio.play().catch((e) => console.warn('오디오 재생 실패:', e));
                }
            }


            setStatus('미디어 스트림 정보 받음');



            // Producer가 닫힐 때 이벤트 처리
            socket.on('producerClosed', () => {
                setStatus('Producer가 연결을 종료했습니다');
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
            console.error('Consumer 초기화 실패:', error);
            setError('초기화 실패: ' + error.message);
            setStatus('오류 발생');
        }
    };

    // 재연결 시도 함수
    const reconnect = () => {
        setError(null);
        setStatus('재연결 시도 중...');

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

    setTimeout(() => {
        const videoEl = remoteVideo.current;
        if (!videoEl) return;

        const stream = videoEl.srcObject;
        console.log("my_debug@@@@ video element:", videoEl);
        console.log("my_debug@@@2 srcObject:", stream);

        if (stream instanceof MediaStream) {
            const tracks = stream.getTracks();
            const videoTracks = stream.getVideoTracks();
            console.log("my_debug@@@3 getTracks():", tracks);
            console.log("my_debug@@@4 getVideoTracks():", videoTracks);

            if (videoTracks.length > 0) {
                console.log("my_debug@@@5 track readyState:", videoTracks[0].readyState);
                console.log("my_debug@@@6 track muted:", videoTracks[0].muted);
            }
        } else {
            console.warn("srcObject가 MediaStream이 아님");
        }
    }, 2000);

    return (
        <div className="consumer-container">
            <h2>WebRTC 스트림 수신 (Consumer)</h2>
            <div className="status">상태: {status}</div>
            {error && (
                <div className="error-container">
                    <div className="error">에러: {error}</div>
                    <button onClick={reconnect} className="reconnect-button">재연결 시도</button>
                </div>
            )}
            <div className="video-container">
                {!connected && !error && (
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
