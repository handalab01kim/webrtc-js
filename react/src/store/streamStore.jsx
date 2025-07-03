import { create } from 'zustand';

export const useStreamStore = create((set,get) => ({
    remoteStreams: [],
    setRemoteStreams: (newStreamsList) => set({ remoteStreams: newStreamsList }),
    // addRemoteStreams: (newStreamsList) => {
    //     const currentStreams = get().remoteStreams;
    //     set({ remoteStreams: currentStreams.concat(newStreamsList) });
    // },    
    deleteRemoteStream: (droppedUserId) => {
        // console.log("STORE_DEBUG1",droppedUserId)
        // console.log("STORE_DEBUG2",get().remoteStreams)
        const filtered = get().remoteStreams.filter(
            (item) => item.userId !== droppedUserId?.userId
        );
        set({ remoteStreams: filtered });
    },
    deleteAllRemoteStream: () => {
        set({ remoteStreams: [] });
    }
}));