import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import s from "./Perfil.module.css";

const BASE = "http://localhost:8000/api";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("sgp_token") || ""}`,
});

export default function PerfilView() {
  const { usuario, login, logout } = useAuth();
  const navigate = useNavigate();

  const iniciales = (usuario?.nombre_completo || usuario?.username || "U")
    .split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  /* ── Datos básicos ─────────────────────────── */
  const [form, setForm] = useState({
    nombre_completo: usuario?.nombre_completo || "",
    email:           usuario?.email           || "",
    organizacion:    usuario?.organizacion    || "",
  });
  const [msgDatos,  setMsgDatos]  = useState("");
  const [errDatos,  setErrDatos]  = useState("");
  const [guardando, setGuardando] = useState(false);

  /* ── Contraseña ────────────────────────────── */
  const [abrirPass, setAbrirPass] = useState(false);
  const [pass, setPass]           = useState({ actual: "", nueva: "", confirmar: "" });
  const [verPass, setVerPass]     = useState(false);
  const [msgPass,  setMsgPass]    = useState("");
  const [errPass,  setErrPass]    = useState("");
  const [cambPass, setCambPass]   = useState(false);

  /* ── Eliminar cuenta ───────────────────────── */
  const [abrirElim,  setAbrirElim]  = useState(false);
  const [passElim,   setPassElim]   = useState("");
  const [errElim,    setErrElim]    = useState("");
  const [eliminando, setEliminando] = useState(false);

  /* ── Guardar datos ─────────────────────────── */
  const guardarDatos = async (e) => {
    e.preventDefault();
    setErrDatos(""); setMsgDatos("");
    if (!form.email?.includes("@")) { setErrDatos("Correo inválido."); return; }
    setGuardando(true);
    try {
      const res  = await fetch(`${BASE}/auth/perfil/`, { method: "PUT", headers: hdrs(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setErrDatos(data.error || "Error al guardar."); return; }
      login({
        token:   localStorage.getItem("sgp_token"),
        refresh: localStorage.getItem("sgp_refresh"),
        usuario: data.usuario,
      });
      setMsgDatos("Datos actualizados correctamente.");
    } catch { setErrDatos("No se pudo conectar."); }
    finally  { setGuardando(false); }
  };

  /* ── Cambiar contraseña ────────────────────── */
  const guardarPass = async (e) => {
    e.preventDefault();
    setErrPass(""); setMsgPass("");
    if (!pass.actual || !pass.nueva || !pass.confirmar) { setErrPass("Completa todos los campos."); return; }
    if (pass.nueva !== pass.confirmar) { setErrPass("Las contraseñas no coinciden."); return; }
    setCambPass(true);
    try {
      const res  = await fetch(`${BASE}/auth/cambiar-password/`, {
        method: "PUT", headers: hdrs(),
        body: JSON.stringify({ password_actual: pass.actual, password_nueva: pass.nueva, confirmacion: pass.confirmar }),
      });
      const data = await res.json();
      if (!res.ok) { setErrPass(data.error || "Error."); return; }
      localStorage.setItem("sgp_token",   data.token);
      localStorage.setItem("sgp_refresh", data.refresh);
      setMsgPass("Contraseña actualizada correctamente.");
      setPass({ actual: "", nueva: "", confirmar: "" });
      setAbrirPass(false);
    } catch { setErrPass("No se pudo conectar."); }
    finally  { setCambPass(false); }
  };

  /* ── Eliminar cuenta ───────────────────────── */
  const eliminarCuenta = async () => {
    if (!passElim) { setErrElim("Ingresa tu contraseña para confirmar."); return; }
    setEliminando(true); setErrElim("");
    try {
      const res  = await fetch(`${BASE}/auth/cuenta/`, { method: "DELETE", headers: hdrs(), body: JSON.stringify({ password: passElim }) });
      const data = await res.json();
      if (!res.ok) { setErrElim(data.error || "Error."); setEliminando(false); return; }
      logout();
      navigate("/login", { replace: true });
    } catch { setErrElim("No se pudo conectar."); setEliminando(false); }
  };

  return (
    <div className={s.pagina}>

      {/* ── Hero ──────────────────────────────── */}
      <div className={s.hero}>
        <div className={s.avatar}>{iniciales}</div>
        <div className={s.heroInfo}>
          <div className={s.heroNombre}>{usuario?.nombre_completo || usuario?.username}</div>
          <div className={s.heroUser}>@{usuario?.username}</div>
          <span className={s.heroBadge}>
            {usuario?.rol === "superadmin" ? "Superadministrador" : "Administrador"}
          </span>
        </div>
      </div>

      {/* ── Datos básicos ──────────────────────── */}
      <div className={s.card}>
        <div className={s.cardHeader} style={{ cursor: "default" }}>
          <div className={s.cardHeaderIzq}>
            <div className={s.cardHeaderIcono}>👤</div>
            <span className={s.cardHeaderTitulo}>Información personal</span>
          </div>
        </div>
        <form className={s.cardBody} onSubmit={guardarDatos}>
          {errDatos && <div className={`${s.alerta} ${s.alertaError}`}>{errDatos}</div>}
          {msgDatos && <div className={`${s.alerta} ${s.alertaOk}`}>✅ {msgDatos}</div>}

          <div className={s.campo}>
            <label className={s.label}>Nombre completo</label>
            <input className={s.input} type="text" value={form.nombre_completo}
              onChange={e => setForm({ ...form, nombre_completo: e.target.value })}
              placeholder="Tu nombre completo" />
          </div>

          <div className={s.campo}>
            <label className={s.label}>Correo electrónico</label>
            <input className={s.input} type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="correo@empresa.com" />
          </div>

          <div className={s.campo}>
            <label className={s.label}>Organización</label>
            <input className={s.input} type="text" value={form.organizacion}
              onChange={e => setForm({ ...form, organizacion: e.target.value })}
              placeholder="Empresa o institución" />
          </div>

          <button className={`${s.btn} ${s.btnPrimario}`} type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>

      {/* ── Cambiar contraseña ─────────────────── */}
      <div className={s.card}>
        <div className={s.cardHeader} onClick={() => { setAbrirPass(v => !v); setMsgPass(""); setErrPass(""); }}>
          <div className={s.cardHeaderIzq}>
            <div className={s.cardHeaderIcono}>🔒</div>
            <span className={s.cardHeaderTitulo}>Cambiar contraseña</span>
          </div>
          <span className={`${s.cardChevron} ${abrirPass ? s.cardChevronOpen : ""}`}>▼</span>
        </div>

        {abrirPass && (
          <form className={s.cardBody} onSubmit={guardarPass}>
            {errPass && <div className={`${s.alerta} ${s.alertaError}`}>{errPass}</div>}
            {msgPass && <div className={`${s.alerta} ${s.alertaOk}`}>✅ {msgPass}</div>}

            <div className={s.campo}>
              <label className={s.label}>Contraseña actual</label>
              <input className={s.input} type="password" value={pass.actual}
                onChange={e => setPass({ ...pass, actual: e.target.value })} placeholder="••••••••" />
            </div>

            <div className={s.campo}>
              <label className={s.label}>Nueva contraseña</label>
              <div className={s.inputWrap}>
                <input className={s.input} type={verPass ? "text" : "password"} value={pass.nueva}
                  onChange={e => setPass({ ...pass, nueva: e.target.value })}
                  placeholder="Mínimo 8 caracteres" style={{ paddingRight: "2.5rem" }} />
                <button type="button" className={s.ojo} onClick={() => setVerPass(v => !v)} tabIndex={-1}>
                  {verPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div className={s.campo}>
              <label className={s.label}>Confirmar nueva contraseña</label>
              <input
                className={`${s.input} ${pass.confirmar && pass.nueva !== pass.confirmar ? s.inputError : ""}`}
                type={verPass ? "text" : "password"} value={pass.confirmar}
                onChange={e => setPass({ ...pass, confirmar: e.target.value })}
                placeholder="Repite la contraseña" />
            </div>

            <div className={s.fila}>
              <button className={`${s.btn} ${s.btnPrimario}`} type="submit" disabled={cambPass} style={{ flex: 1 }}>
                {cambPass ? "Actualizando…" : "Actualizar contraseña"}
              </button>
              <button className={`${s.btn} ${s.btnGris}`} type="button"
                onClick={() => { setAbrirPass(false); setPass({ actual: "", nueva: "", confirmar: "" }); }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Zona de peligro ────────────────────── */}
      <div className={s.zonaPeligro}>
        <p className={s.zonaTitulo}>⚠ Zona de peligro</p>

        {!abrirElim ? (
          <>
            <p className={s.zonaDesc}>
              Eliminar tu cuenta es permanente e irreversible. Se perderá el acceso al sistema.
            </p>
            <button className={`${s.btn} ${s.btnPeligro}`}
              style={{ fontSize: ".85rem" }} onClick={() => setAbrirElim(true)}>
              Eliminar mi cuenta
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
            <div className={`${s.alerta} ${s.alertaInfo}`}>
              Ingresa tu contraseña para confirmar. Esta acción <strong>no se puede deshacer</strong>.
            </div>
            {errElim && <div className={`${s.alerta} ${s.alertaError}`}>{errElim}</div>}
            <div className={s.campo}>
              <label className={s.label}>Tu contraseña actual</label>
              <input className={s.input} type="password" value={passElim}
                onChange={e => setPassElim(e.target.value)} placeholder="Confirma tu contraseña" />
            </div>
            <div className={s.fila}>
              <button className={`${s.btn} ${s.btnPeligro}`} style={{ flex: 1 }}
                onClick={eliminarCuenta} disabled={eliminando}>
                {eliminando ? "Eliminando…" : "Confirmar eliminación"}
              </button>
              <button className={`${s.btn} ${s.btnGris}`}
                onClick={() => { setAbrirElim(false); setPassElim(""); setErrElim(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
