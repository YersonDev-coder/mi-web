import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import s from "./auth.module.css";

const BASE = "http://localhost:8000/api";

export default function RegisterView() {
  const [form, setForm] = useState({
    username: "", email: "", password: "", password2: "",
    nombre_completo: "", organizacion: "",
  });
  const [error,    setError]    = useState("");
  const [exito,    setExito]    = useState("");
  const [cargando, setCargando] = useState(false);
  const [verPass,  setVerPass]  = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError(""); setExito("");
    if (!form.username || !form.email || !form.password || !form.password2) {
      setError("Completa todos los campos obligatorios (*).");
      return;
    }
    if (form.password !== form.password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const res  = await fetch(`${BASE}/auth/registro/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar la solicitud.");
        return;
      }
      setExito("✅ Solicitud enviada correctamente. El administrador recibirá una notificación y aprobará tu acceso. Recibirás un correo de confirmación.");
      setForm({ username: "", email: "", password: "", password2: "", nombre_completo: "", organizacion: "" });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className={s.pagina}>
      <div className={s.tarjeta} style={{ maxWidth: 460 }}>

        <div className={s.cabecera}>
          <div className={s.logoWrap}>
            <img src={logo} alt="Logo" className={s.logoImg} />
          </div>
          <span className={s.appNombre}>Sistema de Gestión de Procesos</span>
        </div>

        <h1 className={s.titulo}>Solicitar acceso</h1>
        <p className={s.subtitulo}>El administrador aprobará tu solicitud</p>

        {exito ? (
          <>
            <div className={`${s.alerta} ${s.alertaExito}`} style={{ fontSize: ".88rem", lineHeight: 1.7 }}>
              {exito}
            </div>

            <div style={{ marginTop: "1.2rem", padding: "1rem", background: "rgba(0,245,255,.04)", border: "1px solid rgba(0,245,255,.1)", borderRadius: "12px", textAlign: "center" }}>
              <p style={{ color: "#475569", fontSize: ".78rem", marginBottom: ".8rem" }}>
                ¿No recibes respuesta? Escríbeme directamente
              </p>
              <a
                href="https://wa.me/51957258943?text=Hola%2C+hice+una+solicitud+de+acceso+al+Sistema+de+Gesti%C3%B3n+de+Procesos+y+no+he+recibido+respuesta."
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: ".5rem",
                  background: "#25d366", color: "#fff", fontWeight: 700,
                  fontSize: ".88rem", padding: ".65rem 1.3rem", borderRadius: "10px",
                  textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,.35)"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar por WhatsApp
              </a>
            </div>

            <div className={s.pieEnlace} style={{ marginTop: "1.2rem" }}>
              <Link to="/login">← Volver al inicio de sesión</Link>
            </div>
          </>
        ) : (
          <form className={s.formulario} onSubmit={enviar}>
            {error && <div className={`${s.alerta} ${s.alertaError}`}>{error}</div>}

            <div className={s.campo}>
              <label className={s.label}>Nombre de usuario *</label>
              <input className={s.input} type="text" name="username"
                value={form.username} onChange={cambiar}
                placeholder="Sin espacios, mínimo 3 caracteres" autoFocus />
            </div>

            <div className={s.campo}>
              <label className={s.label}>Correo electrónico *</label>
              <input className={s.input} type="email" name="email"
                value={form.email} onChange={cambiar}
                placeholder="correo@empresa.com" />
            </div>

            <div className={s.campo}>
              <label className={s.label}>Nombre completo</label>
              <input className={s.input} type="text" name="nombre_completo"
                value={form.nombre_completo} onChange={cambiar}
                placeholder="Opcional" />
            </div>

            <div className={s.campo}>
              <label className={s.label}>Organización</label>
              <input className={s.input} type="text" name="organizacion"
                value={form.organizacion} onChange={cambiar}
                placeholder="Empresa o institución" />
            </div>

            <div className={s.campo}>
              <label className={s.label}>Rol</label>
              <select className={s.select} value="admin" disabled>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className={s.campo}>
              <label className={s.label}>Contraseña *</label>
              <div className={s.inputWrap}>
                <input
                  className={`${s.input} ${s.conIcono}`}
                  type={verPass ? "text" : "password"}
                  name="password" value={form.password} onChange={cambiar}
                  placeholder="Mínimo 8 caracteres" />
                <button type="button" className={s.ojo}
                  onClick={() => setVerPass(v => !v)} tabIndex={-1}>
                  {verPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div className={s.campo}>
              <label className={s.label}>Confirmar contraseña *</label>
              <input
                className={`${s.input} ${form.password2 && form.password !== form.password2 ? s.inputError : ""}`}
                type={verPass ? "text" : "password"}
                name="password2" value={form.password2} onChange={cambiar}
                placeholder="Repite la contraseña" />
            </div>

            <button className={s.boton} type="submit" disabled={cargando}>
              {cargando ? "Enviando solicitud…" : "Enviar solicitud de acceso"}
            </button>
          </form>
        )}

        {!exito && (
          <div className={s.pieEnlace}>
            ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
          </div>
        )}
      </div>
    </div>
  );
}
