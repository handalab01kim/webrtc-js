import React, {useEffect} from 'react';
import Producer from './Producer';
import Consumer from './Consumer';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
function App() {

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Consumer />}></Route>
                <Route path="/producer" element={<Producer />}></Route>
                <Route path="*" element={<div>not found</div>}></Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;

// // 방 참가
// const joinRoom = async (roomId) => {
//     socket.emit('joinRoom', {roomId: roomId}, async ({producers}) => {
//         // producers: 현재 방에 있는 다른 사용자들의 producerId 배열
//         for (const producerId of producers) {
//             const consumerTransportInfo = await new Promise((res) =>
//                 socket.emit('createConsumerTransport', res)
//             );
//             const consumerTransport = deviceRef.current.createRecvTransport(consumerTransportInfo);
//
//             consumerTransport.on('connect', ({dtlsParameters}, callback, errback) => {
//                 socket.emit('connectConsumerTransport', {dtlsParameters}, callback);
//             });
//
//             const consumerInfo = await new Promise((res) =>
//                 socket.emit('consume', {producerId, rtpCapabilities: deviceRef.current.rtpCapabilities}, res)
//             );
//
//             const consumer = await consumerTransport.consume({
//                 id: consumerInfo.id,
//                 producerId,
//                 kind: consumerInfo.kind,
//                 rtpParameters: consumerInfo.rtpParameters,
//             });
//
//             const stream = new MediaStream([consumer.track]);
//             remoteVideo.current.srcObject = stream;
//         }
//     });
//
// }

// async function start() {

// }



// const [kk, setKk] = useState(160);
// const [dir, setDir] = useState(160);
// useEffect(() => {
//     const interval = setInterval(() => {
//         setKk(prev => {
//             const newVal = dir ? prev + 1 : prev - 1;
//             if(newVal>180) {
//                 setDir(false);
//             }
//             if(newVal<1) {
//                 console.log(1);
//             }
//             return newVal;
//         });
//     }, 10); // 0.1초마다 실행
//
//     return () => clearInterval(interval); // 언마운트 시 정리
// }, [dir]);