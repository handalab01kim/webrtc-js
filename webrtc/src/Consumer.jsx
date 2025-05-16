import React, {useEffect, useRef} from 'react';
import {io} from 'socket.io-client';

const mediasoupClient = await import('mediasoup-client');

const socket = io('http://localhost:3001');

// 플레인트랜스포트
function App() {


    const remoteVideo = useRef(null);
    const deviceRef = useRef(null);
    const consumerTransportRef = useRef(null);

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


    const start = async () => {
        // device 생성, rtpCapabilities 등록
        const device = await createDevice();

        console.log("MYDEBG0");
        // Consumer transport
        const consumerTransportInfo = await new Promise((res) =>
            socket.emit('createConsumerTransport', res)
        );
        const consumerTransport = device.createRecvTransport(consumerTransportInfo);
        consumerTransportRef.current = consumerTransport;

        consumerTransport.on('connect', ({dtlsParameters}, cb) => {
            socket.emit('connectConsumerTransport', {dtlsParameters});
            cb();
        });

        const consumerInfo = await new Promise((res) =>
            socket.emit('consume', {rtpCapabilities: device.rtpCapabilities}, res)
        );

        const consumer = await consumerTransport.consume({
            id: consumerInfo.id,
            producerId: consumerInfo.producerId,
            kind: consumerInfo.kind,
            rtpParameters: consumerInfo.rtpParameters,
        });
        console.log("MYDEBG1");

        const newStream = new MediaStream();
        newStream.addTrack(consumer.track);
        remoteVideo.current.srcObject = newStream;
        console.log("MYDEBG2");
    }

    useEffect(() => {
        start();
    }, []);


    return (
        <div>
            consumer page
            {/*<h2>Local Webcam</h2>*/}
            {/*<video ref={webcamVideo} autoPlay playsInline muted width="320"/>*/}
            {/*<h2>Remote Stream</h2>*/}
            <video ref={remoteVideo} autoPlay playsInline width="320"/>
        </div>
    );

}

export default App;