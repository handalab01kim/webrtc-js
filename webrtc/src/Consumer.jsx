import React, {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import ReactPlayer from 'react-player/lazy';
import VideoStream from './VideoStream';

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
            setStatus('미디어 스트림 요청 중...');
            const {id, producerId, kind, rtpParameters} = await new Promise((resolve, reject) => {
                socket.emit('consume', {rtpCapabilities: device.rtpCapabilities}, (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            setStatus('미디어 스트림 정보 받음');

            // Consumer 생성
            const consumer = await consumerTransport.consume({
                id,
                producerId,
                kind,
                rtpParameters
            });

            consumerRef.current = consumer;

            // 비디오 스트림 설정
            const stream = new MediaStream([consumer.track]);
            // 🛠 만약 꺼져 있다면 켜기
            if (!consumer.track.enabled) {
                console.warn("track.enabled가 false 상태입니다. 활성화합니다.");
                consumer.track.enabled = true;
            }
            if (remoteVideo.current) {
                remoteVideo.current.srcObject = stream;
                remoteVideo.current.play().catch(e => {
                    console.warn("재생 실패:", e);
                });
            }


            setStatus('스트림 수신 중...');
            setConnected(true);

            // Producer가 닫힐 때 이벤트 처리
            socket.on('producerClosed', () => {
                setStatus('Producer가 연결을 종료했습니다');
                setConnected(false);

                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = null;
                }

                if (consumerRef.current) {
                    consumerRef.current.close();
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
                consumerRef.current.close();
            }

            if (consumerTransportRef.current) {
                consumerTransportRef.current.close();
            }

            // 소켓 이벤트 리스너 제거
            socket.off('producerClosed');

            // 소켓 연결 해제
            socket.disconnect();
        };
    }, []);

    setTimeout(()=>{
        console.log(typeof remoteVideo, "\nMYDEBUG\n", remoteVideo.current, remoteVideo.current.srcObject)
    },5000);
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
                {/*<video*/}
                {/*    ref={remoteVideo}*/}
                {/*    autoPlay*/}
                {/*    playsInline*/}
                {/*    muted // 추가*/}
                {/*    controls // 디버깅용으로 추가*/}
                {/*    style={{*/}
                {/*        width: '100%',*/}
                {/*        maxWidth: '640px',*/}
                {/*        border: '1px solid #ccc',*/}
                {/*        display: connected ? 'block' : 'none'*/}
                {/*    }}*/}
                {/*/>*/}
                <VideoStream ref={remoteVideo}/>

            </div>
        </div>
    );
}

export default App;
