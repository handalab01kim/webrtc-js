import React from 'react';
import Producer from './Producer';
import Consumer from './Consumer';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './styles.css';

function App() {
    return (
        <BrowserRouter>
            <div className="app-container">
                <header className="app-header">
                    <h1>WebRTC SFU 데모</h1>
                    <nav className="app-nav">
                        <Link to="/" className="nav-link">Consumer (시청자)</Link>
                        <Link to="/producer" className="nav-link">Producer (방송자)</Link>
                    </nav>
                </header>

                <main className="app-content">
                    <Routes>
                        <Route path="/" element={<Consumer />} />
                        <Route path="/producer" element={<Producer />} />
                        <Route path="*" element={
                            <div className="not-found">
                                <h2>페이지를 찾을 수 없습니다</h2>
                                <p>요청하신 페이지가 존재하지 않습니다.</p>
                                <Link to="/" className="back-link">홈으로 돌아가기</Link>
                            </div>
                        } />
                    </Routes>
                </main>

                <footer className="app-footer">
                    <p>WebRTC SFU 데모 - Mediasoup 기반 1:n 스트리밍</p>
                </footer>
            </div>
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
