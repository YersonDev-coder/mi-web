import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import LoadingScreen    from './LoadingScreen'
import GearScene        from './GearScene'
import TeamSection      from './TeamSection'
import NetworkParticles from './NetworkParticles'
import CTAScene         from './CTAScene'
import './presentacion.css'

/* Título dividido en 2 filas */
const ROW1 = ['Sistema', 'de', 'Gestión']
const ROW2 = ['de', 'Procesos']

const fade = (delay = 0) => ({
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, delay } },
})

function TitleRow({ words, startDelay }) {
  return (
    <div className="pres-title-row">
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="pres-title-word"
          initial={{ opacity: 0, y: 60, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: startDelay + i * 0.13, ease: [0.22,1,0.36,1] }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

export default function PresentacionView() {
  const [loadingDone, setLoadingDone] = useState(false)
  const [ctaTriggered, setCtaTriggered] = useState(false)
  const [flash, setFlash]               = useState(false)
  const navigate = useNavigate()
  const rootRef  = useRef(null)

  const handleEnter = () => {
    setFlash(true)
    setTimeout(() => navigate('/login'), 650)
  }

  return (
    <div className="pres-root" ref={rootRef}>

      <NetworkParticles />

      {/* ══════════════════════════════════════════
          SLIDE 01 · HERO — Engranajes + Texto
      ══════════════════════════════════════════ */}
      <section className="pres-slide pres-hero">

        <GearScene />
        <div className="pres-hero-overlay" />
        <div className="pres-scan-line" style={{ zIndex: 3 }} />

        <div className="pres-hero-content" style={{ zIndex: 10 }}>

          {/* Universidad */}
          <motion.div
            className="pres-univ-row"
            initial={{ opacity: 0, y: -32 }}
            animate={{ opacity: loadingDone ? 1 : 0, y: loadingDone ? 0 : -32 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.22,1,0.36,1] }}
          >
            <span className="pres-univ-line" />
            <span className="pres-univ-text">Universidad Nacional Hermilio Valdizán</span>
            <span className="pres-univ-line" />
          </motion.div>

          {/* Título en 2 filas con efecto 3D */}
          {loadingDone && (
            <h1 className="pres-main-title">
              <TitleRow words={ROW1} startDelay={0.45} />
              <TitleRow words={ROW2} startDelay={0.92} />
            </h1>
          )}

          {/* Separador dorado */}
          <motion.div
            className="pres-hero-sep"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: loadingDone ? 1 : 0 }}
            transition={{ duration: 0.9, delay: 1.5, ease: [0.22,1,0.36,1] }}
          />

          {/* Docente */}
          <motion.div
            className="pres-docente-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loadingDone ? 1 : 0, y: loadingDone ? 0 : 20 }}
            transition={{ duration: 0.75, delay: 1.8 }}
          >
            <span className="pres-docente-hero-label">Docente a cargo</span>
            <span className="pres-docente-hero-name">
              Dra. Heidy Velsy Rivera Vidal de Sánchez
            </span>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            className="pres-scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: loadingDone ? 0.55 : 0 }}
            transition={{ duration: 0.6, delay: 2.3 }}
          >
            <span>Explorar</span>
            <div className="pres-scroll-arrow" />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SLIDE 02 · EQUIPO
      ══════════════════════════════════════════ */}
      <section className="pres-slide pres-team-slide">
        <TeamSection />
      </section>

      {/* ══════════════════════════════════════════
          SLIDE 03 · CTA — Cilindro 3D
      ══════════════════════════════════════════ */}
      <section className="pres-slide pres-cta-slide">
        <div className="pres-cta-inner">

          {/* Título */}
          <motion.h2
            className="pres-cta-title"
            initial={{ opacity: 0, y: -28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.75, ease: [0.22,1,0.36,1] }}
          >
            ¿Listo para comenzar?
          </motion.h2>

          {/* Escena 3D del cilindro */}
          <motion.div
            className="pres-cta-scene-wrap"
            initial={{ opacity: 0, scale: 0.88 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <CTAScene triggered={ctaTriggered} onComplete={handleEnter} />
          </motion.div>

          {/* Botón estilo neón */}
          <motion.button
            className="pres-cta-btn"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.7, delay: 0.45 }}
            onClick={() => setCtaTriggered(true)}
            disabled={ctaTriggered}
          >
            <span className="pres-cta-btn-arrow">→</span>
            <span>Ingresar al Sistema</span>
          </motion.button>

        </div>
      </section>

      {/* Flash de transición al entrar al sistema */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            className="pres-cta-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!loadingDone && (
          <LoadingScreen key="loading" onComplete={() => setLoadingDone(true)} />
        )}
      </AnimatePresence>
    </div>
  )
}
