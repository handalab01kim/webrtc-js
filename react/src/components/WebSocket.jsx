// socketInstance.ts
import { io } from 'socket.io-client';
import {serverUrl} from "../config/config.js";

export const socket = io(serverUrl);

