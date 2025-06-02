import React, { useState } from 'react';
import Producer from '../components/Producer'; // 기존 App 컴포넌트를 Producer로 이름 변경했다고 가정
import Consumer from '../components/Consumer';

function CamChat() {
    const [remoteStreams, setRemoteStreams] = useState([]);

    return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '16px' }}>
            {/* 내 웹캠 */}
            <div style={{ flex: '0 0 auto' }}>
                <Producer />
            </div>

            {/* 소비된 원격 영상들 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {remoteStreams.map(({ socketId, stream }) => (
                    <video
                        key={socketId}
                        autoPlay
                        playsInline
                        controls
                        muted
                        style={{ width: '100%', maxWidth: '320px', border: '1px solid #ccc' }}
                        ref={(video) => {
                            if (video && stream) video.srcObject = stream;
                        }}
                    />
                ))}
            </div>

            {/* Consumer는 영상만 수집, 렌더링은 CamChat에서 */}
            <Consumer onStreams={setRemoteStreams} />
        </div>
    );
}

export default CamChat;
