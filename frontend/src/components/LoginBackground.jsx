import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Floating particle that represents a chat message bubble
 * Features a luxury frosted glassmorphism aesthetic
 */
function ChatBubble({ position, scale, speed }) {
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
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial 
          color="#ffffff" 
          transmission={0.95}
          opacity={1} 
          metalness={0.1}
          roughness={0.1}
          ior={1.5}
          thickness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
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
      <torusGeometry args={[1, 0.015, 32, 100]} />
      <meshStandardMaterial 
        color="#ffffff" 
        transparent 
        opacity={0.15} 
        roughness={0.1}
        metalness={0.8}
        emissive="#ffffff"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

/**
 * Main 3D scene content - renders all 3D elements
 */
function SceneContent() {
  // Generate random positions for chat bubbles
  const bubbles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8 - 2
      ],
      scale: 0.3 + Math.random() * 0.7,
      speed: 0.2 + Math.random() * 0.8,
    }));
  }, []);

  // Generate connection rings
  const rings = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8,
        -4 - i * 2
      ],
      scale: 1 + Math.random() * 1.5,
      speed: 0.1 + Math.random() * 0.3
    }));
  }, []);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.15} />
      
      {/* Subtle, elegant directional lighting */}
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.6} 
        color="#ffffff"
      />
      
      {/* Accent point lights - Slate/Ice Blue for luxury tech feel */}
      <pointLight position={[-5, 3, 2]} intensity={0.5} color="#818cf8" />
      <pointLight position={[5, -3, 2]} intensity={0.3} color="#e0e7ff" />
      <pointLight position={[0, -5, -2]} intensity={0.2} color="#312e81" />
      
      {/* Starfield background */}
      <Stars 
        radius={100} 
        depth={50} 
        count={3000} 
        factor={3} 
        saturation={0} 
        fade 
        speed={0.2}
      />
      
      {/* Floating glass chat bubbles */}
      {bubbles.map((bubble, i) => (
        <ChatBubble 
          key={`bubble-${i}`}
          position={bubble.position}
          scale={bubble.scale}
          speed={bubble.speed}
        />
      ))}
      
      {/* Delicate connection rings */}
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
 * Elegant, luxury monochromatic 3D experience
 */
export default function LoginBackground() {
  return (
    <div 
      className="login-3d-background" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: '#020202', // Deep cinematic black
        zIndex: 0 
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]} // Responsive pixel ratio for performance
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        }}
      >
        <color attach="background" args={['#020202']} />
        <SceneContent />
      </Canvas>
    </div>
  );
}
