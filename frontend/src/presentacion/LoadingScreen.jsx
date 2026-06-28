import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import escudo from './EP_sistemas.png'

const MESSAGES = [
  'Inicializando módulos…',
  'Cargando indicadores…',
  'Procesando datos…',
  'Sistema listo',
]

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [msgIdx,   setMsgIdx]   = useState(0)

  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  useEffect(() => {
    const DURATION = 2800
    const TICK     = 22
    const steps    = DURATION / TICK
    let current    = 0
    const id = setInterval(() => {
      current += 100 / steps
      const p = Math.min(Math.floor(current), 100)
      setProgress(p)
      setMsgIdx(Math.min(Math.floor(p / 25), MESSAGES.length - 1))
      if (p >= 100) {
        clearInterval(id)
        setTimeout(() => onCompleteRef.current(), 520)
      }
    }, TICK)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      className="pres-loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.65, ease: 'easeInOut' }}
    >
      <div className="pres-ld-bg-glow" />

      {/* Escudo libre, sin círculo */}
      <motion.img
        src={escudo}
        alt="Escudo EP Sistemas"
        className="pres-ld-shield"
        initial={{ opacity: 0, scale: 0.82, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}
      />

      {/* Porcentaje */}
      <div className="pres-ld-pct-wrap">
        <span className="pres-ld-pct">{progress}</span>
        <span className="pres-ld-pct-sym">%</span>
      </div>

      {/* Barra de progreso */}
      <div className="pres-ld-track">
        <motion.div
          className="pres-ld-fill"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.04, ease: 'linear' }}
        />
        <motion.div
          className="pres-ld-dot"
          animate={{ left: `${progress}%` }}
          transition={{ duration: 0.04, ease: 'linear' }}
        />
      </div>

      {/* Mensaje */}
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          className="pres-ld-label"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
        >
          {MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}
