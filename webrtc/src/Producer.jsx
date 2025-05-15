import React, {useEffect, useRef} from 'react';
import {io} from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');

const socket = io('http://localhost:3001');


function App() {

    const webcamVideo = useRef(null);
    const webcamStream = useRef(null);
    // const remoteVideo = useRef(null);
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
// const consumerTransportRef = useRef(null);

// 웹캠 useRef로 받아오기
    const getWebcamVideo = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false}); // 영상만 받아옴
        // webcamVideo.current.srcObject = stream;
        webcamStream.current = stream;
        if (webcamVideo.current) {
            webcamVideo.current.srcObject = webcamStream.current;
        }
        return stream;
    }

// device 생성, rtpCapabilities 등록
    const createDevice = async () => {
        // Device 생성: 미디어를 보내거나 받기 위해 mediasoup 라우터에 연결하는 엔드포인트 == 클라이언트가 서버의 라우터와의 연결점
        const device = new mediasoupClient.Device();
        deviceRef.current = device;

        // callback 함수를 보내 rtpCapabilities(mediasoup Router가 지원하는 RTP 미디어 코덱/설정의 목록)를 동기적으로 받음
        const rtpCapabilities = await new Promise((resolve) =>
            socket.emit('getRtpCapabilities', resolve)
        );
        // 미디어수프 라우터의 RTP 기능을 기기에 로드 => 지원하는 RTP 미디어 코덱/설정 파악
        await device.load({routerRtpCapabilities: rtpCapabilities});
        return device;
    }

// Producer 전송 설정
    const setProducer = async (device) => {
        // Create Send Transport
        const producerTransportInfo = await new Promise((resolve) =>
            socket.emit('createTransport', resolve)
        );
        const producerTransport = device.createSendTransport(producerTransportInfo);
        producerTransportRef.current = producerTransport;

        // 'connect': 서버측에서 전송하는 이벤트 X, mediasoup-client가 호출하는 추상 이벤트
        // connect 이벤트 발생 시 서버에 DTLS 매개변수 전달
        producerTransport.on('connect', ({dtlsParameters}, callback, errback) => {
            try {
                // 로컬 DTLS 매개변수를 서버 측 transport에 신호 전달
                socket.emit('connectTransport', {dtlsParameters});
                // transport에 parameters들이 전송되었다는 것을 알려주는 역할!
                callback();
            } catch (error) {
                errback(error);
            }
        });
        // 실제 미디어 전송 시작 이벤트
        producerTransport.on('produce', ({kind, rtpParameters}, callback) => {
            socket.emit('produce', {kind, rtpParameters}, callback);
        });

        return producerTransport;
    }

// 전송 시작
    const startProducer = async (stream, producerTransport) => {
        const track = stream.getVideoTracks()[0];
        await producerTransport.produce({track}); // 전송 시작 !!
    }

    const start = async () => {
        // 웹캠 useRef로 받아오기
        const stream = await getWebcamVideo();
        console.log("getWebcamVideo");

        // device 생성, rtpCapabilities 등록
        const device = await createDevice();
        console.log("createDevice");

        // Producer 전송 설정
        const producerTransport = await setProducer(device);
        console.log("setProducer");

        // 전송 시작
        await startProducer(stream, producerTransport);
        console.log("startProducer");

        alert("START!");
    }

    useEffect(() => {
        start();
    }, []);


    return (
        <div>
            producer page
            {/*<h2>Local Webcam</h2>*/}
            {/*<video ref={webcamVideo} autoPlay playsInline muted width="320"/>*/}
            {/*<h2>Remote Stream</h2>*/}
            {/*<video ref={remoteVideo} autoPlay playsInline width="320"/>*/}
        </div>
    );

}

export default App;