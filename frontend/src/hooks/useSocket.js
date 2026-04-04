import { io } from 'socket.io-client';
import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
const HEARTBEAT_MS = 10000;

let socket = null;

function getStoredToken() {
  try {
    const auth = JSON.parse(localStorage.getItem('onechat_auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

export function getSocket(token) {
  if (!socket && token) {
    socket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    socket.on('connect', () => console.log('Socket connected'));
    socket.on('disconnect', () => console.log('Socket disconnected'));
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
    if (!token) {
      setConnected(false);
      return;
    }

    const s = getSocket(token);
    socketRef.current = s;
    let heartbeatInterval = null;

    function sendHeartbeat(status = 'online') {
      s.emit('presence:update', { status });
      s.emit('presence:heartbeat');
    }

    function startHeartbeat() {
      if (heartbeatInterval) window.clearInterval(heartbeatInterval);
      heartbeatInterval = window.setInterval(() => sendHeartbeat(), HEARTBEAT_MS);
    }

    function onConnect() {
      setConnected(true);
      sendHeartbeat();
      startHeartbeat();
    }

    function onDisconnect() {
      setConnected(false);
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        s.emit('presence:update', { status: 'away' });
      } else {
        sendHeartbeat('online');
      }
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (s.connected) {
      setConnected(true);
      sendHeartbeat();
      startHeartbeat();
    }

    return () => {
      if (heartbeatInterval) window.clearInterval(heartbeatInterval);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token]);

  return { socket: socketRef.current, connected };
}

export function useSocketEvent(eventName, handler, deps = []) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler, ...deps]);

  useEffect(() => {
    const resolvedSocket = socket || getSocket(getStoredToken());
    if (!resolvedSocket) return;

    const fn = (...args) => savedHandler.current(...args);
    resolvedSocket.on(eventName, fn);

    return () => {
      resolvedSocket.off(eventName, fn);
    };
  }, [eventName]);
}
