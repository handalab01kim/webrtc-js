// socketInstance.ts
import { io } from 'socket.io-client';
import {serverUrl} from "../config/config.js";

let socket = undefined;
let currentUserId = undefined;

export function getConnectedSocket(userId){
    if(socket && currentUserId === userId) return socket;

    console.log("New WebSocket Connection; userId", userId);

    socket = io(serverUrl,{
        query: {userId: userId},
    });
    currentUserId = userId;
    return socket;
}

export function getCurrentUserId(){
    return currentUserId;
};