import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');
const socket = io('http://localhost:3001');

function App() {
    const localVideo = useRef(null);
    const webcamStream = useRef(null);
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const producerRef = useRef(null);
    const [status, setStatus] = useState('초기화 중...');
    const [error, setError] = useState(null);

    const getWebcamVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true // 오디오도 활성화
            });
            webcamStream.current = stream;

            // 로컬 비디오 미리보기 설정
            if (localVideo.current) {
                localVideo.current.srcObject = stream;
            }

            return stream;
        } catch (error) {
            console.error('웹캠 접근 실패:', error);
            setError('웹캠에 접근할 수 없습니다: ' + error.message);
            throw error;
        }
    }

    const start = async () => {
        try {
            setStatus('웹캠 스트림 가져오는 중...');
            const stream = await getWebcamVideo();
            setStatus('웹캠 스트림 준비됨');

            // Device 생성 및 초기화
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

            await device.load({ routerRtpCapabilities: rtpCapabilities });
            setStatus('Mediasoup Device 초기화됨');

            // Producer Transport 생성
            setStatus('Producer Transport 생성 중...');
            const transportInfo = await new Promise((resolve, reject) => {
                socket.emit('createProducerTransport', (data) => {
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data);
                    }
                });
            });

            const producerTransport = device.createSendTransport(transportInfo);
            producerTransportRef.current = producerTransport;

            // Transport 이벤트 핸들러 설정
            producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    await new Promise((resolve, reject) => {
                        socket.emit('connectProducerTransport', { dtlsParameters }, (response) => {
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve();
                            }
                        });
                    });
                    callback();
                } catch (error) {
                    errback(error);
                    setError('Transport 연결 실패: ' + error.message);
                }
            });

            producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                try {
                    const { id } = await new Promise((resolve, reject) => {
                        socket.emit('produce', { kind, rtpParameters }, (response) => {
                            if (response.error) {
                                reject(new Error(response.error));
                            } else {
                                resolve(response);
                            }
                        });
                    });
                    callback({ id });
                } catch (error) {
                    errback(error);
                    setError('미디어 스트림 생성 실패: ' + error.message);
                }
            });

            // 비디오 스트림 전송 시작
            setStatus('비디오 스트림 전송 시작 중...');
            const videoTrack = stream.getVideoTracks()[0];
            const videoProducer = await producerTransport.produce({ track: videoTrack });
            producerRef.current = videoProducer;

            // 오디오 스트림 전송 시작 (오디오 트랙이 있는 경우)
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                setStatus('오디오 스트림 전송 시작 중...');
                const audioTrack = audioTracks[0];
                await producerTransport.produce({ track: audioTrack });
            }

            setStatus('스트리밍 중...');

        } catch (error) {
            console.error('Producer 초기화 실패:', error);
            setError('초기화 실패: ' + error.message);
            setStatus('오류 발생');
        }
    }

    useEffect(() => {
        start();

        return () => {
            // 정리 작업
            if (webcamStream.current) {
                webcamStream.current.getTracks().forEach(track => track.stop());
            }

            if (producerRef.current) {
                producerRef.current.close();
            }

            if (producerTransportRef.current) {
                producerTransportRef.current.close();
            }

            // 소켓 연결 해제
            socket.disconnect();
        };
    }, []);
    setTimeout(() => {
        const k = localVideo;
        console.log("my_debug@@@@", k.current);
        console.log("my_debug@@@2", k.current.srcObject);
        console.log("my_debug@@@3", k.current.srcObject.getVideoTracks());

    }, 2000)
    return (
        <div className="producer-container">
            <h2>WebRTC 스트리밍 (Producer)</h2>
            <div className="status">상태: {status}</div>
            {error && <div className="error">에러: {error}</div>}
            <div className="video-container">
                <video
                    ref={localVideo}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', maxWidth: '640px', border: '1px solid #ccc' }}
                />
            </div>
        </div>
    );
}

export default App;
