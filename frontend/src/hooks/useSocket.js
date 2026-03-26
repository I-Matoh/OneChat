import { io } from 'socket.io-client';
import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

let socket = null;

export function getSocket(token) {
  if (!socket && token) {
    socket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    socket.on('connect', () => console.log('🔌 Socket connected'));
    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
    socket.on('connect_error', (err) => console.error('Socket error:', err.message));
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function useSocket(token) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    socketRef.current = s;

    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [token]);

  return { socket: socketRef.current, connected };
}

export function useSocketEvent(eventName, handler) {
  const savedHandler = useRef(handler);
  useEffect(() => { savedHandler.current = handler; }, [handler]);

  useEffect(() => {
    if (!socket) return;
    const fn = (...args) => savedHandler.current(...args);
    socket.on(eventName, fn);
    return () => socket.off(eventName, fn);
  }, [eventName]);
}
