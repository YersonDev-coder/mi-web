import { useRef, useEffect } from 'react'

const COLORS = ['#00f5ff', '#a855f7', '#00ff88', '#f472b6']
const CONN_DIST = 160
const COUNT = 60

export default function NetworkParticles() {
  const canvasRef = useRef()
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    const particles = Array.from({ length: COUNT }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      vx:  (Math.random() - 0.5) * 0.6,
      vy:  (Math.random() - 0.5) * 0.6,
      r:   1 + Math.random() * 2.5,
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse repulsion
        const dxm = p.x - mx
        const dym = p.y - my
        const dm  = Math.sqrt(dxm * dxm + dym * dym)
        if (dm < 110 && dm > 0) {
          const f = ((110 - dm) / 110) * 2.5
          p.vx += (dxm / dm) * f
          p.vy += (dym / dm) * f
        }

        // Speed cap + dampen
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > 3.5) { p.vx = (p.vx / spd) * 3.5; p.vy = (p.vy / spd) * 3.5 }
        p.vx *= 0.985; p.vy *= 0.985

        p.x += p.vx; p.y += p.vy

        // Wrap
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width)  p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Connections
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < CONN_DIST) {
            const a = (1 - d / CONN_DIST) * 0.45
            ctx.strokeStyle = `rgba(0,245,255,${a})`
            ctx.lineWidth = (1 - d / CONN_DIST) * 1.2
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }

        // Mouse connection highlight
        if (dm < 180) {
          const a = (1 - dm / 180) * 0.7
          ctx.strokeStyle = `rgba(0,245,255,${a})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(mx, my)
          ctx.stroke()
        }

        // Draw dot
        ctx.shadowBlur = 10
        ctx.shadowColor = p.col
        ctx.fillStyle = p.col
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      animId = requestAnimationFrame(draw)
    }

    function onMouse(e) { mouseRef.current = { x: e.clientX, y: e.clientY } }
    function onLeave()  { mouseRef.current = { x: -9999, y: -9999 } }

    window.addEventListener('mousemove', onMouse)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pres-network" />
}
