import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const _modules = import.meta.glob(
  '../assets/presentacion/team/*.{png,jpg,jpeg,webp,svg}',
  { eager: true }
)
function getAvatar(basename) {
  for (const ext of ['png','jpg','jpeg','webp','svg']) {
    const m = _modules[`../assets/presentacion/team/${basename}.${ext}`]
    if (m) return m.default
  }
  return ''
}

const MEMBERS = [
  { basename:'yerson', num:'01', firstName:'Yerson',        lastName:'Rojas Vilca',        role:'Análisis y Req.',       accent:'#00f5ff' },
  { basename:'adali',  num:'02', firstName:'Adali',         lastName:'Sudario Justiniano', role:'Gestión de Calidad',    accent:'#f472b6' },
  { basename:'jhony',  num:'03', firstName:'Jhony Emanuel', lastName:'Ramos Ticse',        role:'Diseño y Arquitectura', accent:'#a3e635' },
  { basename:'carlos', num:'04', firstName:'Carlos',        lastName:'Gomez Aguirre',      role:'Desarrollo de SW',      accent:'#a855f7' },
  { basename:'mark',   num:'05', firstName:'Mark Jhunior',  lastName:'Chavez Fabian',      role:'Despliegue y QA',       accent:'#ff6b35' },
]

const ENTRIES = [
  { x:-280, y:0,    rotateY:-70, rotateX:0,   scale:.65, delay:0.00 },
  { x:0,    y:-200, rotateY:0,   rotateX: 55, scale:.72, delay:0.14 },
  { x:0,    y:0,    rotateY:0,   rotateX:0,   scale:.08, delay:0.28 },
  { x:280,  y:0,    rotateY: 70, rotateX:0,   scale:.65, delay:0.42 },
  { x:0,    y:200,  rotateY:0,   rotateX:-55, scale:.72, delay:0.56 },
]

/* ── Carousel para móvil ──────────────────────────────────────── */
function CarouselMobil() {
  const [actual, setActual]     = useState(0)
  const [dir,    setDir]        = useState(1)
  const touchX                  = useRef(null)

  const ir = (siguiente) => {
    setDir(siguiente > actual ? 1 : -1)
    setActual(siguiente)
  }
  const prev = () => actual > 0 && ir(actual - 1)
  const next = () => actual < MEMBERS.length - 1 && ir(actual + 1)

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (dx >  50) prev()
    if (dx < -50) next()
    touchX.current = null
  }

  const m = MEMBERS[actual]

  return (
    <div className="ptm-root">

      {/* Aurora del integrante actual */}
      <div className="ptm-aurora" style={{ '--acc': m.accent }} />

      {/* Título */}
      <div className="ptm-header">
        <h2 className="ptm-title">Equipo de <span>Trabajo</span></h2>
      </div>

      {/* Contador */}
      <p className="ptm-counter">{actual + 1} &nbsp;/&nbsp; {MEMBERS.length}</p>

      {/* Tarjeta animada */}
      <div className="ptm-card-area"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={actual}
            className="ptm-card"
            style={{ '--acc': m.accent }}
            custom={dir}
            initial   ={{ opacity:0, x: dir * 60 }}
            animate   ={{ opacity:1, x: 0 }}
            exit      ={{ opacity:0, x: dir * -60 }}
            transition={{ duration:.32, ease:[0.22,1,0.36,1] }}
          >
            {/* Número decorativo de fondo */}
            <span className="ptm-num-bg">{m.num}</span>

            {/* Foto */}
            <div className="ptm-photo-wrap">
              <div className="ptm-photo-ring" />
              <div className="ptm-photo-inner">
                {getAvatar(m.basename)
                  ? <img src={getAvatar(m.basename)} alt={`${m.firstName} ${m.lastName}`} />
                  : <div className="ptm-placeholder">👤</div>
                }
              </div>
            </div>

            {/* Texto */}
            <p className="ptm-seq">{m.num}</p>
            <h3 className="ptm-nombre">
              <span className="ptm-first">{m.firstName}</span>
              <span className="ptm-last">{m.lastName}</span>
            </h3>
            <div className="ptm-badge" style={{ borderColor: m.accent, color: m.accent }}>
              <span className="ptm-badge-dot" />
              {m.role}
            </div>

            {/* Borde superior luminoso */}
            <div className="ptm-top-bar" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navegación: ← puntos → */}
      <div className="ptm-nav">
        <button className="ptm-btn" onClick={prev} disabled={actual === 0}>‹</button>

        <div className="ptm-dots">
          {MEMBERS.map((_, i) => (
            <button
              key={i}
              className={`ptm-dot ${i === actual ? 'ptm-dot--on' : ''}`}
              style={i === actual ? { background: m.accent, boxShadow: `0 0 8px ${m.accent}` } : {}}
              onClick={() => ir(i)}
            />
          ))}
        </div>

        <button className="ptm-btn" onClick={next} disabled={actual === MEMBERS.length - 1}>›</button>
      </div>
    </div>
  )
}

/* ── Vista escritorio (original) ──────────────────────────────── */
function GridEscritorio() {
  return (
    <>
      <div className="pres-team-aurora" aria-hidden>
        {MEMBERS.map(m => (
          <div key={m.basename} className="pres-ta-blob" style={{ '--acc': m.accent }} />
        ))}
      </div>

      <motion.div
        className="pres-team-header"
        initial={{ opacity:0, y:45 }}
        whileInView={{ opacity:1, y:0 }}
        viewport={{ once:false, amount:0.4 }}
        transition={{ duration:0.75, ease:[0.22,1,0.36,1] }}
      >
        <h2 className="pres-team-title">Equipo de <span>Trabajo</span></h2>
      </motion.div>

      <div className="pres-team-grid">
        {MEMBERS.map((m, i) => {
          const e = ENTRIES[i]
          const isCenter = i === 2
          return (
            <motion.div
              key={m.basename}
              className="pres-member-card"
              style={{ '--acc': m.accent, '--delay': `${i * 0.55}s` }}
              initial={{
                opacity:0, x:e.x, y:e.y,
                rotateY:e.rotateY, rotateX:e.rotateX, scale:e.scale,
                ...(isCenter ? { filter:'blur(28px)' } : {}),
              }}
              whileInView={{
                opacity:1, x:0, y:0, rotateY:0, rotateX:0, scale:1,
                ...(isCenter ? { filter:'blur(0px)' } : {}),
              }}
              viewport={{ once:false, amount:0.15 }}
              transition={{ duration:0.95, delay:e.delay, ease:[0.22,1,0.36,1] }}
              whileHover={{ scale:1.08, y:-18, rotateY:5, transition:{ duration:.30 } }}
            >
              <div className="pres-card-scan" />
              <div className="pres-card-num-bg">{m.num}</div>
              <div className="pres-photo-wrap">
                <div className="pres-photo-glow" />
                <div className="pres-photo-ring">
                  <div className="pres-photo-ring-border" />
                  <div className="pres-photo-ring-pulse" />
                  <div className="pres-photo-ring-pulse pres-photo-ring-pulse--2" />
                  <div className="pres-photo-inner">
                    {getAvatar(m.basename)
                      ? <img src={getAvatar(m.basename)} alt={`${m.firstName} ${m.lastName}`} />
                      : <div className="pres-photo-placeholder">👤</div>
                    }
                  </div>
                </div>
              </div>
              <div className="pres-card-body">
                <p className="pres-member-seq">{m.num}</p>
                <h3 className="pres-member-name">
                  <span className="pres-name-first">{m.firstName}</span>
                  <span className="pres-name-last">{m.lastName}</span>
                </h3>
                <div className="pres-member-role-badge">
                  <span className="pres-role-dot" />{m.role}
                </div>
              </div>
              <div className="pres-card-accent-bar" />
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

/* ── Componente principal ─────────────────────────────────────── */
export default function TeamSection() {
  const [mobil, setMobil] = useState(false)

  useEffect(() => {
    const check = () => setMobil(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return mobil ? <CarouselMobil /> : <GridEscritorio />
}
