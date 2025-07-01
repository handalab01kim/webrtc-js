import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

// type SocketStore = {
//   socket: Socket | null;
//   isConnected: boolean;
//   connect: (url: string) => void;
//   disconnect: () => void;
//   sendMessage: (event: string, payload: any) => void;
//   onEvent: (event: string, callback: (...args: any[]) => void) => void;
// };

// export const useSocketStore = create<SocketStore>((set, get) => ({
export const useSocketStore = create((set, get) => ({
    socket: null,
    isConnected: false,
    emitQueue: [], // 최초 소켓 연결 전에 받은 emit 이벤트 대기 큐

    connect: (url) => {
        const existing = get().socket;
        if (existing) {
            existing.disconnect(); // connect 재요청 => 기존 연결 끊고 새로 연결
            // return;           // connect 재요청 => 처음 연결 그대로 유지
        }

        const socket = io(url);

        socket.on('connect', () => {
            console.log('useSocketStore - connected');
            set({ socket, isConnected: true });


            // 연결되면 emitQueue flush
            const queue = get().emitQueue;
            for (const { event, payload } of queue) {
                socket.emit(event, payload);
            }
            set({ emitQueue: [] });


        });

        socket.on('disconnect', () => {
            console.log('useSocketStore - disconnected');
            set({ socket: null, isConnected: false });
        });

        socket.on('connect_error', (err) => {
            console.error('useSocketStore - connect_error', err);
        });
  },

    disconnect: () => {
        const socket = get().socket;
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false });
        }
    },

//   sendMessage: (event, payload) => {
//     const socket = get().socket;
//     if (socket && socket.connected) {
//       socket.emit(event, payload);
//     } else {
//       console.warn('useSocketStore - sendMessage failed!!', event, payload);
//     }
//   },

//   onEvent: (event, callback) => {
//     const socket = get().socket;
//     if (socket) {
//       socket.on(event, callback);
//     } else {
//       console.warn('seSocketStore - registering event failed!!', event);
//     }
//   },

    emit: (...args) => {
        const socket = get().socket;
        if (socket && socket.connected) {
            socket.emit(...args);
        } else {
            const queue = get().emitQueue;
            set({ emitQueue: [...queue, { ...args }] });
        }
    },
}));
