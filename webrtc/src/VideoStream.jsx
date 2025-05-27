import React, {useEffect, useRef} from 'react';


const WebRTCPlayer = ({stream}) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((err) => {
                console.warn('play() failed:', err);
            });
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls
            style={{
                width: '100%',
                maxWidth: '640px',
                border: '1px solid #ccc',
            }}
        />
    );
};

export default WebRTCPlayer;
