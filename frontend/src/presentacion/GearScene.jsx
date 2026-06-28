import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Environment } from '@react-three/drei'
import * as THREE from 'three'

/* ══════════════════════════════════════════════════════
   GEOMETRÍA DEL ENGRANAJE
══════════════════════════════════════════════════════ */
function buildGearGeo(teeth, outerR, depth) {
  const innerR = outerR * 0.70
  const da     = (Math.PI * 2) / teeth
  const tHalf  = da * 0.37
  const shape  = new THREE.Shape()
  shape.moveTo(innerR, 0)
  for (let i = 0; i < teeth; i++) {
    const a  = i * da
    const a1 = (i + 1) * da
    shape.lineTo(Math.cos(a - tHalf) * innerR, Math.sin(a - tHalf) * innerR)
    shape.lineTo(Math.cos(a - tHalf) * outerR, Math.sin(a - tHalf) * outerR)
    shape.lineTo(Math.cos(a - tHalf * 0.3) * (outerR * 1.022), Math.sin(a - tHalf * 0.3) * (outerR * 1.022))
    shape.lineTo(Math.cos(a + tHalf * 0.3) * (outerR * 1.022), Math.sin(a + tHalf * 0.3) * (outerR * 1.022))
    shape.lineTo(Math.cos(a + tHalf) * outerR, Math.sin(a + tHalf) * outerR)
    shape.lineTo(Math.cos(a + tHalf) * innerR, Math.sin(a + tHalf) * innerR)
    for (let s = 1; s <= 4; s++) {
      const va = (a + tHalf) + ((a1 - tHalf - (a + tHalf)) * s / 4)
      shape.lineTo(Math.cos(va) * innerR, Math.sin(va) * innerR)
    }
  }
  shape.closePath()
  const hc = new THREE.Path(); hc.absarc(0, 0, innerR * 0.18, 0, Math.PI * 2, true); shape.holes.push(hc)
  const boltR = innerR * 0.52
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2; const b = new THREE.Path()
    b.absarc(Math.cos(a) * boltR, Math.sin(a) * boltR, innerR * 0.065, 0, Math.PI * 2, true)
    shape.holes.push(b)
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.16, bevelSize: depth * 0.12, bevelSegments: 6 })
}

/* ── Material acero visible ── */
function useSteelMat(emissive) {
  return useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a4a60'), metalness: 0.88, roughness: 0.14,
    emissive: new THREE.Color(emissive), emissiveIntensity: 0.55, envMapIntensity: 2.4,
  }), [emissive])
}

/* ── Brazos / radios ── */
function Spokes({ r, gearDepth }) {
  const innerR = r * 0.70; const hubR = innerR * 0.22
  const midR = (hubR + innerR * 0.82) / 2; const spokeL = innerR * 0.82 - hubR; const thick = gearDepth * 0.30
  return (
    <group>
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * midR, Math.sin(a) * midR, gearDepth + thick / 2]} rotation={[0, 0, a]}>
            <boxGeometry args={[spokeL, r * 0.065, thick]} />
            <meshStandardMaterial color="#1a3044" metalness={0.96} roughness={0.08} emissive="#0055aa" emissiveIntensity={0.70} envMapIntensity={3} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ── Hub central ── */
function Hub({ r }) {
  const innerR = r * 0.70
  const geo = useMemo(() => {
    const s = new THREE.Shape(); s.absarc(0, 0, innerR * 0.28, 0, Math.PI * 2, false)
    const h = new THREE.Path(); h.absarc(0, 0, innerR * 0.17, 0, Math.PI * 2, true); s.holes.push(h)
    return new THREE.ExtrudeGeometry(s, { depth: r * 0.045, bevelEnabled: false })
  }, [innerR, r])
  return (
    <mesh geometry={geo} position={[0, 0, r * 0.17 + 0.01]}>
      <meshStandardMaterial color="#0a1825" metalness={1} roughness={0.02} emissive="#00aaff" emissiveIntensity={1.5} envMapIntensity={4.5} />
    </mesh>
  )
}

/* ── Bordes luminosos ── */
function GearEdges({ geo, color }) {
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geo, 14), [geo])
  const mat      = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.80 }), [color])
  useEffect(() => () => { edgesGeo.dispose(); mat.dispose() }, [edgesGeo, mat])
  const obj = useMemo(() => new THREE.LineSegments(edgesGeo, mat), [edgesGeo, mat])
  return <primitive object={obj} />
}

/* ── Engranaje ── */
function Gear({ teeth, r, speed, position, emissive, edgeColor }) {
  const ref = useRef(); const depth = r * 0.17
  const geo = useMemo(() => buildGearGeo(teeth, r, depth), [teeth, r, depth])
  const mat = useSteelMat(emissive)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * speed })
  return (
    <group ref={ref} position={position}>
      <mesh geometry={geo} material={mat} />
      <GearEdges geo={geo} color={edgeColor} />
      <Spokes r={r} gearDepth={depth} />
      <Hub r={r} />
    </group>
  )
}

/* ══════════════════════════════════════════════════════
   PARTÍCULAS CÓSMICAS
══════════════════════════════════════════════════════ */
function CosmosParticles() {
  const ref = useRef()
  const geo = useMemo(() => {
    const COUNT = 600
    const pos   = new Float32Array(COUNT * 3)
    const col   = new Float32Array(COUNT * 3)
    // Paleta de colores del universo
    const PALETTE = [
      [0.9, 0.95, 1.0],   // blanco-azul
      [1.0, 0.85, 0.25],  // dorado
      [0.2, 0.85, 1.0],   // cian
      [0.85, 0.3,  1.0],  // violeta
      [1.0, 0.55, 0.15],  // naranja
      [0.4, 1.0,  0.7],   // verde-cian
    ]
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 45
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3))
    return g
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.012
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.08
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.14} vertexColors transparent opacity={0.88}
        sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </points>
  )
}

/* ── Nebulosas de fondo ── */
function Nebula({ position, color, radius, opacity }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 14, 10]} />
      <meshBasicMaterial
        color={color} transparent opacity={opacity}
        side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </mesh>
  )
}

/* ── Cámara ── */
function CameraRig() {
  useFrame((state, dt) => {
    const { x, y } = state.mouse
    state.camera.position.x += (x * 0.7 - state.camera.position.x) * 0.022
    state.camera.position.y += (y * 0.4 - state.camera.position.y) * 0.022
    state.camera.lookAt(0.5, -0.3, 0)
  })
  return null
}

/* ══════════════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════════════ */
export default function GearScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 55 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
      dpr={[1, 2]}
      style={{ position: 'absolute', inset: 0, zIndex: 1 }}
    >
      <Environment preset="city" background={false} />

      {/* Iluminación */}
      <ambientLight intensity={0.12} color="#102040" />
      <pointLight position={[ 10, 13,  7]} intensity={200} color="#00ccff" distance={45} decay={2} />
      <pointLight position={[-9,  -8,  4]} intensity={100} color="#aa00ff" distance={32} decay={2} />
      <pointLight position={[  0,   2, -6]} intensity={70}  color="#ff8800" distance={25} decay={2} />
      <pointLight position={[  6,  -2,  8]} intensity={50}  color="#ffd700" distance={20} decay={2} />
      <directionalLight position={[5, 4, 6]} intensity={2.2} color="#bbddff" />

      {/* ── Universo ── */}
      {/* Estrellas finas de fondo */}
      <Stars radius={200} depth={100} count={12000} factor={5} saturation={0.4} fade speed={0.15} />
      {/* Segunda capa de estrellas más brillantes */}
      <Stars radius={80}  depth={50}  count={3000}  factor={3} saturation={0.8} fade speed={0.4} />

      {/* Nebulosas */}
      <Nebula position={[-25, 12, -35]} color="#5500bb" radius={28} opacity={0.05} />
      <Nebula position={[ 20, -10,-28]} color="#0033cc" radius={22} opacity={0.06} />
      <Nebula position={[  0,   0,-50]} color="#cc6600" radius={35} opacity={0.03} />
      <Nebula position={[-12,-18,-22]} color="#006688" radius={20} opacity={0.07} />
      <Nebula position={[ 18,  16,-30]} color="#880044" radius={25} opacity={0.04} />

      {/* Partículas cósmicas de colores */}
      <CosmosParticles />

      {/* ── Engranajes ── */}
      <Gear teeth={20} r={5.6} speed={ 0.014} position={[ 5.8,-4.6,-0.8]} emissive="#003a5a" edgeColor="#00ccff" />
      <Gear teeth={13} r={3.4} speed={-0.022} position={[-4.8, 3.8,-2.2]} emissive="#220040" edgeColor="#cc00ff" />
      <Gear teeth={ 9} r={1.9} speed={ 0.048} position={[ 7.0, 1.6, 0.3]} emissive="#003055" edgeColor="#ffd700" />

      <CameraRig />
    </Canvas>
  )
}
