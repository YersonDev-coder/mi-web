import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CYL_R  = 0.92
const BALL_R = 0.28
const BALL_Y = 1.20   // bola encima del cilindro
const PH = { IDLE:0, FALL:1, EXIT:2, DONE:3 }

function CylScene({ active, onComplete, onCylClick }) {
  const phase  = useRef(PH.IDLE)
  const ballVY = useRef(0)
  const exitT  = useRef(0)
  const ballRef = useRef()
  const ballLt  = useRef()

  useEffect(() => {
    if (active) { ballVY.current = 0; phase.current = PH.FALL }
  }, [active])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime

    if (phase.current === PH.IDLE) {
      const by = BALL_Y + Math.sin(t * 1.1) * 0.045
      if (ballRef.current) {
        ballRef.current.position.y = by
        ballRef.current.material.emissiveIntensity = 0.65 + Math.sin(t * 2) * 0.18
      }
      if (ballLt.current) ballLt.current.position.y = by
    }

    if (phase.current === PH.FALL) {
      ballVY.current += 5.8 * dt
      const by = (ballRef.current?.position.y ?? BALL_Y) - ballVY.current * dt
      if (ballRef.current) ballRef.current.position.y = by
      if (ballLt.current)  ballLt.current.position.y = by
      if (by <= -0.82) { phase.current = PH.EXIT; exitT.current = 0 }
    }

    if (phase.current === PH.EXIT) {
      exitT.current += dt
      const sc = Math.max(1 - exitT.current / 0.40, 0)
      if (ballRef.current) {
        ballRef.current.scale.setScalar(sc)
        ballRef.current.position.y = -0.82 - exitT.current * 0.5
      }
      if (ballLt.current) ballLt.current.intensity = sc * 8
      if (exitT.current >= 0.42 && phase.current !== PH.DONE) {
        phase.current = PH.DONE
        setTimeout(onComplete, 350)
      }
    }
  })

  return (
    <>
      {/* Luces */}
      <ambientLight intensity={0.20} color="#0a1530" />
      <pointLight position={[0,  5,  3]} intensity={50}  color="#4488ff" distance={14} decay={2} />
      <pointLight position={[-2, 2,  2]} intensity={22}  color="#7744ff" distance={10} decay={2} />
      <pointLight position={[2,  1,  2]} intensity={15}  color="#0055ff" distance={8}  decay={2} />

      {/* ── PEDESTAL ── */}
      <mesh position={[0,-1.24,0]}>
        <cylinderGeometry args={[1.28, 1.44, 0.18, 64]} />
        <meshStandardMaterial color="#06101f" metalness={.78} roughness={.26} />
      </mesh>
      <mesh position={[0,-1.15,0]}>
        <torusGeometry args={[1.28, .013, 8, 64]} />
        <meshStandardMaterial color="#2233aa" emissive="#1122aa" emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[0,-1.08,0]}>
        <cylinderGeometry args={[1.06, 1.20, 0.14, 64]} />
        <meshStandardMaterial color="#080f1e" metalness={.72} roughness={.30} />
      </mesh>
      <mesh position={[0,-1.01,0]}>
        <torusGeometry args={[1.06, .012, 8, 64]} />
        <meshStandardMaterial color="#3355dd" emissive="#2244cc" emissiveIntensity={1.2} />
      </mesh>
      {/* Glow suelo */}
      <mesh position={[0,-1.25,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[1.6, 48]} />
        <meshBasicMaterial color="#1133cc" transparent opacity={.09}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* ── CILINDRO — solo 2 aros, SIN paredes ── */}
      {/* Hitbox invisible para click */}
      <mesh onClick={onCylClick}>
        <cylinderGeometry args={[CYL_R, CYL_R, 2.0, 32, 1, true]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Aro inferior violeta */}
      <mesh position={[0,-1.01, 0]}>
        <torusGeometry args={[CYL_R, .018, 10, 80]} />
        <meshStandardMaterial color="#8844ff" emissive="#7733ff" emissiveIntensity={1.4} />
      </mesh>

      {/* ── SUELO INTERIOR ── */}
      <mesh position={[0,-0.995,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[CYL_R*.93, 48]} />
        <meshStandardMaterial color="#080e1c" metalness={.55} roughness={.45} />
      </mesh>

      {/* ── ANILLO DRENAJE ── */}
      <mesh position={[0,-0.997,0]}>
        <torusGeometry args={[.14, .018, 8, 32]} />
        <meshStandardMaterial color="#44aaff" emissive="#33aaff" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0,-0.997,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[.07, 24]} />
        <meshStandardMaterial color="#66ccff" emissive="#55ccff" emissiveIntensity={3.0} />
      </mesh>
      <mesh position={[0,-0.993,0]} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[.28, 32]} />
        <meshBasicMaterial color="#2288ff" transparent opacity={.13}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* ── BOLA (encima del cilindro) ── */}
      <mesh ref={ballRef} position={[0, BALL_Y, 0]}>
        <sphereGeometry args={[BALL_R, 52, 52]} />
        <meshStandardMaterial
          color="#ff8800" metalness={.96} roughness={.04}
          emissive="#ff5500" emissiveIntensity={.68}
        />
      </mesh>
      <pointLight ref={ballLt} position={[0, BALL_Y, 0]}
        intensity={8} color="#ff7700" distance={2.0} decay={2} />
    </>
  )
}

export default function CTAScene({ triggered, onComplete }) {
  const [internalActive, setInternalActive] = useState(false)
  const active = triggered || internalActive

  return (
    <Canvas
      camera={{ position:[0, 0, 4.5], fov:44 }}
      gl={{ antialias:true, alpha:true,
            toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.40 }}
      dpr={[1,2]}
      style={{ width:'100%', height:'100%', cursor:'pointer', background:'transparent' }}
    >
      <CylScene
        active={active}
        onComplete={onComplete}
        onCylClick={() => { if (!active) setInternalActive(true) }}
      />
    </Canvas>
  )
}
