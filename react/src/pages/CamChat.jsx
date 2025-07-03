import React, { useState, useEffect } from 'react';
import Producer from '../components/Producer'; // 기존 App 컴포넌트를 Producer로 이름 변경했다고 가정
import Consumer from '../components/Consumer';
import { useStreamStore } from '../store/streamStore'; 
import { useParams } from 'react-router-dom';
import RemoteVideo from '../components/RemoteVideo';

function CamChat() {
    const { id } = useParams(); // 주소로 주어진 id 값
    const {remoteStreams, deleteAllRemoteStream} = useStreamStore(); 
    // useEffect(()=>{
    //     setTimeout(()=>{
    //         console.log("😎", remoteStreams)
    //     },2000);
    //     return ()=>{
    //     };
    // }, [remoteStreams]);
    useEffect(()=>{
        // rerendering: auto
        return ()=>{
            // delete all remoteStream
            deleteAllRemoteStream();
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '16px' }}>
            {/* Producer (producing 시작, 반환 객체는 단순 웹캠 스트림)*/}
            <div style={{ flex: '0 0 auto' }}>
                <Producer myUserId={id}/>
            </div>

            {/* consuming 시작된 remoteStreams 영상 리스트 렌더링 */}
            { remoteStreams.length==0 ? (<div>Loading...</div>
            ):(
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {remoteStreams.map(({ userId, stream }) => (
                    // <video
                    //     key={userId}
                    //     autoPlay
                    //     playsInline
                    //     controls
                    //     muted
                    //     style={{ width: '100%', maxWidth: '320px', border: '1px solid #ccc' }}
                    //     ref={(video) => {
                    //         if (video && stream) video.srcObject = stream;
                    //     }}
                    // />
                    <RemoteVideo key={userId} userId={userId} stream={stream} />
                ))}
            </div>
            )}


            {/* Consumer => 영상 수집, 렌더링은 CamChat 컴포넌트에서 */}
            <Consumer myUserId={id}/>
        </div>
    );
}

export default CamChat;
