import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { audioController } from '../services/audioService';

interface HoloAvatarProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  imageUrl: string;
  isActive: boolean;
  color: string;
}

const HoloAvatar: React.FC<HoloAvatarProps> = ({ position, rotation = [0, 0, 0], imageUrl, isActive, color }) => {
  const meshRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Load texture
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  // Custom Shader for Holo Effect
  const holoShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: texture },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0 },
      uGlitch: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Subtle floating motion
        pos.y += sin(uTime * 2.0) * 0.05;
        
        // Audio reactive expansion
        pos *= 1.0 + (uIntensity * 0.1);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uGlitch;

      void main() {
        vec2 uv = vUv;
        
        // Scanlines effect
        float scanline = sin(uv.y * 200.0 + uTime * 10.0) * 0.1;
        
        // Glitch offset
        if (uGlitch > 0.5) {
          uv.x += sin(uTime * 50.0) * 0.02;
        }

        vec4 texColor = texture2D(uTexture, uv);
        
        // Apply holo color tint and intensity
        vec3 finalColor = mix(texColor.rgb, uColor, 0.3);
        finalColor += uColor * scanline;
        
        // Glow effect
        float alpha = texColor.a * (0.8 + uIntensity * 0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  }), [texture, color]);

  useFrame((state) => {
    if (materialRef.current) {
      const data = audioController.getAudioData();
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const intensity = avg / 255;

      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uIntensity.value = intensity;
      
      // Glitch chance based on intensity and activity
      materialRef.current.uniforms.uGlitch.value = (intensity > 0.4 || (!isActive && intensity > 0.1)) ? 1 : 0;
    }

    if (meshRef.current) {
        // Slow rotation
        meshRef.current.rotation.y = rotation[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={meshRef} position={position} rotation={rotation}>
      {/* Main Avatar Plane */}
      <mesh>
        <planeGeometry args={[2, 2.5]} />
        <shaderMaterial ref={materialRef} attach="material" {...holoShader} />
      </mesh>

      {/* Glow Backing */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[2.2, 2.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>

      {/* Floor Projection */}
      <mesh position={[0, -1.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

export default HoloAvatar;
