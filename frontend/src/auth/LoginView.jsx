import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";
import s from "./auth.module.css";

const BASE = "http://localhost:8000/api";

export default function LoginView() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]         = useState({ usuario: "", contrasena: "" });
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass, setVerPass]   = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.usuario || !form.contrasena) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }
    setCargando(true);
    try {
      const res  = await fetch(`${BASE}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.usuario, password: form.contrasena }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Credenciales incorrectas."); return; }
      login(data);
      navigate("/procesos", { replace: true });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className={s.pagina}>
      <div className={s.tarjeta}>

        {/* Logo + nombre */}
        <div className={s.cabecera}>
          <div className={s.logoWrap}>
            <img src={logo} alt="Logo" className={s.logoImg} />
          </div>
          <span className={s.appNombre}>Sistema de Gestión de Procesos</span>
        </div>

        <form className={s.formulario} onSubmit={enviar}>
          {error && <div className={`${s.alerta} ${s.alertaError}`}>{error}</div>}

          <div className={s.campo}>
            <label className={s.label}>Usuario o correo</label>
            <input
              className={s.input}
              type="text"
              name="usuario"
              value={form.usuario}
              onChange={cambiar}
              placeholder="Tu nombre de usuario o correo"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className={s.campo}>
            <label className={s.label}>Contraseña</label>
            <div className={s.inputWrap}>
              <input
                className={`${s.input} ${s.conIcono}`}
                type={verPass ? "text" : "password"}
                name="contrasena"
                value={form.contrasena}
                onChange={cambiar}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className={s.ojo}
                onClick={() => setVerPass(v => !v)}
                tabIndex={-1}
              >
                {verPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button className={s.boton} type="submit" disabled={cargando}>
            {cargando ? "Verificando…" : "Ingresar al sistema"}
          </button>
        </form>

        <div className={s.pieEnlace}>
          ¿No tienes cuenta? <Link to="/registro">Solicitar acceso</Link>
        </div>

        <div style={{ marginTop: "1.4rem", textAlign: "center", borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: "1.2rem" }}>
          <a
            href="https://wa.me/51957258943?text=Hola%2C+necesito+ayuda+con+el+Sistema+de+Gesti%C3%B3n+de+Procesos."
            target="_blank"
            rel="noreferrer"
            title="Contactar soporte por WhatsApp"
            style={{
              display: "inline-flex", alignItems: "center", gap: ".45rem",
              color: "#25d366", fontSize: ".78rem", textDecoration: "none",
              opacity: .75, transition: "opacity .2s"
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = .75}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            ¿Problemas para ingresar? Contáctanos
          </a>
        </div>

      </div>
    </div>
  );
}
