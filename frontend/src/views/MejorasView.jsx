// Módulo Ficha de Mejora de Proceso: árbol + ficha con evaluación dinámica por consecuencia.
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { obtenerArbolMej, obtenerCatalogos, obtenerMejora, guardarMejora, eliminarMejora, obtenerEstadosProceso, obtenerResultadosMejora } from "../services/api";
import "./MejorasView.css";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];

export default function MejorasView() {
  const location = useLocation();
  const [tipo, setTipo] = useState("Misional");
  const [arbol, setArbol] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [procesoSel, setProcesoSel] = useState(null);
  const [cat, setCat] = useState(null);
  const [f, setF] = useState(null); // ficha de mejora (estado completo)
  const [estadosProceso, setEstadosProceso] = useState({});
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [vistaPanel, setVistaPanel] = useState("ficha");
  const [vistaGlobal, setVistaGlobal] = useState("mejoras");
  const saveTimerRef  = useRef(null);
  const lastSavedRef  = useRef(null);   // referencia al objeto f ya guardado
  const procesoSelRef = useRef(null);   // para leer procesoSel dentro del timer

  useEffect(() => { obtenerCatalogos().then(setCat); }, []);
  useEffect(() => { obtenerEstadosProceso().then(setEstadosProceso); }, []);
  useEffect(() => { cargarArbol(); /* eslint-disable-next-line */ }, [tipo]);

  // Auto-seleccionar proceso si llegamos desde ReporteView con state.idProceso
  useEffect(() => {
    const idNav = location.state?.idProceso;
    if (!idNav) return;
    elegir({ id: idNav, tiene_mejora: true });   // puedeSeleccionar siempre pasa con tiene_mejora:true
  // eslint-disable-next-line
  }, [location.state]);

  const cargarArbol = () => obtenerArbolMej(tipo).then(setArbol);
  const alternar = (id) => setExpandidos((e) => ({ ...e, [id]: !e[id] }));

  // Un proceso es seleccionable si está marcado "mejorar" o ya tiene mejora guardada
  const puedeSeleccionar = (nodo) =>
    estadosProceso[String(nodo.id)] === "mejorar" || nodo.tiene_mejora;

  const elegir = useCallback(async (nodo) => {
    if (!puedeSeleccionar(nodo)) return;
    clearTimeout(saveTimerRef.current);   // cancelar guardado pendiente del proceso anterior
    lastSavedRef.current = null;
    setProcesoSel(nodo.id);
    let data = await obtenerMejora(nodo.id);
    if (data.probabilidad_automatica && data.evaluaciones_json?.length) {
      data.evaluaciones_json = data.evaluaciones_json.map((ev) => ({
        ...ev, probabilidad: data.probabilidad_automatica,
      }));
    }
    // Auto-crear inmediatamente si es registro nuevo
    if (!data.id_mejora) {
      data = await guardarMejora(nodo.id, data);
      cargarArbol();
    }
    lastSavedRef.current = data;   // marcar como ya guardado (sin cambios pendientes)
    setF(data);
  // eslint-disable-next-line
  }, [estadosProceso]);
  procesoSelRef.current = procesoSel;

  const set = (campo, valor) => setF((prev) => ({ ...prev, [campo]: valor }));

  // Auto-guardado: cada vez que f cambia, programar guardado con debounce 1.2 s
  useEffect(() => {
    if (!f || !procesoSel || !f.id_mejora) return;
    if (f === lastSavedRef.current) return;       // sin cambios reales
    clearTimeout(saveTimerRef.current);
    setGuardando(true);
    saveTimerRef.current = setTimeout(async () => {
      const pid = procesoSelRef.current;
      if (!pid) return;
      try {
        await guardarMejora(pid, f);
        lastSavedRef.current = f;
        cargarArbol();
      } finally {
        setGuardando(false);
      }
    }, 1200);
    // eslint-disable-next-line
  }, [f]);

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar toda la ficha de mejora de este proceso?")) return;
    await eliminarMejora(procesoSel);
    setF(null); setProcesoSel(null); cargarArbol();
    setMsg({ tipo: "ok", texto: "Mejora eliminada." });
    setTimeout(() => setMsg(null), 3000);
  };

  // Marca/desmarca una consecuencia (controla cuántos bloques de evaluación hay)
  // Agrega consecuencia Y fija nivel en un solo setF (sin condición de carrera)
  const agregarConsecuencia = (c, nivel) => {
    setF((prev) => {
      const prevM = prev.consecuencias_marcadas || [];
      const prevE = prev.evaluaciones_json || [];
      return {
        ...prev,
        consecuencias_marcadas: [...prevM, c],
        evaluaciones_json: [...prevE, {
          consecuencia: c,
          nivel_consecuencia: nivel,
          probabilidad: prev.probabilidad_automatica || "",
          tolerancia: "", estrategia: "",
          consecuencia_residual: "", probabilidad_residual: "",
        }],
      };
    });
  };

  const toggleConsecuencia = (c) => {
    const marcadas = f.consecuencias_marcadas || [];
    let nuevas, evals = f.evaluaciones_json || [];
    if (marcadas.includes(c)) {
      nuevas = marcadas.filter((x) => x !== c);
      evals = evals.filter((e) => e.consecuencia !== c);
    } else {
      nuevas = [...marcadas, c];
      // La probabilidad se auto-asigna desde el ATI calculado en backend
      evals = [...evals, {
        consecuencia: c, nivel_consecuencia: "",
        probabilidad: f.probabilidad_automatica || "",
        tolerancia: "", estrategia: "", consecuencia_residual: "", probabilidad_residual: "",
      }];
    }
    setF((prev) => ({ ...prev, consecuencias_marcadas: nuevas, evaluaciones_json: evals }));
  };

  const setEval = (consecuencia, campo, valor) => {
    const evals = (f.evaluaciones_json || []).map((e) =>
      e.consecuencia === consecuencia ? { ...e, [campo]: valor } : e);
    set("evaluaciones_json", evals);
  };

  const Nodo = ({ nodo }) => {
    const hijos = nodo.hijos && nodo.hijos.length > 0;
    const ab = expandidos[nodo.id];
    const enMejora = estadosProceso[String(nodo.id)] === "mejorar";
    const terminado = estadosProceso[String(nodo.id)] === "terminar";
    const seleccionable = puedeSeleccionar(nodo);
    return (
      <div>
        <div className={`mj-nodo-fila
          ${procesoSel === nodo.id ? "sel" : ""}
          ${enMejora ? "mj-en-mejora" : ""}
          ${terminado ? "mj-terminado" : ""}
          ${!seleccionable && !hijos ? "mj-congelado" : ""}`}>
          <span className="mj-toggle" onClick={() => hijos && alternar(nodo.id)}>
            {hijos ? (ab ? "▼" : "▶") : ""}
          </span>
          <span className={`mj-punto ${nodo.tiene_mejora ? "activo" : ""}`} />
          <span
            className="mj-nodo-nombre"
            style={{ cursor: seleccionable ? "pointer" : "default" }}
            onClick={() => elegir(nodo)}
          >
            {nodo.nombre}
            {enMejora && <span className="mj-badge-mejora">⚡ Mejora</span>}
            {terminado && <span className="mj-badge-terminar">✓ Terminado</span>}
          </span>
        </div>
        {hijos && ab && (
          <div className="mj-hijos">{nodo.hijos.map((h) => <Nodo key={h.id} nodo={h} />)}</div>
        )}
      </div>
    );
  };

  const claseImportancia = f && f.importancia === "Alta" ? "mj-alta" : f && f.importancia === "Media" ? "mj-media" : "mj-baja";

  return (
    <div className="mj-vista">
      <div className="mj-cabecera">
        <div>
          <h2>Ficha de Mejora del Proceso</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="mj-tabs">
            {TIPOS.map((t) => (
              <button key={t} className={`mj-tab ${vistaGlobal === "mejoras" && tipo === t ? "activo" : ""}`}
                onClick={() => { setVistaGlobal("mejoras"); setTipo(t); setProcesoSel(null); setF(null); }}>{t}</button>
            ))}
          </div>
          <button
            className={`mj-tab mj-tab-resultados ${vistaGlobal === "resultados" ? "activo" : ""}`}
            onClick={() => { setVistaGlobal("resultados"); setProcesoSel(null); setF(null); }}>
            Resultados
          </button>
          {f && vistaGlobal === "mejoras" && (
            <span className={`mj-autoguard-ind ${guardando ? "guardando" : "ok"}`}>
              {guardando ? "⟳ Guardando..." : "✓ Guardado"}
            </span>
          )}
        </div>
      </div>

      {vistaGlobal === "resultados" ? (
        <ResultadosMejora />
      ) : null}

      <div className="mj-layout" style={{ display: vistaGlobal === "resultados" ? "none" : undefined }}>
        <aside className="mj-arbol">
          <div className="mj-arbol-titulo">Procesos {tipo}s</div>
          {arbol.length === 0 ? <p className="mj-vacio" style={{ padding: 12, border: "none" }}>No hay procesos.</p>
            : arbol.map((n) => <Nodo key={n.id} nodo={n} />)}
        </aside>

        <div className="mj-panel">
          {msg && <div className={`mj-msg mj-msg-${msg.tipo}`}>{msg.texto}</div>}
          {!f || !cat ? (
            <div className="mj-vacio">Selecciona un proceso del árbol para registrar su mejora.</div>
          ) : (
            <>
              {/* Switch Ficha / Cronograma */}
              <div className="mj-panel-tabs">
                <button
                  className={`mj-panel-tab ${vistaPanel === "ficha" ? "activo" : ""}`}
                  onClick={() => setVistaPanel("ficha")}>
                  Ficha de mejora
                </button>
                <button
                  className={`mj-panel-tab ${vistaPanel === "cronograma" ? "activo" : ""}`}
                  onClick={() => setVistaPanel("cronograma")}>
                  Cronograma
                </button>
              </div>

              {vistaPanel === "ficha" ? (
                <>
                  <DatosGenerales f={f} set={set} />
                  <Especificacion f={f} set={set} />
                  <GestionOportunidades f={f} set={set} cat={cat} claseImportancia={claseImportancia}
                    toggleConsecuencia={toggleConsecuencia} setEval={setEval}
                    agregarConsecuencia={agregarConsecuencia} />
                  <Acciones f={f} set={set} />
                  <CostoImpacto f={f} set={set} cat={cat} />
                  <PlazoEstado f={f} set={set} />
                  <TablaResumen f={f} />
                  <DescripcionMejora f={f} set={set} />
                </>
              ) : (
                <Cronograma f={f} set={set} />
              )}

              <section className="mj-seccion">
                <div className="mj-acciones-crud">
                  <div className="mj-acciones-izq">
                    <button className="mj-btn mj-btn-secundario"
                      onClick={() => { clearTimeout(saveTimerRef.current); setProcesoSel(null); setF(null); setVistaPanel("ficha"); }}>
                      ← Cerrar ficha
                    </button>
                  </div>
                  <button className="mj-btn mj-btn-borrar" onClick={eliminar}>
                    🗑 Eliminar mejora
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- 1. Datos generales ----------
function DatosGenerales({ f, set }) {
  const fechaFin = f.ind_fecha_fin || null;

  // Rango válido para la mejora:
  // inicio = primera semana donde el planificado del proceso llega al 100%
  // fin    = fecha fin del indicador
  const rangoIni = f.mejora_fecha_inicio_rango || f.ind_fecha_inicio || null;
  const rangoFin = f.mejora_fecha_fin_rango    || fechaFin;

  // Bloquear fechas si ya hay datos ingresados en el cronograma
  const tieneDatosCrono = (f.cronograma_json || []).some(
    (r) => r.planificado != null || r.logrado != null
  );

  const fmtLegible = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d} ${meses[+m - 1]} ${y}`;
  };

  return (
    <section className="mj-seccion">
      <h3>1. Datos Generales</h3>

      <div className="mj-grid">
        <label className="mj-campo"><span>Proyecto</span>
          <input value={f.proyecto || ""} onChange={(e) => set("proyecto", e.target.value)} />
        </label>
        <label className="mj-campo"><span>Código del Proyecto</span>
          <input value={f.codigo_proyecto || ""} onChange={(e) => set("codigo_proyecto", e.target.value)} />
        </label>
        <label className="mj-campo"><span>Proceso asociado (auto)</span>
          <input value={f.proceso_asociado || ""} disabled />
        </label>
        <label className="mj-campo"><span>Código del Proceso (auto)</span>
          <input value={f.codigo_proceso || ""} disabled />
        </label>
        <label className="mj-campo"><span>Inicio rango de mejora (auto)</span>
          <input value={rangoIni || ""} disabled className="mj-campo-ref"
            title="Primera semana donde el planificado del proceso llega al 100%" />
        </label>
        <label className="mj-campo"><span>Fin rango de mejora (auto)</span>
          <input value={rangoFin || ""} disabled className="mj-campo-ref"
            title="Fecha fin del indicador" />
        </label>
        <label className="mj-campo"><span>Responsable del proceso</span>
          <input value={f.responsable_proceso || ""} onChange={(e) => set("responsable_proceso", e.target.value)} />
        </label>
        <label className="mj-campo"><span>Responsable del proyecto</span>
          <input value={f.responsable_proyecto || ""} onChange={(e) => set("responsable_proyecto", e.target.value)} />
        </label>
        <label className="mj-campo">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Fecha de solicitud
            {tieneDatosCrono && <span title="Bloqueado: ya hay datos en el cronograma" style={{ fontSize: 13, color: "#F59E0B" }}>🔒</span>}
          </span>
          <input type="date"
            value={(f.fecha_solicitud || "").slice(0, 10)}
            min={rangoIni || undefined}
            max={rangoFin || undefined}
            disabled={tieneDatosCrono}
            onChange={(e) => set("fecha_solicitud", e.target.value)}
            style={tieneDatosCrono ? { background: "#F1F5F9", color: "#64748B", cursor: "not-allowed" } : {}} />
        </label>
        <label className="mj-campo">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Fecha requerida
            {tieneDatosCrono && <span title="Bloqueado: ya hay datos en el cronograma" style={{ fontSize: 13, color: "#F59E0B" }}>🔒</span>}
          </span>
          <input type="date"
            value={(f.fecha_requerida || "").slice(0, 10)}
            min={f.fecha_solicitud || rangoIni || undefined}
            max={rangoFin || undefined}
            disabled={tieneDatosCrono}
            onChange={(e) => set("fecha_requerida", e.target.value)}
            style={tieneDatosCrono ? { background: "#F1F5F9", color: "#64748B", cursor: "not-allowed" } : {}} />
        </label>
        {tieneDatosCrono && (
          <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "#92400E",
              background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "6px 10px" }}>
            Las fechas están bloqueadas porque ya hay datos registrados en el cronograma de mejora.
            Para modificarlas, primero borre todos los valores del cronograma.
          </p>
        )}
      </div>

    </section>
  );
}

// ---------- 2. Especificación de la mejora (3 combos en fila) ----------
function Especificacion({ f, set }) {
  return (
    <section className="mj-seccion">
      <h3>2. Especificación de la Mejora</h3>
      <div className="mj-grid-3">
        <label className="mj-campo"><span>Tipo de mejora</span>
          <select value={f.tipo_mejora || ""} onChange={(e) => set("tipo_mejora", e.target.value)}>
            <option value="">Seleccionar...</option><option>Mejora</option><option>Rediseño</option>
          </select>
        </label>
        <label className="mj-campo"><span>Importancia</span>
          <select value={f.importancia || ""} onChange={(e) => set("importancia", e.target.value)}>
            <option value="">Seleccionar...</option><option>Alta</option><option>Media</option><option>Baja</option>
          </select>
        </label>
        <label className="mj-campo"><span>Complejidad</span>
          <select value={f.complejidad || ""} onChange={(e) => set("complejidad", e.target.value)}>
            <option value="">Seleccionar...</option><option>Alta</option><option>Media</option><option>Baja</option>
          </select>
        </label>
      </div>
    </section>
  );
}

// ---------- 3. Gestión de oportunidades ----------
function GestionOportunidades({ f, set, cat, claseImportancia, toggleConsecuencia, setEval, agregarConsecuencia }) {
  const [activa, setActiva] = useState(null);
  const marcadas = f.consecuencias_marcadas || [];

  // Si la activa ya no está en marcadas, caer al primero disponible
  const consecuenciaActiva = marcadas.includes(activa) ? activa : (marcadas[0] || null);

  const _confVal = (raw) => (raw && typeof raw === "object" ? raw : { nivel: raw || "", texto: "" });

  const setConfianzaNivel = (consecuencia, criterio, nivel) => {
    const base = f.confianza_json || {};
    const actual = base[consecuencia] || {};
    const prev = _confVal(actual[criterio]);
    const finalNivel = prev.nivel === nivel ? "" : nivel;
    set("confianza_json", {
      ...base,
      [consecuencia]: { ...actual, [criterio]: { nivel: finalNivel, texto: prev.texto } },
    });
  };

  const setConfianzaTexto = (consecuencia, criterio, texto) => {
    const base = f.confianza_json || {};
    const actual = base[consecuencia] || {};
    const prev = _confVal(actual[criterio]);
    set("confianza_json", {
      ...base,
      [consecuencia]: { ...actual, [criterio]: { nivel: prev.nivel, texto } },
    });
  };

  return (
    <section className={`mj-seccion ${claseImportancia}`}>
      <h3>3. Gestión de Oportunidades</h3>
      <div className="mj-grid">
        <label className="mj-campo"><span>3.1 Tipo de oportunidad</span>
          <select value={f.tipo_oportunidad || ""} onChange={(e) => set("tipo_oportunidad", e.target.value)}>
            <option value="">Seleccionar...</option><option>Tecnologico</option><option>Organizacional</option><option>Operativo</option><option>Normativo</option>
          </select>
        </label>
        <label className="mj-campo"><span>3.2 Oportunidades identificadas</span>
          <input value={f.oportunidades_identificadas || ""} onChange={(e) => set("oportunidades_identificadas", e.target.value)} />
        </label>
      </div>

      <h4>3.3.1 Nivel de consecuencias</h4>
      <p className="mj-sub-hint">Marca una celda por columna que aplique. Puedes seleccionar varias consecuencias.</p>
      <table className="mj-tabla mj-matriz">
        <thead>
          <tr>
            <th>Nivel</th>
            {cat.consecuencias.map((c) => (
              <th key={c} className={marcadas.includes(c) ? "mj-col-activa" : ""}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cat.niveles_consecuencia.map((nivel) => (
            <tr key={nivel}>
              <td className="lbl">{nivel}</td>
              {cat.consecuencias.map((c) => {
                const marcada = marcadas.includes(c);
                const ev = (f.evaluaciones_json || []).find((e) => e.consecuencia === c);
                const sel = marcada && ev?.nivel_consecuencia === nivel;
                return (
                  <td key={c}
                    className={`mj-celda ${sel ? "mj-celda-sel" : ""} ${marcada && !sel ? "mj-col-marcada" : ""}`}
                    onClick={() => {
                      if (!marcada) { agregarConsecuencia(c, nivel); setActiva(c); }
                      else { setEval(c, "nivel_consecuencia", nivel); }
                    }} />

                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 3.3.2 Probabilidad de ocurrencia: siempre visible, automática ────── */}
      <Probabilidad332 cat={cat} probabilidad={f.probabilidad_automatica} avanceTipoI={f.avance_tipo_i_auto} />

      {/* Chips + quitar */}
      {marcadas.length > 0 && (
        <div className="mj-chips">
          {marcadas.map((c) => (
            <span key={c} className={`mj-chip ${c === consecuenciaActiva ? "activo" : ""}`}
              onClick={() => setActiva(c)}>
              {c}
              <span className="mj-chip-x" onClick={(e) => { e.stopPropagation(); toggleConsecuencia(c); }}>✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Combobox de navegación entre consecuencias */}
      {marcadas.length > 0 && (
        <div className="mj-nav-consecuencia">
          <span className="mj-nav-label">Ver detalle de consecuencia:</span>
          <select className="mj-nav-select"
            value={consecuenciaActiva || ""}
            onChange={(e) => setActiva(e.target.value)}>
            {marcadas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="mj-nav-info">{marcadas.indexOf(consecuenciaActiva) + 1} de {marcadas.length}</span>
        </div>
      )}

      {/* Bloque de evaluación (desde 3.3.3) solo para la consecuencia activa */}
      {(() => {
        const ev = (f.evaluaciones_json || []).find((e) => e.consecuencia === consecuenciaActiva);
        const conf = (f.confianza_json || {})[consecuenciaActiva] || {};
        return ev ? (
          <BloqueEvaluacion
            key={consecuenciaActiva}
            ev={ev} cat={cat} setEval={setEval} importancia={f.importancia}
            confianzaConf={conf}
            setConfianzaNivel={(criterio, nivel) => setConfianzaNivel(consecuenciaActiva, criterio, nivel)}
            setConfianzaTexto={(criterio, texto) => setConfianzaTexto(consecuenciaActiva, criterio, texto)}
          />
        ) : null;
      })()}
    </section>
  );
}

// ---------- 3.3.2 Probabilidad de ocurrencia – siempre visible, automática ----------
function Probabilidad332({ cat, probabilidad, avanceTipoI }) {
  return (
    <>
      <h4>
        3.3.2 Probabilidad de ocurrencia (Nivel de oportunidad)
        {probabilidad && (
          <span className="mj-badge-resultado" style={{ marginLeft: 10 }}>
            AUTOMÁTICO: {probabilidad.toUpperCase()}
          </span>
        )}
      </h4>
      <p className="mj-sub-hint">
        {avanceTipoI != null
          ? <>Nivel determinado automáticamente según el <strong>Avance Tipo I: {avanceTipoI}%</strong>.</>
          : "Sin datos de avance registrados para este proceso."}
      </p>
      <div style={{ padding: "0 20px 16px" }}>
        <table className="mj-tabla">
          <thead>
            <tr>
              <th>Nivel de probabilidad</th>
              <th>Intervalo de recurrencia</th>
            </tr>
          </thead>
          <tbody>
            {cat.niveles_probabilidad.map((p) => {
              const esAuto = probabilidad === p.nivel;
              return (
                <tr key={p.nivel} className={esAuto ? "mj-prob-fila-auto" : ""}>
                  <td className="lbl">{p.nivel}</td>
                  <td>{p.intervalo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Bloque 3.3.3 → 3.4.4 + 3.3.4 Confianza por consecuencia ----------
function BloqueEvaluacion({ ev, cat, setEval, importancia, confianzaConf = {}, setConfianzaNivel, setConfianzaTexto }) {
  const c = ev.consecuencia;
  const idxCons = cat.orden_matriz.indexOf(ev.nivel_consecuencia);
  const nivelOportunidad = (ev.probabilidad && idxCons >= 0) ? cat.matriz[ev.probabilidad]?.[idxCons] : null;
  const claseOp = (n) => n === "Bajo" ? "mj-op-bajo" : n === "Medio" ? "mj-op-medio" : n === "Alto" ? "mj-op-alto" : n === "Muy alto" ? "mj-op-muyalto" : "";
  const claseConf = (n) => n === "Baja confianza" ? "baja" : n === "Moderada confianza" ? "moderada" : "alta";

  // Extraer nivel y texto de cada criterio (soporta formato antiguo string o nuevo objeto)
  const _getNivel = (raw) => raw && typeof raw === "object" ? raw.nivel || "" : raw || "";
  const _getTexto = (raw) => raw && typeof raw === "object" ? raw.texto || "" : "";

  // Calcular confianza global (mínima de los 3 criterios = más conservadora)
  const ORDEN_CONF = { "Baja confianza": 1, "Moderada confianza": 2, "Alta confianza": 3 };
  const nivelGlobalNum = Math.min(
    ...cat.criterios_confianza.map((cr) => ORDEN_CONF[_getNivel(confianzaConf[cr])] || 3)
  );
  const confianzaGlobal = ["Baja confianza", "Moderada confianza", "Alta confianza"][nivelGlobalNum - 1];
  const matrizConf = confianzaGlobal === "Baja confianza" ? cat.matriz_baja
                   : confianzaGlobal === "Moderada confianza" ? cat.matriz_moderada
                   : cat.matriz_alta;

  return (
    <div className="mj-bloque">
      <div className="mj-bloque-titulo"><span className="mj-badge">{c}</span> Evaluación de la oportunidad</div>

      <h4>
        3.3.3 Matriz cualitativa de oportunidades
        {nivelOportunidad && (
          <span className="mj-chip activo" style={{ fontSize: 11, marginLeft: 8 }}>
            Resultado: {nivelOportunidad}
          </span>
        )}
      </h4>
      <p className="mj-sub" style={{ marginBottom: 6 }}>
        Haz clic en una celda de la fila <strong>resaltada</strong> ({ev.probabilidad || "sin probabilidad"}) para marcar el nivel de consecuencia.
      </p>
      <table className="mj-tabla mj-matriz mj-matriz-interactiva">
        <thead>
          <tr>
            <th>Prob. / Consecuencia</th>
            {cat.orden_matriz.map((o) => (
              <th key={o} className={ev.nivel_consecuencia === o ? "mj-col-activa" : ""}>{o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(cat.matriz).map((prob) => {
            const esFilaAuto = ev.probabilidad === prob;
            return (
              <tr key={prob} className={esFilaAuto ? "mj-matriz-fila-auto" : "mj-matriz-fila-inactiva"}>
                <td className="lbl mj-lbl-prob" style={esFilaAuto ? { fontWeight: 800, color: "#1D4ED8" } : {}}>
                  {prob}
                </td>
                {cat.matriz[prob].map((val, i) => {
                  const esInterseccion = esFilaAuto && cat.orden_matriz[i] === ev.nivel_consecuencia;
                  return (
                    <td key={i}
                      className={`${claseOp(val)} ${esInterseccion ? "mj-cel-interseccion" : ""}`}
                      title={esFilaAuto ? `Seleccionar: ${cat.orden_matriz[i]}` : ""}
                      style={{ cursor: esFilaAuto ? "pointer" : "default" }}
                      onClick={() => esFilaAuto && setEval(c, "nivel_consecuencia", cat.orden_matriz[i])}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>3.3.4 Elemento de Confianza
        {confianzaGlobal && (
          <span className={`mj-prob-auto-tag mj-conf-global-tag mj-conf-global-${claseConf(confianzaGlobal)}`}
            style={{ marginLeft: 10, fontSize: 10 }}>
            Global: {confianzaGlobal}
          </span>
        )}
      </h4>
      <p className="mj-sub" style={{ marginBottom: 6 }}>
        Haz clic en una celda para seleccionar el nivel y escribe los detalles en el campo de texto.
      </p>
      <table className="mj-tabla mj-conf-tabla">
        <thead>
          <tr>
            <th style={{ width: "22%" }}>Criterio</th>
            {cat.niveles_confianza.map((n) => (
              <th key={n} className={`mj-conf-th-${claseConf(n)}`}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cat.criterios_confianza.map((cr) => {
            const nivelSel = _getNivel(confianzaConf[cr]);
            const textoSel = _getTexto(confianzaConf[cr]);
            return (
              <tr key={cr}>
                <td className="lbl" style={{ verticalAlign: "top", paddingTop: 10 }}>{cr}</td>
                {cat.niveles_confianza.map((n) => {
                  const esSel = nivelSel === n;
                  return (
                    <td key={n}
                      className={`mj-conf-celda mj-conf-celda-v2 ${esSel ? claseConf(n) : ""}`}
                      onClick={() => setConfianzaNivel && setConfianzaNivel(cr, n)}>
                      <div className="mj-conf-sel-row">
                        {esSel ? <span className="mj-marca-icono">✓</span> : <span className="mj-conf-circulo" />}
                      </div>
                      {esSel && (
                        <textarea
                          className="mj-conf-texto"
                          rows={2}
                          placeholder="Describe el criterio..."
                          value={textoSel}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setConfianzaTexto && setConfianzaTexto(cr, e.target.value)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 3.4.1 Tolerancia – tarjetas estilo radio */}
      <h4 style={{ marginTop: 16 }}>3.4.1 Tolerancia (indicador)</h4>
      <p className="mj-sub-hint">Selecciona el nivel de tolerancia que mejor represente la postura frente al riesgo.</p>
      <div className="mj-tol-cards">
        {[
          { key: "Intolerante",            color: "#dc2626", desc: "No se tolera la exposición al riesgo." },
          { key: "Generalmente tolerante", color: "#d97706", desc: "Se aceptan ciertos niveles de riesgo controlado." },
          { key: "Tolerante",              color: "#16a34a", desc: "Se está dispuesto a asumir riesgos calculados." },
        ].map(({ key, color, desc }) => {
          const sel = ev.tolerancia === key;
          return (
            <div key={key} className={`mj-tol-card ${sel ? "mj-tol-card--sel" : ""}`}
              style={sel ? { borderColor: color, boxShadow: `0 0 0 2px ${color}33` } : {}}
              onClick={() => setEval(c, "tolerancia", sel ? "" : key)}>
              <span className="mj-tol-radio" style={sel ? { borderColor: color, background: color } : {}}>
                {sel && <span className="mj-tol-radio-dot" />}
              </span>
              <div>
                <div className="mj-tol-label" style={{ color }}>{key}</div>
                <div className="mj-tol-desc">{desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matriz de oportunidad ajustada por nivel de confianza */}

      {matrizConf && cat.criterios_confianza.some((cr) => _getNivel(confianzaConf[cr])) && (
        <div className="mj-conf-matriz-bloque">
          <div className={`mj-conf-matriz-titulo mj-conf-global-${claseConf(confianzaGlobal)}`}>
            Evaluación de oportunidad — Nivel de confianza: <strong>{confianzaGlobal}</strong>
          </div>
          <table className="mj-tabla mj-matriz mj-matriz-interactiva">
            <thead>
              <tr>
                <th>Prob. / Consecuencia</th>
                {cat.orden_matriz.map((o) => (
                  <th key={o} className={ev.nivel_consecuencia === o ? "mj-col-activa" : ""}>{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(matrizConf).map((prob) => {
                const esFilaAuto = ev.probabilidad === prob;
                return (
                  <tr key={prob} className={esFilaAuto ? "mj-matriz-fila-auto" : "mj-matriz-fila-inactiva"}>
                    <td className="lbl mj-lbl-prob" style={esFilaAuto ? { fontWeight: 800, color: "#1D4ED8" } : {}}>
                      {prob}
                    </td>
                    {matrizConf[prob].map((val, i) => {
                      const esInterseccion = esFilaAuto && cat.orden_matriz[i] === ev.nivel_consecuencia;
                      return (
                        <td key={i}
                          className={`${claseOp(val)} ${esInterseccion ? "mj-cel-interseccion" : ""}`}
                          >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ marginTop: 14 }}>3.4.2 Estrategia de tratamiento</h4>
      <p className="mj-sub-hint">Describe la estrategia de tratamiento que aplicarás para gestionar el riesgo identificado.</p>
      <textarea className="mj-area-limpia" rows="3" value={ev.estrategia || ""}
        onChange={(e) => setEval(c, "estrategia", e.target.value)} placeholder="Escribe aquí tu estrategia de tratamiento..." />

      <h4>3.4.3 Consecuencia residual</h4>
      <p className="mj-sub-hint">Indica el nivel de consecuencia que esperas después de aplicar los controles y la estrategia definida.</p>
      <table className="mj-tabla mj-matriz">
        <thead><tr><th>Nivel</th><th>{c}</th></tr></thead>
        <tbody>
          {cat.niveles_consecuencia.map((nivel) => {
            const sel = ev.consecuencia_residual === nivel;
            return (
              <tr key={nivel} className={`mj-fila-sel-simple ${sel ? "mj-fila-sel-activa" : ""}`}
                onClick={() => setEval(c, "consecuencia_residual", nivel)}>
                <td className="lbl" style={sel ? { color: "#1D4ED8", fontWeight: 800 } : {}}>{nivel}</td>
                <td style={{ textAlign: "center", color: sel ? "#1D4ED8" : "#94A3B8", fontWeight: sel ? 700 : 400 }}>
                  {sel ? "Seleccionado" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>3.4.4 Probabilidad residual</h4>
      <p className="mj-sub-hint">Estima la probabilidad de que el riesgo ocurra después de aplicar la estrategia.</p>
      <table className="mj-tabla">
        <thead><tr><th>Nivel</th><th>Intervalo</th><th>Sel.</th></tr></thead>
        <tbody>
          {cat.niveles_probabilidad.map((p) => {
            const sel = ev.probabilidad_residual === p.nivel;
            return (
              <tr key={p.nivel} className={`mj-fila-sel-simple ${sel ? "mj-fila-sel-activa" : ""}`}
                onClick={() => setEval(c, "probabilidad_residual", p.nivel)}>
                <td className="lbl" style={sel ? { color: "#1D4ED8", fontWeight: 800 } : {}}>{p.nivel}</td>
                <td>{p.intervalo}</td>
                <td style={{ textAlign: "center", color: sel ? "#1D4ED8" : "#94A3B8", fontWeight: sel ? 700 : 400 }}>
                  {sel ? "Seleccionado" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- 3.5 Acciones ----------
function Acciones({ f, set }) {
  const acc = f.acciones_json || [];
  const cambiar = (i, v) => { const n = [...acc]; n[i] = v; set("acciones_json", n); };
  const agregar = () => set("acciones_json", [...acc, ""]);
  const borrar  = (i) => set("acciones_json", acc.filter((_, k) => k !== i));
  return (
    <section className="mj-seccion">
      <h3>3.5 Acciones para abordar la oportunidad</h3>
      <div className="mj-acc-lista">
        {acc.length === 0 && (
          <p className="mj-sub-hint" style={{ marginTop: 4 }}>Sin acciones definidas. Añade al menos una acción de mejora.</p>
        )}
        {acc.map((a, i) => (
          <div key={i} className="mj-acc-item">
            <span className="mj-acc-num">A{i + 1}</span>
            <input
              className="mj-acc-inp"
              value={a}
              onChange={(e) => cambiar(i, e.target.value)}
              placeholder={`Describe la acción ${i + 1}…`}
            />
            <button className="mj-acc-del" onClick={() => borrar(i)} title="Eliminar">✕</button>
          </div>
        ))}
        <button className="mj-acc-add" onClick={agregar}>+ Añadir acción</button>
      </div>
    </section>
  );
}

// ---------- 3.6-3.8 Costo, Impacto, Factibilidad ----------
function CostoImpacto({ f, set, cat }) {
  const elegirCosto = (nivel) => {
    const c = cat.costos.find((x) => x.nivel === nivel);
    const mismo = f.costo_nivel === nivel;
    set("costo_nivel", mismo ? "" : nivel);
    set("costo_valor", mismo ? null : c?.valor);
  };
  const elegirImpacto = (nivel) => {
    const i = cat.impactos.find((x) => x.nivel === nivel);
    const mismo = f.impacto_nivel === nivel;
    set("impacto_nivel", mismo ? "" : nivel);
    set("impacto_valor", mismo ? null : i?.valor);
  };

  const fv     = (f.costo_valor != null && f.impacto_valor != null) ? f.costo_valor * f.impacto_valor : null;
  const fNivel = fv == null ? null : fv <= 7 ? "Alto" : fv <= 14 ? "Medio" : "Bajo";

  const clsFila = (nivel) =>
    nivel === "Alto" ? "mj-fila-alto" : nivel === "Medio" ? "mj-fila-medio" : "mj-fila-bajo";

  const FACT_ROWS = cat.factibilidad || [
    { nivel: "Bajo",  accion: "Analizar la oportunidad de mejora",  rango: "F > 14" },
    { nivel: "Medio", accion: "Ejecutar la acción a corto plazo",   rango: "7 < F ≤ 14" },
    { nivel: "Alto",  accion: "Ejecutar la acción inmediatamente",  rango: "1 ≤ F ≤ 7" },
  ];

  return (
    <>
      {/* 3.6 Costo */}
      <section className="mj-seccion">
        <h3>3.6 Costo referencial</h3>
        <p className="mj-sub-hint">Selecciona el nivel de costo según el porcentaje del presupuesto asignado que se emplea.</p>
        <div style={{ padding: "0 20px 16px" }}>
          <table className="mj-tabla mj-tabla-sel">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Descripción</th>
                <th style={{ width: 110 }}>Nivel</th>
                <th style={{ width: 56 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {cat.costos.map((c) => {
                const sel = f.costo_nivel === c.nivel;
                return (
                  <tr key={c.nivel}
                    className={`mj-fila-sel ${sel ? clsFila(c.nivel) + " mj-fila-activa" : ""}`}
                    onClick={() => elegirCosto(c.nivel)}>
                    <td style={{ textAlign: "left", fontWeight: sel ? 700 : 400 }}>{c.desc}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{c.nivel}</td>
                    <td style={{ textAlign: "center", fontWeight: 800 }}>{c.valor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3.7 Impacto */}
      <section className="mj-seccion">
        <h3>3.7 Impacto</h3>
        <p className="mj-sub-hint">Selecciona el nivel de impacto de la oportunidad de mejora en el proceso.</p>
        <div style={{ padding: "0 20px 16px" }}>
          <table className="mj-tabla mj-tabla-sel">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Descripción</th>
                <th style={{ width: 110 }}>Nivel</th>
                <th style={{ width: 56 }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {cat.impactos.map((imp) => {
                const sel = f.impacto_nivel === imp.nivel;
                return (
                  <tr key={imp.nivel}
                    className={`mj-fila-sel ${sel ? clsFila(imp.nivel) + " mj-fila-activa" : ""}`}
                    onClick={() => elegirImpacto(imp.nivel)}>
                    <td style={{ textAlign: "left", fontWeight: sel ? 700 : 400 }}>{imp.desc || imp.nivel}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{imp.nivel}</td>
                    <td style={{ textAlign: "center", fontWeight: 800 }}>{imp.valor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3.8 Factibilidad */}
      <section className="mj-seccion">
        <h3>3.8 Factibilidad</h3>
        {fv != null ? (
          <div style={{ padding: "14px 20px 20px" }}>
            <div className="mj-fact-fila">
              <div className="mj-fact-bloque">
                <span className="mj-fact-lbl-sm">Fórmula</span>
                <span className="mj-fact-val">F = C × I</span>
              </div>
              <span className="mj-fact-sep">→</span>
              <div className="mj-fact-bloque">
                <span className="mj-fact-lbl-sm">Cálculo</span>
                <span className="mj-fact-val">
                  {f.costo_valor} × {f.impacto_valor} = <strong>{fv}</strong>
                </span>
              </div>
              <span className="mj-fact-sep">→</span>
              <div className={`mj-fact-nivel ${fNivel === "Alto" ? "mj-fnivel-alto" : fNivel === "Medio" ? "mj-fnivel-medio" : "mj-fnivel-bajo"}`}>
                <span className="mj-fact-lbl-sm">Factibilidad</span>
                <span className="mj-fact-nivel-txt">{fNivel}</span>
              </div>
            </div>
            {FACT_ROWS.filter(({ nivel }) => nivel === fNivel).map(({ accion, rango }) => (
              <div key={rango} className={`mj-fact-accion ${fNivel === "Alto" ? "mj-fnivel-alto" : fNivel === "Medio" ? "mj-fnivel-medio" : "mj-fnivel-bajo"}`}>
                <div>
                  <div className="mj-fact-accion-lbl">Acción recomendada</div>
                  <div className="mj-fact-accion-txt">{accion}</div>
                </div>
                <span className="mj-fact-rango">{rango}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mj-sub-hint" style={{ padding: "12px 20px" }}>
            Selecciona el costo e impacto para calcular la factibilidad automáticamente.
          </p>
        )}
      </section>
    </>
  );
}

// ---------- 3.9-3.10 Plazo y Estado ----------
function PlazoEstado({ f, set }) {
  const indIni = f.ind_fecha_inicio || null;
  const indFin = f.ind_fecha_fin    || null;

  const fmtL = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    const ms = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d} ${ms[+m-1]} ${y}`;
  };

  const s    = f.fecha_solicitud ? new Date(f.fecha_solicitud) : null;
  const r    = f.fecha_requerida ? new Date(f.fecha_requerida) : null;
  const dias = (s && r && r > s) ? Math.round((r - s) / 86400000) + 1 : null;

  const ESTADOS_DEF = [
    { valor: "No iniciado", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
    { valor: "En proceso",  color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
    { valor: "Cerrado",     color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  ];
  const estadoAct = f.estado || "No iniciado";

  return (
    <>
      {/* 3.9 Plazo */}
      <section className="mj-seccion">
        <h3>3.9 Plazo: tiempo de mejora</h3>
        <div style={{ padding: "14px 20px 16px" }}>
          {(indIni || indFin) && (
            <div className="mj-crono-ref" style={{ marginBottom: dias ? 12 : 0 }}>
              <div>
                <div className="mj-crono-tit">Cronograma del proceso (referencia)</div>
                <div className="mj-crono-rango">
                  <span className="mj-crono-fecha">{fmtL(indIni)}</span>
                  <span className="mj-crono-flecha">→</span>
                  <span className="mj-crono-fecha">{fmtL(indFin)}</span>
                </div>
                {indFin && (
                  <div className="mj-crono-nota" style={{ marginTop: 5 }}>
                    El plazo de mejora debe iniciar después de <strong>{fmtL(indFin)}</strong>.
                  </div>
                )}
              </div>
            </div>
          )}
          {dias != null ? (
            <div className="mj-plazo-dur">
              <span className="mj-plazo-dur-num">{dias}</span>
              <div>
                <div className="mj-plazo-dur-lbl">día{dias !== 1 ? "s" : ""} de plazo</div>
                <div className="mj-plazo-dur-rango">{fmtL(f.fecha_solicitud)} → {fmtL(f.fecha_requerida)}</div>
              </div>
            </div>
          ) : (
            <p className="mj-sub-hint" style={{ margin: 0 }}>
              Completa las fechas de solicitud y requerida en la sección 1 para ver la duración del plazo.
            </p>
          )}
        </div>
      </section>

      {/* 3.10 Estado */}
      <section className="mj-seccion">
        <h3>3.10 Estado de la mejora</h3>
        <div style={{ padding: "14px 20px 20px" }}>
          <div className="mj-estado-cards">
            {ESTADOS_DEF.map(({ valor, color, bg, border }) => {
              const sel = estadoAct === valor;
              return (
                <div key={valor}
                  className={`mj-est-card ${sel ? "mj-est-sel" : ""}`}
                  style={sel
                    ? { background: bg, borderColor: color, color }
                    : { background: "#F8FAFC", borderColor: "#E2E8F0", color: "#64748B" }
                  }
                  onClick={() => set("estado", valor)}>
                  <span className="mj-est-dot" style={{ background: sel ? color : "#CBD5E1" }} />
                  <span className="mj-est-label">{valor}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

// ---------- Tabla resumen (auto-llenada) ----------
function TablaResumen({ f }) {
  const fmtL = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    const ms = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d} ${ms[+m-1]} ${y}`;
  };

  const evals    = f.evaluaciones_json || [];
  const acciones = (f.acciones_json || []).map((_, i) => `A${i+1}`).join(", ");
  const plazoStr = (f.fecha_solicitud && f.fecha_requerida)
    ? `${fmtL(f.fecha_solicitud)} → ${fmtL(f.fecha_requerida)}`
    : "—";

  const fv     = (f.costo_valor != null && f.impacto_valor != null) ? f.costo_valor * f.impacto_valor : null;
  const fNivel = fv == null ? null : fv <= 7 ? "Alto" : fv <= 14 ? "Medio" : "Bajo";

  const ESTADO_STYLE = {
    "No iniciado": { bg: "#FEE2E2", color: "#991B1B" },
    "En proceso":  { bg: "#FEF9C3", color: "#92400E" },
    "Cerrado":     { bg: "#DCFCE7", color: "#15803D" },
  };
  const FACT_STYLE = {
    "Alto":  { bg: "#DCFCE7", color: "#15803D" },
    "Medio": { bg: "#FEF9C3", color: "#92400E" },
    "Bajo":  { bg: "#FEE2E2", color: "#991B1B" },
  };

  const estadoStyle = ESTADO_STYLE[f.estado] || { bg: "#F1F5F9", color: "#64748B" };
  const factStyle   = FACT_STYLE[fNivel]   || { bg: "#F1F5F9", color: "#64748B" };
  const filas = evals.length > 0 ? evals : [null];

  return (
    <section className="mj-seccion">
      <h3>Tabla Resumen de la Oportunidad de Mejora</h3>
      <div className="mj-resumen-wrap">
        <table className="mj-tabla mj-resumen-tabla">
          <thead>
            <tr>
              <th style={{ width: 32 }}>N°</th>
              <th>Tipo</th>
              <th>Oportunidad</th>
              <th>Acciones</th>
              <th>Costo</th>
              <th>Impacto</th>
              <th>Factibilidad</th>
              <th>Plazo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((_, i) => (
              <tr key={i}>
                <td style={{ textAlign: "center" }}>{i + 1}</td>
                <td>{f.tipo_oportunidad || "—"}</td>
                <td className="mj-resumen-celda">{f.oportunidades_identificadas || "—"}</td>
                <td style={{ textAlign: "center" }}>{acciones || "—"}</td>
                <td style={{ textAlign: "center" }}>
                  {f.costo_nivel ? `${f.costo_nivel} (${f.costo_valor})` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  {f.impacto_nivel ? `${f.impacto_nivel} (${f.impacto_valor})` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  {fNivel
                    ? <span className="mj-resumen-badge" style={{ background: factStyle.bg, color: factStyle.color }}>{fNivel}</span>
                    : "—"}
                </td>
                <td className="mj-resumen-celda">{plazoStr}</td>
                <td style={{ textAlign: "center" }}>
                  <span className="mj-resumen-badge" style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
                    {f.estado || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- 4. Descripción de la mejora ----------
function DescripcionMejora({ f, set }) {
  const fv     = (f.costo_valor != null && f.impacto_valor != null) ? f.costo_valor * f.impacto_valor : null;
  const fNivel = fv == null ? null : fv <= 7 ? "Alta" : fv <= 14 ? "Media" : "Baja";
  const fAccion = fNivel === "Alta" ? "Ejecutar inmediatamente"
                : fNivel === "Media" ? "Ejecutar a corto plazo"
                : fNivel === "Baja"  ? "Analizar la oportunidad" : null;

  const CAMPOS = [
    { key: "desc_problema",       label: "Declaración del problema", hint: "Qué, cuándo, dónde, cuánto", filas: 4 },
    { key: "desc_objetivo",       label: "Objetivo",                  hint: "",                           filas: 3 },
    { key: "desc_indicador_meta", label: "Indicador y meta",          hint: "",                           filas: 3 },
    { key: "desc_alcance",        label: "Alcance",                   hint: "",                           filas: 2 },
    { key: "desc_accion_mejora",  label: "Acción de mejora",          hint: "",                           filas: 3 },
    { key: "desc_impacto",        label: "Impacto",                   hint: "",                           filas: 2 },
  ];

  return (
    <section className="mj-seccion">
      <h3>4. Descripción de la mejora</h3>
      <div className="mj-desc-cuerpo">
        {CAMPOS.map(({ key, label, hint, filas }) => (
          <div key={key} className="mj-desc-campo">
            <div className="mj-desc-label">
              {label}
              {hint && <span className="mj-desc-hint"> — {hint}</span>}
            </div>
            <textarea
              className="mj-desc-textarea"
              rows={filas}
              value={f[key] || ""}
              onChange={(e) => set(key, e.target.value)}
              placeholder="Escriba aquí..."
            />
          </div>
        ))}
        <div className="mj-desc-auto-row">
          <div className="mj-desc-auto-item">
            <span className="mj-desc-auto-lbl">Costo</span>
            <span className="mj-desc-auto-val">
              {f.costo_nivel ? `${f.costo_nivel} — valor ${f.costo_valor ?? "—"}` : "—"}
            </span>
          </div>
          <div className="mj-desc-auto-item">
            <span className="mj-desc-auto-lbl">Factibilidad</span>
            <span className="mj-desc-auto-val">
              {fv != null ? `${fNivel} (F = ${fv})${fAccion ? ` — ${fAccion}` : ""}` : "—"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Cronograma de avance semanal ----------

/** Devuelve sólo las semanas hasta la última con planificado > 0 o logrado ingresado.
 *  Si no hay ningún dato aún, muestra las primeras 4 semanas como guía. */
function filtrarSemanas(semanas, crono) {
  if (!semanas.length) return semanas;
  let maxN = 0;
  for (const entry of crono) {
    const plan = entry.planificado;
    const logr = entry.logrado;
    if ((plan != null && Number(plan) > 0) || logr != null) {
      const n = Number(entry.semana);
      if (n > maxN) maxN = n;
    }
  }
  if (maxN === 0) return semanas.slice(0, Math.min(4, semanas.length));
  return semanas.filter((s) => s.n <= maxN);
}

function generarSemanas(fechaIni, fechaFin) {
  if (!fechaIni || !fechaFin) return [];
  const ini = new Date(fechaIni + "T00:00:00");
  const fin = new Date(fechaFin + "T00:00:00");
  if (fin < ini) return [];
  const semanas = [];
  let actual = new Date(ini);
  let n = 1;
  while (actual <= fin) {
    const iniSem = new Date(actual);
    const finSem = new Date(actual);
    finSem.setDate(finSem.getDate() + 6);
    if (finSem > fin) finSem.setTime(fin.getTime());
    const dias = Math.round((finSem - iniSem) / 86400000) + 1;
    semanas.push({ n, inicio: iniSem.toISOString().split("T")[0], fin: finSem.toISOString().split("T")[0], dias });
    actual.setDate(actual.getDate() + 7);
    n++;
  }
  return semanas;
}

function TablaSemanal({ semanas, crono, onSetVal, onClear, fmtL }) {
  if (semanas.length === 0) return null;
  const totalDias = semanas.reduce((s, w) => s + w.dias, 0);

  const getVal = (n, campo) => {
    const row = crono.find((r) => r.semana === n);
    return row ? (row[campo] ?? "") : "";
  };

  const planVals = semanas.map((s) => getVal(s.n, "planificado")).filter((v) => v !== "");
  const logrVals = semanas.map((s) => getVal(s.n, "logrado")).filter((v) => v !== "");
  const avgPlan  = planVals.length ? Math.round(planVals.reduce((a, b) => a + Number(b), 0) / planVals.length) : null;
  const avgLogr  = logrVals.length ? Math.round(logrVals.reduce((a, b) => a + Number(b), 0) / logrVals.length) : null;

  return (
    <>
      <div className="mj-crono-meta">
        <span><strong>{semanas.length}</strong> semana{semanas.length !== 1 ? "s" : ""}</span>
        <span className="mj-crono-meta-sep">·</span>
        <span><strong>{totalDias}</strong> días en total</span>
      </div>
      <table className="mj-crono-tabla">
        <thead>
          <tr>
            <th className="mj-crono-th-sem">Semana</th>
            <th>Período</th>
            <th className="mj-crono-th-dias">Días</th>
            <th className="mj-crono-th-num">Planificado (%)</th>
            <th className="mj-crono-th-num">Logrado (%)</th>
            <th className="mj-crono-th-bar">Avance</th>
            <th className="mj-crono-th-act"></th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => {
            const plan = getVal(s.n, "planificado");
            const logr = getVal(s.n, "logrado");
            const pNum = plan !== "" ? Number(plan) : null;
            const lNum = logr !== "" ? Number(logr) : null;
            const tieneDatos = pNum != null || lNum != null;
            const adelantado = lNum != null && pNum != null && lNum >= pNum;
            const atrasado   = lNum != null && pNum != null && lNum < pNum;
            return (
              <tr key={s.n} className="mj-crono-fila">
                <td className="mj-crono-td-sem">
                  <span className="mj-crono-sem-badge">S{s.n}</span>
                </td>
                <td className="mj-crono-td-rango">
                  <span className="mj-crono-rango-txt">{fmtL(s.inicio)}</span>
                  {s.inicio !== s.fin && (
                    <>
                      <span className="mj-crono-rango-sep">→</span>
                      <span className="mj-crono-rango-txt">{fmtL(s.fin)}</span>
                    </>
                  )}
                </td>
                <td className="mj-crono-td-c">
                  <span className="mj-crono-dias-chip">{s.dias}d</span>
                </td>
                <td className="mj-crono-td-c">
                  <div className="mj-crono-inp-wrap mj-crono-inp-plan">
                    <input
                      type="number" min={0} max={100}
                      className="mj-crono-inp"
                      value={plan}
                      onChange={(e) => onSetVal(s.n, "planificado", e.target.value)}
                      placeholder="—"
                    />
                    {pNum != null && <span className="mj-crono-pct">%</span>}
                  </div>
                </td>
                <td className="mj-crono-td-c">
                  <div className={`mj-crono-inp-wrap ${lNum != null ? (adelantado ? "mj-crono-inp-ok" : atrasado ? "mj-crono-inp-atr" : "") : ""}`}>
                    <input
                      type="number" min={0} max={100}
                      className="mj-crono-inp"
                      value={logr}
                      onChange={(e) => onSetVal(s.n, "logrado", e.target.value)}
                      placeholder="—"
                    />
                    {lNum != null && <span className="mj-crono-pct">%</span>}
                  </div>
                </td>
                <td className="mj-crono-td-bar">
                  <div className="mj-crono-bar-wrap">
                    {pNum != null && (
                      <div className="mj-crono-bar-plan" style={{ width: `${Math.min(pNum, 100)}%` }} />
                    )}
                    {lNum != null && (
                      <div
                        className={`mj-crono-bar-logr ${adelantado ? "mj-bar-ok" : atrasado ? "mj-bar-atr" : ""}`}
                        style={{ width: `${Math.min(lNum, 100)}%` }}
                      />
                    )}
                  </div>
                </td>
                <td className="mj-crono-td-act">
                  {tieneDatos && onClear && (
                    <button
                      className="mj-crono-clear-btn"
                      title="Limpiar datos de esta semana"
                      onClick={() => onClear(s.n)}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Cronograma({ f, set }) {
  const fmtL = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    const ms = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d} ${ms[+m-1]} ${y}`;
  };

  // Grid completo del proceso (ind_fecha_inicio → ind_fecha_fin)
  // La mejora puede caer en cualquier semana, incluyendo semanas con planificado = 0
  const semanasProc = generarSemanas(f.ind_fecha_inicio, f.ind_fecha_fin);
  const cronoMej    = f.cronograma_json || [];

  // Semanas del proceso que se superponen con el rango de la mejora.
  // "dias" se recalcula como los días reales de solapamiento (no la semana completa).
  const semanasMej = semanasProc
    .filter((s) => {
      if (!f.fecha_solicitud || !f.fecha_requerida) return false;
      return s.inicio <= f.fecha_requerida && s.fin >= f.fecha_solicitud;
    })
    .map((s) => {
      const oIni = s.inicio > f.fecha_solicitud ? s.inicio : f.fecha_solicitud;
      const oFin = s.fin   < f.fecha_requerida  ? s.fin   : f.fecha_requerida;
      const dias = Math.round(
        (new Date(oFin + "T00:00:00") - new Date(oIni + "T00:00:00")) / 86400000
      ) + 1;
      return { ...s, dias };
    });

  // Solo guarda semanas dentro de semanasMej para no acumular datos de otras semanas ajenas a la mejora
  const setVal = (n, camp, valor) => {
    const nueva = semanasMej.map((s) => {
      const prev = cronoMej.find((r) => r.semana === s.n) || { semana: s.n, inicio: s.inicio, fin: s.fin };
      return s.n === n
        ? { ...prev, [camp]: valor === "" ? null : Number(valor), inicio: s.inicio, fin: s.fin }
        : prev;
    });
    set("cronograma_json", nueva);
  };

  // Limpia planificado y logrado de una semana en una sola operación
  const clearVal = (n) => {
    const nueva = semanasMej.map((s) => {
      const prev = cronoMej.find((r) => r.semana === s.n) || { semana: s.n, inicio: s.inicio, fin: s.fin };
      return s.n === n
        ? { ...prev, planificado: null, logrado: null, inicio: s.inicio, fin: s.fin }
        : prev;
    });
    set("cronograma_json", nueva);
  };

  const sinFechasMej = !f.fecha_solicitud || !f.fecha_requerida;
  const sinProc      = semanasProc.length === 0;

  return (
    <section className="mj-seccion">
      <h3>Cronograma de la mejora</h3>
      {sinFechasMej ? (
        <p className="mj-sub-hint" style={{ padding: "14px 20px" }}>
          Define la <strong>Fecha de solicitud</strong> y la <strong>Fecha requerida</strong> en
          Datos Generales para generar este cronograma.
        </p>
      ) : sinProc ? (
        <p className="mj-sub-hint" style={{ padding: "14px 20px" }}>
          Sin cronograma de proceso disponible. Asegúrate de que el indicador tenga fechas
          de inicio y fin registradas.
        </p>
      ) : semanasMej.length === 0 ? (
        <p className="mj-sub-hint" style={{ padding: "14px 20px" }}>
          Las fechas de la mejora ({fmtL(f.fecha_solicitud)} → {fmtL(f.fecha_requerida)}) están
          completamente fuera del período del proceso ({fmtL(f.ind_fecha_inicio)} → {fmtL(f.ind_fecha_fin)}).
          Corrige la <strong>Fecha de solicitud</strong> y la <strong>Fecha requerida</strong> en Datos Generales.
        </p>
      ) : (
        <>
          <p className="mj-sub-hint">
            Período: <strong>{fmtL(f.fecha_solicitud)}</strong> → <strong>{fmtL(f.fecha_requerida)}</strong>
            <span style={{ color: "#64748B", marginLeft: 10 }}>
              · {semanasMej.length} semana{semanasMej.length !== 1 ? "s" : ""} del cronograma del proceso
            </span>
          </p>
          <div style={{ padding: "0 20px 20px" }}>
            <TablaSemanal
              semanas={semanasMej}
              crono={cronoMej}
              onSetVal={setVal}
              onClear={clearVal}
              fmtL={fmtL}
            />
          </div>
        </>
      )}
    </section>
  );
}

// ---------- RESULTADOS DE MEJORA ----------

const COLOR_SEMAF = {
  verde:    { bg: "#DCFCE7", color: "#15803D", border: "#BBF7D0" },
  amarillo: { bg: "#FEF9C3", color: "#92400E", border: "#FDE68A" },
  rojo:     { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
};

function BadgeTipo({ valor, color }) {
  if (valor == null) return <td className="rid-cell rid-cell-c" style={{ color: "#94a3b8" }}>—</td>;
  const s = COLOR_SEMAF[color] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
  return (
    <td className="rid-cell rid-cell-c">
      <span style={{
        display: "inline-block", padding: "2px 10px", borderRadius: 20,
        fontSize: 11, fontWeight: 700,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        {Number(valor).toFixed(1)}
      </span>
    </td>
  );
}

function ResultadosMejora() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    obtenerResultadosMejora()
      .then(setDatos)
      .catch(() => setError("No se pudo cargar los resultados."))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="mj-vacio">Cargando resultados…</div>;
  if (error)    return <div className="mj-vacio" style={{ color: "#DC2626" }}>{error}</div>;
  if (!datos?.semanas?.length) return (
    <div className="mj-vacio">
      No hay cronogramas de mejora registrados. Ingresa fechas y cronograma en la Ficha de Mejora.
    </div>
  );

  const { semanas, filas, rangos = [], procesos_chart = [] } = datos;

  const etqRango = (color) => {
    const r = rangos.find((x) => x.color === color);
    return r ? r.etiqueta : color;
  };

  const fmtPeso = (p) => {
    if (!p) return "—";
    const den = Math.round(1 / p);
    return `1/${den}`;
  };

  // Formato de rango de fechas en español: "21-27 MAY" o "28 MAY-03 JUN"
  const MESES_ES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const fmtRango = (ini, fin) => {
    const d1 = new Date(ini + "T00:00:00");
    const d2 = new Date(fin + "T00:00:00");
    const m1 = MESES_ES[d1.getMonth()], m2 = MESES_ES[d2.getMonth()];
    const dia1 = String(d1.getDate()).padStart(2, "0");
    const dia2 = String(d2.getDate()).padStart(2, "0");
    return d1.getMonth() === d2.getMonth()
      ? `${dia1}-${dia2} ${m1}`
      : `${dia1} ${m1}-${dia2} ${m2}`;
  };

  // 7 fijas + semanas*2 + 1 avance
  const colSpanFijo = 8 + semanas.length * 2;

  // Pre-calcular avance ponderado para OEI y AEI:
  // suma de (peso × avance_final) de todos los ind_detalle del grupo
  const avancePorFila = {};
  filas.forEach((f, idx) => {
    if (f.tipo !== "objetivo" && f.tipo !== "accion") return;
    let suma = 0, tieneDatos = false;
    for (let j = idx + 1; j < filas.length; j++) {
      const h = filas[j];
      if (h.tipo === "objetivo") break;
      if (f.tipo === "accion" && h.tipo === "accion") break;
      if (h.tipo === "ind_detalle") {
        const av = h.tipo2 != null ? Number(h.tipo2)
                 : h.avance_tipo_i != null ? Number(h.avance_tipo_i) : null;
        const pe = h.peso;
        if (av != null && pe != null) { suma += pe * av; tieneDatos = true; }
      }
    }
    avancePorFila[idx] = tieneDatos ? Math.round(suma * 10) / 10 : null;
  });

  const colorStd = (v) => v == null ? null : v >= 56 ? "verde" : v >= 16 ? "amarillo" : "rojo";

  const filasVisibles = filas;

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>
          Tabla de Resultados de Mejora
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {rangos.map((r) => {
            const s = COLOR_SEMAF[r.color] || {};
            return (
              <span key={r.id_rango} style={{
                fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>
                {r.etiqueta} {r.desde}–{r.hasta}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="rid-tabla" style={{ minWidth: 900 }}>
          <thead>
            <tr className="rid-thead-tr">
              <th className="rid-th rid-th-cod" rowSpan={2}>Código</th>
              <th className="rid-th" rowSpan={2} style={{ minWidth: 180, textAlign: "left" }}>Objetivos / Indicadores</th>
              <th className="rid-th" rowSpan={2} style={{ width: 56 }}>Prioridad</th>
              <th className="rid-th" rowSpan={2} style={{ width: 80 }}>Sentido</th>
              <th className="rid-th" rowSpan={2} style={{ width: 80 }}>Tipo Agr.</th>
              <th className="rid-th" colSpan={2}>Línea Base</th>
              <th className="rid-th" rowSpan={2} style={{ width: 58 }}>Ponderado</th>
              {semanas.length > 0 && (
                <th colSpan={semanas.length} className="rid-th rid-th-grupo rid-th-logros" style={{ textAlign: "center" }}>
                  Logros Esperados
                </th>
              )}
              {semanas.length > 0 && (
                <th colSpan={semanas.length} className="rid-th rid-th-grupo rid-th-valores" style={{ textAlign: "center" }}>
                  Valores Obtenidos
                </th>
              )}
              <th className="rid-th" rowSpan={2} style={{ background: "#0f172a", color: "#f8fafc", textAlign: "center", whiteSpace: "nowrap", width: 72 }}>
                Avance II
              </th>
            </tr>
            <tr className="rid-thead-tr">
              <th className="rid-th" style={{ width: 48, fontSize: 10 }}>Año</th>
              <th className="rid-th" style={{ width: 58, fontSize: 10 }}>Valor</th>
              {semanas.map((s) => {
                const esMej = s.tipo === "mejora";
                return (
                  <th key={`le-${s.n}`} className="rid-th rid-th-per"
                      style={{ whiteSpace: "nowrap", fontSize: 10, minWidth: 74,
                        background: esMej ? "#065f46" : "#1d4ed8",
                        color:      esMej ? "#6ee7b7" : "#bfdbfe" }}>
                    {fmtRango(s.inicio, s.fin)}
                  </th>
                );
              })}
              {semanas.map((s) => {
                const esMej = s.tipo === "mejora";
                return (
                  <th key={`vo-${s.n}`} className="rid-th rid-th-per"
                      style={{ whiteSpace: "nowrap", fontSize: 10, minWidth: 74,
                        background: esMej ? "#064e3b" : "#0369a1",
                        color:      esMej ? "#a7f3d0" : "#bae6fd" }}>
                    {fmtRango(s.inicio, s.fin)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((f, idx) => {
              if (f.tipo === "objetivo") {
                const av = avancePorFila[idx];
                const sc = COLOR_SEMAF[colorStd(av)] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
                return (
                  <tr key={idx} className="rid-fila-obj-header">
                    <td className="rid-cod" style={{ color: "#fff", fontWeight: 800 }}>{f.codigo}</td>
                    <td colSpan={colSpanFijo - 1} className="rid-desc-bold" style={{ color: "#fff" }}>
                      {f.codigo}: {f.descripcion}
                    </td>
                    <td className="rid-cell rid-cell-c">
                      {av != null
                        ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20,
                            fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                            {av.toFixed(1)}
                          </span>
                        : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                  </tr>
                );
              }
              if (f.tipo === "accion") {
                const av = avancePorFila[idx];
                const sc = COLOR_SEMAF[colorStd(av)] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
                return (
                  <tr key={idx} className="rid-fila-acc-header">
                    <td className="rid-cod" style={{ color: "#0369a1" }}>{f.codigo}</td>
                    <td colSpan={colSpanFijo - 1} className="rid-cell" style={{ fontWeight: 700, color: "#0369a1" }}>
                      {f.codigo}: {f.descripcion}
                    </td>
                    <td className="rid-cell rid-cell-c">
                      {av != null
                        ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20,
                            fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                            {av.toFixed(1)}
                          </span>
                        : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                  </tr>
                );
              }
              // ind_detalle
              const sd = f.semanas_data || {};
              const tieneMejora = f.tiene_mejora;
              return (
                <tr key={idx} className={`rid-fila-ind ${!tieneMejora ? "rid-fila-sin-mejora" : ""}`}>
                  <td className="rid-cod" style={{ color: "#475569", fontSize: 11 }}>{f.codigo}</td>
                  <td className="rid-cell" style={{ textAlign: "left", fontSize: 12 }}>
                    {f.descripcion}
                  </td>
                  {/* PRIORIDAD */}
                  <td className="rid-cell rid-cell-c">
                    {f.relevancia != null
                      ? <span style={{ display: "inline-block", minWidth: 22, padding: "2px 6px", borderRadius: 6, background: "#F1F5F9", fontWeight: 700, fontSize: 12, color: "#475569" }}>{f.relevancia}</span>
                      : <span style={{ color: "#CBD5E1" }}>—</span>}
                  </td>
                  {/* SENTIDO */}
                  <td className="rid-cell rid-cell-c" style={{ fontSize: 11, color: "#475569" }}>
                    {f.sentido || "—"}
                  </td>
                  {/* TIPO AGR. */}
                  <td className="rid-cell rid-cell-c" style={{ fontSize: 11, color: "#475569" }}>
                    {f.tipo_agregacion || "—"}
                  </td>
                  {/* LB AÑO */}
                  <td className="rid-cell rid-cell-c" style={{ fontSize: 12, color: "#64748B" }}>
                    {f.lb_anio || "2026"}
                  </td>
                  {/* LB VALOR = ATI Tipo 1 (sirve de línea base para la mejora) */}
                  <td className="rid-cell rid-cell-c" style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
                    {f.avance_tipo_i != null ? `${Number(f.avance_tipo_i).toFixed(1)}` : "—"}
                  </td>
                  {/* PONDERADO */}
                  <td className="rid-cell rid-cell-c" style={{ fontSize: 12, color: "#111827", fontWeight: 600 }}>
                    {f.peso != null ? fmtPeso(f.peso) : "—"}
                  </td>
                  {/* LOGROS ESPERADOS por semana */}
                  {semanas.map((s) => {
                    const entry = sd[String(s.n)] || {};
                    const plan  = entry.planificado;
                    const esMej = entry.tipo === "mejora";
                    return (
                      <td key={`le-${s.n}`} className="rid-cell rid-cell-c"
                          style={{ fontSize: 12,
                            background: esMej ? "#ecfdf5" : "#EFF6FF",
                            color: plan != null ? (esMej ? "#1D4ED8" : "#111827") : "#CBD5E1" }}>
                        {plan != null ? `${plan}` : "·"}
                      </td>
                    );
                  })}
                  {/* VALORES OBTENIDOS por semana */}
                  {semanas.map((s) => {
                    const entry = sd[String(s.n)] || {};
                    const plan  = entry.planificado;
                    const logr  = entry.logrado;
                    const esMej = entry.tipo === "mejora";
                    return (
                      <td key={`vo-${s.n}`} className="rid-cell rid-cell-c"
                          style={{ fontSize: 12, fontWeight: 700,
                            background: esMej ? "#d1fae5" : "#F0F9FF",
                            color: logr != null ? (esMej ? "#1D4ED8" : "#111827") : "#CBD5E1" }}>
                        {logr != null ? `${logr}` : "·"}
                      </td>
                    );
                  })}
                  {/* AVANCE FINAL: Tipo 2 con mejora, o ATI si no tiene mejora */}
                  {f.tipo2 != null
                    ? <BadgeTipo valor={f.tipo2} color={f.color_tipo2} />
                    : (() => {
                        const ati = f.avance_tipo_i != null ? Number(f.avance_tipo_i) : null;
                        const col = ati == null ? null : ati >= 95 ? "verde" : ati >= 75 ? "amarillo" : "rojo";
                        return <BadgeTipo valor={ati != null ? ati.toFixed(1) : null} color={col} />;
                      })()
                  }
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {/* Gráfica lollipop: todos los indicadores con mejora aplicada */}
      {procesos_chart.length > 0 && <GraficaResultados datos={procesos_chart} />}
    </div>
  );
}

const COLOR_STD = { verde: "#16a34a", amarillo: "#eab308", rojo: "#dc2626" };
const GRUPOS_PALETA = [
  "#2563EB","#16a34a","#EA580C","#9333EA","#0891B2","#DB2777",
];
const YTICKS_G = [0,10,20,30,40,50,60,70,80,90,100];

function GraficaResultados({ datos }) {
  const n = datos.length || 1;
  const grupos = [...new Set(datos.map(d => d.grupo).filter(Boolean))].sort();
  const grupoCol = {};
  grupos.forEach((g, i) => { grupoCol[g] = GRUPOS_PALETA[i % GRUPOS_PALETA.length]; });

  return (
    <section className="rmj-seccion" style={{ marginTop: 24 }}>
      <div className="rmj-cab">
        <h3>Avance de Indicadores con Mejora Aplicada</h3>
      </div>

      <div className="rmj-leyenda">
        <span className="rmj-ley-item"><span className="rmj-ley-dot" style={{ background: "#16a34a" }} />Óptimo 56–100</span>
        <span className="rmj-ley-item"><span className="rmj-ley-dot" style={{ background: "#eab308" }} />En Proceso 16–55</span>
        <span className="rmj-ley-item"><span className="rmj-ley-dot" style={{ background: "#dc2626" }} />Riesgo Crítico 0–15</span>
        <span className="rmj-ley-sep" />
        <span className="rmj-ley-item">
          <span className="rmj-ley-dot" style={{ background: "#fff", border: "2px solid #2563EB", boxSizing: "border-box", borderRadius: "50%" }} />
          Sin mejora
        </span>
        <span className="rmj-ley-item">
          <span className="rmj-ley-dot" style={{ background: "#fff", border: "2px solid #2563EB", boxSizing: "border-box", borderRadius: "3px" }} />
          Con mejora
        </span>
        <span className="rmj-ley-sep" />
        {grupos.map((g, i) => (
          <span key={g} className="rmj-ley-item">
            <span className="rmj-ley-dot" style={{ background: grupoCol[g] }} />{g}
          </span>
        ))}
      </div>

      <div className="rmj-outer">
        <div className="rmj-yaxis">
          {YTICKS_G.map(t => (
            <span key={t} className="rmj-ylabel" style={{ bottom: `${t}%` }}>{t}%</span>
          ))}
        </div>
        <div className="rmj-plot">
          <div className="rmj-zone" style={{ bottom: 0,     height: "75%", background: "#fef2f2" }} />
          <div className="rmj-zone" style={{ bottom: "75%", height: "20%", background: "#fefce8" }} />
          <div className="rmj-zone" style={{ bottom: "95%", height: "5%",  background: "#f0fdf4" }} />
          {YTICKS_G.map(t => <div key={t} className="rmj-hline" style={{ bottom: `${t}%` }} />)}

          <svg className="rmj-connector" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={datos.map((d, i) => `${(i + 0.5) / n * 100},${100 - Math.min(d.pct ?? 0, 100)}`).join(" ")}
              fill="none" stroke="#64748b" strokeWidth="0.8" strokeDasharray="2.5 2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {datos.map((d, i) => {
            const col = COLOR_STD[d.color] || COLOR_STD.rojo;
            const gc  = grupoCol[d.grupo]  || "#94A3B8";
            const pct = Math.min(d.pct ?? 0, 100);
            const left = `${(i + 0.5) / n * 100}%`;
            return (
              <div key={d.codigo} className="rmj-loli" style={{ left }}>
                <div className="rmj-stick"
                  style={{
                    height: `${pct}%`, background: col,
                    borderLeft: d.tiene_mejora ? `3px dashed ${col}` : undefined,
                    width: d.tiene_mejora ? 0 : 3,
                  }} />
                <div className={`rmj-dot${d.tiene_mejora ? " rmj-dot-mejora" : ""}`} style={{ bottom: `${pct}%`, background: col, borderColor: gc }}>
                  <div className="rmj-tip">
                    {d.grupo && <span className="rmj-tip-proc">{d.grupo}</span>}
                    <strong>{d.nombre || d.codigo}</strong>
                  </div>
                </div>
                <span className="rmj-val" style={{ bottom: `${pct}%`, color: col }}>
                  {d.pct != null ? `${d.pct}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rmj-xaxis">
        <div className="rmj-yaxis-gap" />
        <div className="rmj-xnames">
          {datos.map((d, i) => {
            const gc = grupoCol[d.grupo] || "#94A3B8";
            return (
              <div key={d.codigo} className="rmj-xlabel-wrap"
                style={{ left: `${(i + 0.5) / n * 100}%` }}>
                <span className="rmj-xlabel"
                  style={{ color: gc, borderTopColor: gc,
                    fontStyle: d.tiene_mejora ? "italic" : "normal" }}>
                  {d.codigo}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
