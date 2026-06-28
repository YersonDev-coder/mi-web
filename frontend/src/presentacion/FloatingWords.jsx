import { useMemo } from 'react'
import { motion } from 'framer-motion'

const WORDS = [
  { text: 'Automatización', size: 2.4,  x: 12,  y: 15,  color: '#00f5ff', opacity: 0.85, dur: 14 },
  { text: 'CEPLAN',         size: 1.2,  x: 72,  y: 8,   color: '#a855f7', opacity: 0.70, dur: 11 },
  { text: 'Procesos',       size: 1.9,  x: 55,  y: 22,  color: '#00ff88', opacity: 0.75, dur: 17 },
  { text: 'Dashboard',      size: 1.0,  x: 5,   y: 45,  color: '#f472b6', opacity: 0.60, dur: 9  },
  { text: 'KPI',            size: 3.5,  x: 38,  y: 35,  color: '#00f5ff', opacity: 0.12, dur: 20 },
  { text: 'Analytics',      size: 1.3,  x: 78,  y: 42,  color: '#00f5ff', opacity: 0.65, dur: 13 },
  { text: 'Indicadores',    size: 1.6,  x: 18,  y: 65,  color: '#a855f7', opacity: 0.72, dur: 16 },
  { text: 'Gestión',        size: 1.1,  x: 60,  y: 58,  color: '#00ff88', opacity: 0.58, dur: 10 },
  { text: 'IoT',            size: 2.8,  x: 85,  y: 18,  color: '#a855f7', opacity: 0.10, dur: 22 },
  { text: 'Big Data',       size: 1.4,  x: 30,  y: 80,  color: '#00f5ff', opacity: 0.68, dur: 15 },
  { text: 'Optimización',   size: 1.0,  x: 70,  y: 72,  color: '#f472b6', opacity: 0.55, dur: 12 },
  { text: 'Workflow',       size: 1.2,  x: 8,   y: 82,  color: '#00ff88', opacity: 0.62, dur: 18 },
  { text: 'Métricas',       size: 1.0,  x: 48,  y: 88,  color: '#a855f7', opacity: 0.60, dur: 11 },
  { text: 'Control',        size: 1.5,  x: 88,  y: 60,  color: '#f472b6', opacity: 0.68, dur: 14 },
  { text: 'Monitoreo',      size: 1.1,  x: 42,  y: 5,   color: '#00ff88', opacity: 0.55, dur: 9  },
  { text: 'Eficiencia',     size: 1.0,  x: 25,  y: 50,  color: '#00f5ff', opacity: 0.58, dur: 16 },
  { text: 'IA',             size: 4.0,  x: 2,   y: 25,  color: '#a855f7', opacity: 0.07, dur: 25 },
  { text: 'Auditoría',      size: 1.0,  x: 62,  y: 92,  color: '#00f5ff', opacity: 0.50, dur: 13 },
  { text: 'Reporting',      size: 1.2,  x: 82,  y: 85,  color: '#f472b6', opacity: 0.60, dur: 17 },
]

/* Cada palabra flota en dirección y velocidad aleatoria */
function floatKeyframes(seed) {
  const amp = 12 + (seed % 5) * 4
  return {
    y: [`0px`, `${-amp}px`, `${amp * 0.4}px`, `${-amp * 0.6}px`, `0px`],
    x: [`0px`, `${amp * 0.3}px`, `${-amp * 0.5}px`, `${amp * 0.2}px`, `0px`],
    rotate: [0, (seed % 3) - 1, -(seed % 2), (seed % 2) - 1, 0],
  }
}

/* Dirección de entrada aleatoria basada en posición */
function entryFrom(x, y) {
  if (x < 30) return { x: -120, y: 0, opacity: 0, scale: 0.7 }
  if (x > 70) return { x:  120, y: 0, opacity: 0, scale: 0.7 }
  if (y < 30) return { x: 0, y: -100, opacity: 0, scale: 0.7 }
  return { x: 0, y: 100, opacity: 0, scale: 0.7 }
}

export default function FloatingWords() {
  const words = useMemo(() => WORDS, [])

  return (
    <div className="pres-words-wrap">
      {/* Texto central decorativo */}
      <motion.div
        className="pres-words-center"
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}
      >
        <p className="pres-words-center-label">Tecnologías del Sistema</p>
        <h2 className="pres-words-center-title">
          Digitalización<br />de <span>Procesos</span>
        </h2>
        <p className="pres-words-center-sub">
          Ingeniería · Datos · Control · Automatización
        </p>
      </motion.div>

      {words.map((w, i) => (
        <motion.span
          key={i}
          className="pres-word"
          style={{
            left:     `${w.x}%`,
            top:      `${w.y}%`,
            fontSize: `${w.size}rem`,
            color:    w.color,
            opacity:  w.opacity,
          }}
          initial={entryFrom(w.x, w.y)}
          whileInView={{ x: 0, y: 0, opacity: w.opacity, scale: 1 }}
          viewport={{ once: false, amount: 0 }}
          transition={{ duration: 0.9, delay: i * 0.04, ease: [0.22,1,0.36,1] }}
          animate={floatKeyframes(i)}
        >
          {w.text}
        </motion.span>
      ))}
    </div>
  )
}
