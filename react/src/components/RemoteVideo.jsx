import React, { useRef, useEffect } from "react";

function RemoteVideo({ stream, userId }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            key={userId}
            ref={videoRef}
            autoPlay
            playsInline
            controls
            muted
            style={{ 
                width: '100%', 
                maxWidth: '320px', 
                border: '1px solid #ccc' 
            }}
        />
    );
}

// export default React.memo(RemoteVideo); 
export default RemoteVideo; 