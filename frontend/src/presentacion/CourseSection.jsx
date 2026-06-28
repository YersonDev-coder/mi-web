import { motion } from 'framer-motion'

const up = (d = 0) => ({
  hidden:  { opacity: 0, y: 38 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, delay: d, ease: [0.22,1,0.36,1] } },
})

export default function CourseSection() {
  return (
    <motion.div
      className="pres-course-card"
      initial={{ opacity: 0, y: 70, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}
    >
      <motion.div
        className="pres-course-tag"
        variants={up(0.1)} initial="hidden"
        whileInView="visible" viewport={{ once: false, amount: 0.3 }}
      >
        <span className="pres-tag-dot" />
        Ingeniería de Sistemas · UNHEVAL
      </motion.div>

      <motion.h2
        className="pres-course-title"
        variants={up(0.2)} initial="hidden"
        whileInView="visible" viewport={{ once: false, amount: 0.3 }}
      >
        Ingeniería de <em>Procesos</em>
      </motion.h2>

      <motion.p
        className="pres-course-univ"
        variants={up(0.3)} initial="hidden"
        whileInView="visible" viewport={{ once: false, amount: 0.3 }}
      >
        Universidad Nacional Hermilio Valdizán — Huánuco, Perú
      </motion.p>

      <motion.div
        className="pres-course-sep"
        initial={{ scaleX: 0, originX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      />

      <motion.div
        variants={up(0.5)} initial="hidden"
        whileInView="visible" viewport={{ once: false, amount: 0.3 }}
      >
        <p className="pres-docente-label">Docente a cargo</p>
        <p className="pres-docente-name">Dra. Heidy Velsy Rivera Vidal de Sánchez</p>
      </motion.div>
    </motion.div>
  )
}
