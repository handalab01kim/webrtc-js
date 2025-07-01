import { create } from 'zustand';

export const useStreamStore = create((set,get) => ({
    remoteStreams: [],
    setRemoteStreams: (newStreamsList) => set({ remoteStreams: newStreamsList }),
    // addRemoteStreams: (newStreamsList) => {
    //     const currentStreams = get().remoteStreams;
    //     set({ remoteStreams: currentStreams.concat(newStreamsList) });
    // },    
    deleteRemoteStream: (droppedSocketId) => {
        // console.log("STORE_DEBUG1",droppedSocketId)
        // console.log("STORE_DEBUG2",get().remoteStreams)
        const filtered = get().remoteStreams.filter(
            (item) => item.socketId !== droppedSocketId?.socketId
        );
        set({ remoteStreams: filtered });
    },
    deleteAllRemoteStream: () => {
        set({ remoteStreams: [] });
    }
}));