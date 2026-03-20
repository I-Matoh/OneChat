import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Floating particle that represents a chat message bubble
 * Creates visual interest without overwhelming the login form
 */
function ChatBubble({ position, scale, speed, color }) {
  const meshRef = useRef();
  const initialY = position[1];
  
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = initialY + Math.sin(state.clock.elapsedTime * speed) * 0.3;
      // Slow rotation
      meshRef.current.rotation.x += 0.002;
      meshRef.current.rotation.y += 0.003;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={0.5} 
          roughness={0.1}
          metalness={0.3}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
    </Float>
  );
}

/**
 * Animated ring that represents connection/collaboration
 */
function ConnectionRing({ position, scale, speed }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.7;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <torusGeometry args={[1, 0.3, 16, 100]} />
      <meshStandardMaterial 
        color="#f43f5e" 
        transparent 
        opacity={0.35} 
        roughness={0.1}
        metalness={0.5}
        emissive="#f43f5e"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

/**
 * Main 3D scene content - renders all 3D elements
 */
function SceneContent() {
  // Generate random positions for chat bubbles -  colors
  const bubbles = useMemo(() => {
    const colors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#fbbf24', '#ec4899'];
    return Array.from({ length: 15 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6 - 2
      ],
      scale: 0.2 + Math.random() * 0.4,
      speed: 0.5 + Math.random() * 1.5,
      color: colors[i % colors.length]
    }));
  }, []);

  // Generate connection rings
  const rings = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        -3 - i * 2
      ],
      scale: 0.5 + Math.random() * 0.8,
      speed: 0.3 + Math.random() * 0.3
    }));
  }, []);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.35} />
      
      {/* Main directional light */}
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.7} 
        color="#ffffff"
      />
      
      {/* Accent point lights - luxury rose gold and gold */}
      <pointLight position={[-5, 3, 2]} intensity={0.6} color="#f43f5e" />
      <pointLight position={[5, -3, 2]} intensity={0.4} color="#f59e0b" />
      <pointLight position={[0, -4, 3]} intensity={0.3} color="#10b981" />
      
      {/* Starfield background */}
      <Stars 
        radius={50} 
        depth={50} 
        count={2000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={0.5}
      />
      
      {/* Floating chat bubbles */}
      {bubbles.map((bubble, i) => (
        <ChatBubble 
          key={`bubble-${i}`}
          position={bubble.position}
          scale={bubble.scale}
          speed={bubble.speed}
          color={bubble.color}
        />
      ))}
      
      {/* Connection rings */}
      {rings.map((ring, i) => (
        <ConnectionRing 
          key={`ring-${i}`}
          position={ring.position}
          scale={ring.scale}
          speed={ring.speed}
        />
      ))}
    </>
  );
}

/**
 * Login Background 3D Component
 * Provides an immersive 3D experience behind the login form
 * 
 * Features:
 * - Floating chat bubble particles representing communication
 * - Connection rings representing collaboration
 * - Starfield background for depth
 * - Smooth animations with low performance impact
 * - Responsive to different screen sizes
 */
export default function LoginBackground() {
  return (
    <div className="login-3d-background">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]} // Responsive pixel ratio for performance
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
