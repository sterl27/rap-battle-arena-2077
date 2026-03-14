import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { audioController } from '../services/audioService';

const ReactiveFloor = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create a grid geometry
  const geometry = useMemo(() => new THREE.PlaneGeometry(100, 100, 64, 64), []);
  const originalPositions = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const data = audioController.getFrequencyData();
    const positions = meshRef.current.geometry.attributes.position;
    const array = positions.array as Float32Array;
    const count = positions.count;

    const time = state.clock.getElapsedTime();
    const avgFreq = audioController.getAverageFrequency();
    const boost = avgFreq / 255;

    for (let i = 0; i < count; i++) {
      const x = originalPositions[i * 3];
      const y = originalPositions[i * 3 + 1];
      const z = originalPositions[i * 3 + 2];
      
      const dist = Math.sqrt(x * x + y * y);
      
      // Complex ripple
      const ripple = Math.sin(dist * 0.4 - time * 4) * Math.cos(x * 0.1 + time) * (1 + boost * 3);
      
      const dataIndex = Math.floor((dist / 50) * (data.length / 2)) % data.length;
      const audioVal = (data[dataIndex] || 0) / 255;
      
      array[i * 3 + 2] = z + ripple * 0.3 + (audioVal * 12 * Math.max(0, 1 - dist/35)); 
    }
    
    positions.needsUpdate = true;
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + boost * 2;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} geometry={geometry}>
      <meshStandardMaterial 
        color="#000000" 
        wireframe 
        emissive="#00f3ff"
        emissiveIntensity={0.5}
        roughness={0}
        metalness={1}
      />
    </mesh>
  );
};

const HologramPillar = ({ position, color }: { position: [number, number, number], color: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
        meshRef.current.rotation.y += 0.01;
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <cylinderGeometry args={[0.5, 0.5, 10, 16]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={0.6} 
        emissive={color}
        emissiveIntensity={2}
        wireframe
      />
    </mesh>
  );
}

const VolumetricLights = () => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.5;
        }
    })
    return (
        <group ref={groupRef}>
            <spotLight
                position={[20, 20, 20]}
                angle={0.3}
                penumbra={0.5}
                intensity={500}
                color="#00f3ff"
                castShadow
            />
             <spotLight
                position={[-20, 20, -20]}
                angle={0.3}
                penumbra={0.5}
                intensity={500}
                color="#ff00ff"
                castShadow
            />
        </group>
    )
}

const LightPulse = ({ position, color, intensity }: { position: [number, number, number], color: string, intensity: number }) => {
    const lightRef = useRef<THREE.PointLight>(null);
    useFrame(() => {
        if(lightRef.current) {
            const boost = audioController.getAverageFrequency() / 255;
            lightRef.current.intensity = intensity * (1 + boost * 5);
        }
    });
    return <pointLight ref={lightRef} position={position} color={color} distance={40} decay={2} />;
}

import { EffectComposer, Bloom, Glitch, ChromaticAberration } from '@react-three/postprocessing';
import { GlitchMode } from 'postprocessing';
import HoloAvatar from './HoloAvatar';

interface ArenaProps {
  currentTurn: 'player' | 'opponent';
}

const CyberArena: React.FC<ArenaProps> = ({ currentTurn }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  useFrame((state) => {
    if (cameraRef.current) {
        const avgFreq = audioController.getAverageFrequency();
        const boost = avgFreq / 255;
        // Subtle camera pulse on kick frequencies
        cameraRef.current.position.z = 22 - (boost * 0.5);
        cameraRef.current.fov = 60 + (boost * 2);
        cameraRef.current.updateProjectionMatrix();
    }
  });

  return (
    <div className="w-full h-full absolute top-0 left-0 z-0">
      <Canvas shadows>
        <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 8, 22]} fov={60} />
        <fog attach="fog" args={['#050505', 5, 50]} />
        <ambientLight intensity={0.2} />
        
        <VolumetricLights />
        <ReactiveFloor />
        
        <LightPulse position={[-15, 5, -10]} color="#00f3ff" intensity={50} />
        <LightPulse position={[15, 5, -10]} color="#ff00ff" intensity={50} />
        <LightPulse position={[0, 15, -20]} color="#fcee0a" intensity={30} />
        
        <HologramPillar position={[-8, 0, -8]} color="#00f3ff" />
        <HologramPillar position={[8, 0, -8]} color="#ff00ff" />
        <HologramPillar position={[0, 0, -18]} color="#ffffff" />

        {/* Characters */}
        <HoloAvatar 
            position={[-5, 1.25, -2]} 
            rotation={[0, 0.4, 0]} 
            imageUrl="/avatars/human.png" 
            isActive={currentTurn === 'player'}
            color="#00f3ff"
        />
        <HoloAvatar 
            position={[5, 1.25, -2]} 
            rotation={[0, -0.4, 0]} 
            imageUrl="/avatars/shogun.png" 
            isActive={currentTurn === 'opponent'}
            color="#ff00ff"
        />

        <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={2} />
        <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 2.2} />

        <EffectComposer>
            <Bloom 
                intensity={1.5} 
                luminanceThreshold={0.1} 
                mipmapBlur 
            />
            <ChromaticAberration 
                offset={new THREE.Vector2(0.002, 0.002)} 
            />
            <Glitch
                delay={new THREE.Vector2(1.5, 3.5)}
                duration={new THREE.Vector2(0.1, 0.3)}
                strength={new THREE.Vector2(0.3, 1.0)}
                mode={GlitchMode.SPORADIC}
                active
                ratio={0.85}
            />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default CyberArena;