import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import {
  obtenerProcesos, crearProceso, actualizarProceso, eliminarProceso,
  obtenerHijos, crearNodo, actualizarNodo, eliminarNodo,
  obtenerInventarioCompleto,
} from "../services/api";
import "./InventarioProcesos.css";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];
const NIVEL_MAXIMO = 4;
const ETIQUETAS_NIVEL = ["Proceso", "Subproceso", "Subproceso", "Subproceso", "Subproceso"];

// Patrón serpentina: 4 por fila, filas impares invertidas, conector vertical entre filas
const POR_FILA = 4;

function SnakeTimeline({ items, tono, renderItem }) {
  const filas = [];
  for (let i = 0; i < items.length; i += POR_FILA) filas.push(items.slice(i, i + POR_FILA));

  return (
    <div className={`jer-snake-wrap jer-tl-${tono}`}>
      {filas.map((fila, fi) => {
        const esReversa    = fi % 2 === 1;
        const display      = esReversa ? [...fila].reverse() : fila;
        const esUltimaFila = fi === filas.length - 1;
        const padded = [...display];
        if (esReversa) {
          while (padded.length < POR_FILA) padded.unshift(null);
        } else {
          while (padded.length < POR_FILA) padded.push(null);
        }

        return (
          <div key={fi}>
            <div className={`jer-fila jer-items-${fila.length}${fila.length > 1 ? " jer-fila-multi" : ""}${esReversa ? " jer-fila-rev" : " jer-fila-fwd"}${!esUltimaFila ? " jer-fila-continua" : ""}`}>
              {padded.map((n, idx) =>
                n
                  ? renderItem(n)
                  : <div key={`sp-${idx}`} className="jer-paso jer-spacer" />
              )}
            </div>
            {!esUltimaFila && (
              <div className={`jer-giro jer-giro-${esReversa ? "izq" : "der"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GestionProcesosView() {
  const [pestana, setPestana] = useState("mapa");

  return (
    <div className="vista">
      <header className="cabecera-vista">
        <h2>Gestión de Procesos</h2>
        <div className="barra-pestanas">
          <button className={`btn-pestana ${pestana === "mapa" ? "activa" : ""}`} onClick={() => setPestana("mapa")}>
            Mapa
          </button>
          <button className={`btn-pestana ${pestana === "jerarquia" ? "activa" : ""}`} onClick={() => setPestana("jerarquia")}>
            Jerarquía
          </button>
          <button className={`btn-pestana ${pestana === "inventario" ? "activa" : ""}`} onClick={() => setPestana("inventario")}>
            Inventario
          </button>
        </div>
      </header>

      {pestana === "mapa" && <PanelMapa />}
      {pestana === "jerarquia" && <PanelJerarquia />}
      {pestana === "inventario" && <PanelInventario />}
    </div>
  );
}

// ─── PANEL MAPA ───────────────────────────────────────────────────────────────
const FORM_MAPA_VACIO = { Nombre_Proceso: "", Tipo_Proceso: "Misional", Orden_Consecutivo: 1 };

function PanelMapa() {
  const [procesos, setProcesos] = useState([]);
  const [form, setForm] = useState(FORM_MAPA_VACIO);
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => { cargar(); }, []);
  const cargar = () => obtenerProcesos().then(setProcesos);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const limpiar = () => { setForm(FORM_MAPA_VACIO); setSeleccionado(null); };

  const guardar = async () => {
    if (!form.Nombre_Proceso.trim()) return;
    const datos = { ...form, Orden_Consecutivo: Number(form.Orden_Consecutivo) };
    seleccionado ? await actualizarProceso(seleccionado, datos) : await crearProceso(datos);
    limpiar(); cargar();
  };

  const borrar = async () => {
    if (!seleccionado) return;
    await eliminarProceso(seleccionado);
    limpiar(); cargar();
  };

  const seleccionar = (p) => {
    setSeleccionado(p.Identificador);
    setForm({ Nombre_Proceso: p.Nombre_Proceso, Tipo_Proceso: p.Tipo_Proceso, Orden_Consecutivo: p.Orden_Consecutivo });
  };

  const porTipo = (tipo) =>
    procesos.filter((p) => p.Tipo_Proceso === tipo).sort((a, b) => a.Orden_Consecutivo - b.Orden_Consecutivo);

  return (
    <div className="rejilla-principal">
      <div className="col-izq-gp">
      <section className="tarjeta panel-form">
        <h3>{seleccionado ? "Editar proceso" : "Nuevo proceso"}</h3>

        <label className="campo">
          <span>Nombre del Proceso</span>
          <input name="Nombre_Proceso" value={form.Nombre_Proceso} onChange={cambiar} placeholder="Ej. Gestión Comercial" />
        </label>

        <label className="campo">
          <span>Tipo de Proceso</span>
          <select name="Tipo_Proceso" value={form.Tipo_Proceso} onChange={cambiar}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        {seleccionado && (
          <label className="campo">
            <span>Orden Consecutivo</span>
            <input type="number" min="1" name="Orden_Consecutivo" value={form.Orden_Consecutivo} onChange={cambiar} />
          </label>
        )}

        <div className="acciones">
          <button className="btn btn-primario" onClick={guardar}>{seleccionado ? "Modificar" : "Guardar"}</button>
          <button className="btn btn-peligro" onClick={borrar} disabled={!seleccionado}>Eliminar</button>
          {seleccionado && <button className="btn btn-fantasma" onClick={limpiar}>Cancelar</button>}
        </div>
      </section>

      <TarjetaCronograma />
      </div>

      <section className="mapa">
        <BandaProcesos titulo="Procesos Estratégicos" tono="estrategico" items={porTipo("Estratégico")} sel={seleccionado} onSel={seleccionar} />

        <div className="banda">
          <div className="banda-encabezado">
            <span className="banda-titulo tono-misional">Procesos Misionales</span>
          </div>
          <div className="fila-tarjetas">
            {porTipo("Misional").length === 0 && <Vacio />}
            {porTipo("Misional").map((p) => (
              <TarjetaProceso key={p.Identificador} p={p} sel={seleccionado} onSel={seleccionar} />
            ))}
          </div>
        </div>

        <BandaProcesos titulo="Procesos de Apoyo" tono="apoyo" items={porTipo("Apoyo")} sel={seleccionado} onSel={seleccionar} />
      </section>
    </div>
  );
}

function BandaProcesos({ titulo, tono, items, sel, onSel }) {
  return (
    <div className="banda">
      <div className="banda-encabezado">
        <span className={`banda-titulo tono-${tono}`}>{titulo}</span>
      </div>
      <div className="fila-tarjetas">
        {items.length === 0 ? <Vacio /> : items.map((p) => (
          <TarjetaProceso key={p.Identificador} p={p} sel={sel} onSel={onSel} />
        ))}
      </div>
    </div>
  );
}

// ─── TARJETA CRONOGRAMA GLOBAL ────────────────────────────────────────────────
const BASE = "http://localhost:8000/api";
const FRECS = [
  { val: "semanal",    label: "Semanal"    },
  { val: "quincenal",  label: "Quincenal"  },
  { val: "mensual",    label: "Mensual"    },
  { val: "bimestral",  label: "Bimestral"  },
  { val: "trimestral", label: "Trimestral" },
  { val: "semestral",  label: "Semestral"  },
  { val: "anual",      label: "Anual"      },
];

const TIPOS_PROC = ["Estratégico", "Misional", "Apoyo"];

function TarjetaCronograma() {
  const [estado, setEstado]         = useState(null);
  const [form, setForm]             = useState({ fecha_inicio: "", fecha_fin: "", frecuencia: "mensual", tipo_proceso: "Misional" });
  const [generando, setGenerando]   = useState(false);
  const [msg, setMsg]               = useState("");
  const [confirmar, setConfirmar]   = useState(false);

  const authHdr = () => ({ Authorization: `Bearer ${localStorage.getItem("sgp_token") || ""}` });

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/indicadores/cronograma-global/`, { headers: authHdr() });
      const d = await r.json();
      setEstado(d);
      if (d.config?.fecha_inicio) setForm(prev => ({
        ...prev,
        fecha_inicio:  d.config.fecha_inicio,
        fecha_fin:     d.config.fecha_fin,
        frecuencia:    d.config.frecuencia    || "mensual",
        tipo_proceso:  d.config.tipo_proceso  || prev.tipo_proceso,
      }));
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const ejecutarGenerar = async () => {
    setConfirmar(false);
    if (!form.fecha_inicio || !form.fecha_fin) { setMsg("error:Define las fechas de inicio y fin."); return; }
    setGenerando(true); setMsg("");
    try {
      const r = await fetch(`${BASE}/indicadores/cronograma-global/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdr() },
        body: JSON.stringify({ ...form, meta_final: 100 }),
      });
      const d = await r.json();
      if (d.error) setMsg(`error:${d.mensaje || "Error al generar."}`);
      else { setEstado(d); setMsg("ok"); }
    } catch { setMsg("error:Error de conexión."); }
    finally { setGenerando(false); }
  };

  const handleGenerar = () => {
    if (!form.fecha_inicio || !form.fecha_fin) { setMsg("error:Define las fechas de inicio y fin."); return; }
    setConfirmar(true);
  };

  const bloqueado = estado?.bloqueado?.[form.tipo_proceso] ?? false;
  const generado  = estado?.generado;
  const errMsg    = msg.startsWith("error:") ? msg.slice(6) : null;

  return (
    <section className="tarjeta crono-tarjeta">

      {/* Cabecera */}
      <div className="crono-cab">
        <div className="crono-cab-icono">📅</div>
        <div>
          <h3 className="crono-titulo">Cronograma del Proyecto</h3>
          <p className="crono-subtitulo">Define el período y frecuencia para todos los indicadores</p>
        </div>
        {generado && (
          <span className={`crono-badge ${bloqueado ? "crono-badge-lock" : "crono-badge-ok"}`}>
            {bloqueado ? "🔒 Bloqueado" : "✓ Activo"}
          </span>
        )}
      </div>

      {/* Alerta bloqueo */}
      {bloqueado && (
        <div className="crono-alerta crono-alerta-lock">
          🔒 El cronograma está bloqueado permanentemente porque ya existen datos de avance registrados.
        </div>
      )}

      {/* Separador */}
      <div className="crono-sep" />

      {/* Campos */}
      <p className="crono-label-sec">Tipo de proceso</p>
      <div className="crono-campos" style={{ gridTemplateColumns: "1fr", marginBottom: 12 }}>
        <label className="campo" style={{ margin: 0 }}>
          <span>Tipo de proceso</span>
          <select name="tipo_proceso" value={form.tipo_proceso || "Misional"}
            onChange={cambiar}>
            {TIPOS_PROC.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <p className="crono-label-sec">¿De cuándo a cuándo va este tipo de proceso?</p>
      <div className="crono-campos">
        <label className="campo">
          <span>Fecha de inicio</span>
          <input type="date" name="fecha_inicio" value={form.fecha_inicio || ""}
            onChange={cambiar} disabled={bloqueado} />
        </label>
        <label className="campo">
          <span>Fecha de fin</span>
          <input type="date" name="fecha_fin" value={form.fecha_fin || ""}
            onChange={cambiar} disabled={bloqueado} />
        </label>
        <label className="campo crono-campo-full">
          <span>Frecuencia de medición</span>
          <select name="frecuencia" value={form.frecuencia || "mensual"}
            onChange={cambiar} disabled={bloqueado}>
            {FRECS.map((f) => <option key={f.val} value={f.val}>{f.label}</option>)}
          </select>
        </label>
      </div>

      <p className="crono-hint-sub">
        Se generan los periodos solo para los procesos <strong>{form.tipo_proceso}</strong> según la frecuencia elegida.
      </p>

      {errMsg && <div className="crono-alerta crono-alerta-err">{errMsg}</div>}

      {!bloqueado && (
        <button className="crono-btn" onClick={handleGenerar} disabled={generando}>
          {generando
            ? <><span className="crono-spin" /> Generando...</>
            : generado ? "↺ Regenerar cronograma" : "Generar cronograma"}
        </button>
      )}

      {/* Modal confirmación */}
      {confirmar && (
        <div className="crono-confirm-fondo">
          <div className="crono-confirm">
            <p className="crono-confirm-txt">
              {generado
                ? <>⚠ <strong>¿Estás seguro?</strong> Se borrarán los periodos actuales de los procesos <strong>{form.tipo_proceso}</strong> y se creará un cronograma nuevo para ellos. Esta acción no se puede deshacer.</>
                : <>¿Confirmas generar el cronograma para todos los procesos <strong>{form.tipo_proceso}</strong> con la configuración seleccionada?</>
              }
            </p>
            <div className="crono-confirm-btns">
              <button className="btn btn-peligro" onClick={ejecutarGenerar}>
                {generado ? "Sí, regenerar" : "Sí, generar"}
              </button>
              <button className="btn btn-fantasma" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const TIPO_COLOR = { "Estratégico": "tp-estrategico", "Misional": "tp-misional", "Apoyo": "tp-apoyo" };

function TarjetaProceso({ p, sel, onSel }) {
  const colorClase = TIPO_COLOR[p.Tipo_Proceso] || "";
  return (
    <article
      className={`tarjeta-proceso ${colorClase} ${sel === p.Identificador ? "activa" : ""}`}
      onClick={() => onSel(p)}
    >
      <span className="badge">{p.Orden_Consecutivo}</span>
      <h4>{p.Nombre_Proceso}</h4>
    </article>
  );
}

// ─── PANEL JERARQUÍA ──────────────────────────────────────────────────────────
const FORM_JERARQUIA_VACIO = { Nombre_Proceso: "", Orden_Consecutivo: 1, objetivo_estrategico: "", accion_estrategica: "" };
const TONO_TIPO = { "Estratégico": "estrategico", "Misional": "misional", "Apoyo": "apoyo" };

function PanelJerarquia() {
  const [tipo, setTipo]           = useState(null);   // null = vista global
  const [ruta, setRuta]           = useState([]);
  const [hijos, setHijos]         = useState([]);
  const [nivel0, setNivel0]       = useState([]);     // todos los procesos nivel 0
  const [form, setForm]           = useState(FORM_JERARQUIA_VACIO);
  const [seleccionado, setSeleccionado] = useState(null);
  const [esMobil, setEsMobil]           = useState(false);

  useEffect(() => {
    const check = () => setEsMobil(window.innerWidth <= 1100);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const padreActual  = ruta.length ? ruta[ruta.length - 1] : null;
  const nivelActual  = padreActual ? padreActual.Nivel + 1 : 0;
  const puedeAgregar = nivelActual <= NIVEL_MAXIMO;
  const etiqueta     = ETIQUETAS_NIVEL[nivelActual] || "Elemento";

  // Carga inicial: todos los procesos nivel 0
  useEffect(() => { cargarNivel0(); }, []);

  // Carga hijos al navegar dentro de un tipo
  useEffect(() => {
    if (tipo) cargarHijos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, padreActual?.Identificador]);

  const cargarNivel0 = () =>
    obtenerHijos(undefined).then(setNivel0);

  const cargarHijos = () =>
    obtenerHijos(padreActual?.Identificador).then((datos) => {
      setHijos(padreActual ? datos : datos.filter((n) => n.Tipo_Proceso === tipo));
      limpiar();
    });

  const porTipo = (t) =>
    nivel0.filter((n) => n.Tipo_Proceso === t).sort((a, b) => a.Orden_Consecutivo - b.Orden_Consecutivo);

  const cambiar  = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const limpiar  = () => { setForm(FORM_JERARQUIA_VACIO); setSeleccionado(null); };

  // Auto-resize textareas del formulario inline
  const ajustarTa = useCallback((e) => {
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, []);

  // Inicializar altura cuando se abre el formulario inline (contenido preexistente)
  useEffect(() => {
    if (!esMobil || !seleccionado) return;
    const timer = setTimeout(() => {
      document.querySelectorAll('.jer-fi textarea').forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [seleccionado, esMobil]);

  // Entrar a los subprocesos de un nodo desde la vista global
  const abrirDesdeGlobal = (nodo) => { setTipo(nodo.Tipo_Proceso); setRuta([nodo]); };

  // Navegar más profundo (ya dentro de un tipo)
  const entrar   = (nodo) => setRuta([...ruta, nodo]);
  const regresar = () => setRuta(ruta.slice(0, -1));

  // Breadcrumb: índice -1 = volver a global, 0 = nivel0 del tipo, n = ruta[n]
  const irA = (idx) => {
    if (idx < 0) { setTipo(null); setRuta([]); setHijos([]); return; }
    setRuta(ruta.slice(0, idx + 1));
  };

  const guardar = async () => {
    if (!form.Nombre_Proceso.trim()) return;
    const datos = {
      Nombre_Proceso: form.Nombre_Proceso,
      Tipo_Proceso: tipo,
      Padre_Id: padreActual?.Identificador || null,
    };
    if (seleccionado) datos.Orden_Consecutivo = Number(form.Orden_Consecutivo);
    if (nivelActual === 0) {
      datos.objetivo_estrategico = form.objetivo_estrategico || "";
      datos.accion_estrategica   = form.accion_estrategica   || "";
    }
    seleccionado ? await actualizarNodo(seleccionado, datos) : await crearNodo(datos);
    cargarHijos(); cargarNivel0();
  };

  const borrar = async () => {
    if (!seleccionado) return;
    if (!window.confirm("Se eliminará este proceso y TODOS sus subprocesos. ¿Continuar?")) return;
    await eliminarNodo(seleccionado);
    cargarHijos(); cargarNivel0();
  };

  // Guardar OEI/AEI desde la vista global (sin navegar al detalle)
  const guardarDesdeGlobal = async () => {
    if (!seleccionado) return;
    const nodo = nivel0.find((n) => n.Identificador === seleccionado);
    if (!nodo) return;
    await actualizarNodo(seleccionado, {
      Nombre_Proceso:       form.Nombre_Proceso || nodo.Nombre_Proceso,
      Tipo_Proceso:         nodo.Tipo_Proceso,
      Orden_Consecutivo:    nodo.Orden_Consecutivo,
      objetivo_estrategico: form.objetivo_estrategico,
      accion_estrategica:   form.accion_estrategica,
    });
    await cargarNivel0();
  };

  const seleccionar = (n) => {
    setSeleccionado(n.Identificador);
    setForm({
      Nombre_Proceso:        n.Nombre_Proceso,
      Orden_Consecutivo:     n.Orden_Consecutivo,
      objetivo_estrategico:  n.objetivo_estrategico || "",
      accion_estrategica:    n.accion_estrategica   || "",
    });
  };

  // ── VISTA GLOBAL: panel izquierdo editable + 3 bandas con timeline ────────
  if (!tipo) {
    const nodoSel = nivel0.find((n) => n.Identificador === seleccionado) || null;

    return (
      <div className="rejilla-principal">

        {/* ── Panel izquierdo: edición de OEI / AEI — solo en escritorio ── */}
        {!esMobil && (
          <section className="tarjeta panel-form jer-panel-fijo">
            {nodoSel ? (
              <>
                <div className="jer-panel-cab">
                  <h3 className="jer-panel-nombre">{nodoSel.Nombre_Proceso}</h3>
                  <span className={`jer-panel-tipo jer-tipo-${(nodoSel.Tipo_Proceso || "").toLowerCase()}`}>
                    {nodoSel.Tipo_Proceso}
                  </span>
                </div>
                <div className="jer-panel-scroll">
                  <label className="campo">
                    <span>Nombre del Proceso</span>
                    <input name="Nombre_Proceso" value={form.Nombre_Proceso} onChange={cambiar} placeholder="Nombre del proceso" />
                  </label>
                  <label className="campo">
                    <span>Objetivo Estratégico Institucional (OEI)</span>
                    <textarea name="objetivo_estrategico" value={form.objetivo_estrategico} onChange={cambiar} rows={4} placeholder="Ej. Fortalecer la gestión institucional…" />
                  </label>
                  <label className="campo">
                    <span>Acción Estratégica Institucional (AEI)</span>
                    <textarea name="accion_estrategica" value={form.accion_estrategica} onChange={cambiar} rows={4} placeholder="Ej. Implementar un sistema de gestión…" />
                  </label>
                </div>
                <div className="jer-panel-acciones">
                  <button className="btn btn-primario jer-panel-btn" onClick={guardarDesdeGlobal}>Guardar</button>
                  <button className="btn btn-peligro jer-panel-btn" onClick={borrar}>Eliminar</button>
                </div>
              </>
            ) : (
              <div className="jer-panel-vacio">
                <div className="jer-panel-vacio-icono">👆</div>
                <p className="jer-panel-vacio-txt">
                  Haz clic en un proceso del mapa para editar su Objetivo Estratégico
                  y Acción Estratégica Institucional.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Bandas del snake timeline ── */}
        <div className="mapa">
          {TIPOS.map((t) => {
            const items = porTipo(t);
            const tono  = TONO_TIPO[t];
            return (
              <div key={t} className="banda">
                <div className="banda-encabezado">
                  <span className={`banda-titulo tono-${tono}`}>Procesos {t}s</span>
                  <span className="contador">{items.length} elemento(s)</span>
                </div>
                {items.length === 0 ? (
                  <p className="vacio">Sin procesos registrados.</p>
                ) : (
                  <SnakeTimeline items={items} tono={tono} renderItem={(n) => (
                    <Fragment key={n.Identificador}>
                      <div
                        className={`jer-paso${seleccionado === n.Identificador ? " jer-paso-activo" : ""}`}
                        onClick={() => seleccionar(n)}
                      >
                        <div className="jer-circulo">{n.Orden_Consecutivo}</div>
                        <article className="jer-card">
                          <h4>{n.Nombre_Proceso}</h4>
                          <span className="jer-nivel-tag">Nivel {n.Nivel}</span>
                          {n.Nivel < NIVEL_MAXIMO && (
                            <button
                              className="jer-btn-abrir"
                              onClick={(e) => { e.stopPropagation(); abrirDesdeGlobal(n); }}
                            >
                              Agregar
                            </button>
                          )}
                        </article>
                      </div>

                      {/* Formulario inline — solo en móvil al seleccionar */}
                      {esMobil && seleccionado === n.Identificador && (
                        <div className="jer-fi">
                          <div className="jer-fi-header">
                            <span className="jer-fi-nombre">{n.Nombre_Proceso}</span>
                            <button className="jer-fi-cerrar" onClick={limpiar}>✕</button>
                          </div>
                          <div className="jer-fi-campos">
                            <label className="campo">
                              <span>OEI — Objetivo Estratégico</span>
                              <textarea name="objetivo_estrategico" value={form.objetivo_estrategico}
                                onChange={cambiar} onInput={ajustarTa} rows={1}
                                style={{ overflow: 'hidden', resize: 'none' }}
                                placeholder="Ej. Fortalecer la gestión…" />
                            </label>
                            <label className="campo">
                              <span>AEI — Acción Estratégica</span>
                              <textarea name="accion_estrategica" value={form.accion_estrategica}
                                onChange={cambiar} onInput={ajustarTa} rows={1}
                                style={{ overflow: 'hidden', resize: 'none' }}
                                placeholder="Ej. Implementar un sistema…" />
                            </label>
                          </div>
                          <div className="jer-fi-btns">
                            <button className="btn btn-primario" onClick={guardarDesdeGlobal}>Guardar</button>
                            <button className="btn btn-peligro" onClick={borrar}>Eliminar</button>
                          </div>
                        </div>
                      )}
                    </Fragment>
                  )} />
                )}
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  // ── VISTA DETALLE: breadcrumb + form + hijos ───────────────────────────────
  return (
    <>
      <div className="barra-navegacion">
        <button className="btn btn-fantasma" onClick={() => irA(-1)}>⟲ Vista general</button>
        {padreActual && <button className="btn btn-secundario" onClick={regresar}>← Regresar</button>}
        <nav className="migas">
          <button className="miga" onClick={() => irA(-1)}>Todos</button>
          <span className="miga-sep">›</span>
          <button className="miga" onClick={() => setRuta([])}>{tipo}s (Nivel 0)</button>
          {ruta.map((n, i) => (
            <span key={n.Identificador}>
              <span className="miga-sep">›</span>
              <button className="miga" onClick={() => irA(i)}>{n.Nombre_Proceso}</button>
            </span>
          ))}
        </nav>
      </div>

      <div className="rejilla-principal">
        <section className="tarjeta panel-form">
          <h3>{seleccionado ? `Editar ${etiqueta}` : `Nuevo ${etiqueta} (Nivel ${nivelActual})`}</h3>

          {!puedeAgregar && (
            <p className="aviso">Nivel máximo alcanzado ({NIVEL_MAXIMO}).</p>
          )}

          <label className="campo">
            <span>Nombre</span>
            <input name="Nombre_Proceso" value={form.Nombre_Proceso} onChange={cambiar}
              placeholder={`Ej. ${etiqueta} de...`} disabled={!puedeAgregar} />
          </label>

          <label className="campo">
            <span>Tipo</span>
            <input value={tipo} disabled />
          </label>

          {seleccionado && (
            <label className="campo">
              <span>Orden</span>
              <input type="number" min="1" name="Orden_Consecutivo" value={form.Orden_Consecutivo}
                onChange={cambiar} disabled={!puedeAgregar} />
            </label>
          )}

          {nivelActual === 0 && (
            <>
              <label className="campo">
                <span>Objetivo Estratégico Institucional</span>
                <textarea name="objetivo_estrategico" value={form.objetivo_estrategico}
                  onChange={cambiar} rows={3} disabled={!puedeAgregar}
                  placeholder="Ej. Fortalecer la gestión institucional…" />
              </label>
              <label className="campo">
                <span>Acción Estratégica Institucional</span>
                <textarea name="accion_estrategica" value={form.accion_estrategica}
                  onChange={cambiar} rows={3} disabled={!puedeAgregar}
                  placeholder="Ej. Implementar un sistema de gestión…" />
              </label>
            </>
          )}

          <div className="acciones">
            <button className="btn btn-primario" onClick={guardar} disabled={!puedeAgregar}>
              {seleccionado ? "Modificar" : "Guardar"}
            </button>
            <button className="btn btn-peligro" onClick={borrar} disabled={!seleccionado}>Eliminar</button>
            {seleccionado && <button className="btn btn-fantasma" onClick={limpiar}>Cancelar</button>}
          </div>
        </section>

        <section className="tarjeta panel-lista">
          <div className="lista-encabezado">
            <h3>{padreActual ? `Subprocesos de "${padreActual.Nombre_Proceso}"` : `Procesos ${tipo}s (Nivel 0)`}</h3>
            <span className="contador">{hijos.length} elemento(s)</span>
          </div>

          {hijos.length === 0 ? (
            <p className="vacio">No hay elementos. Usa el formulario para agregar.</p>
          ) : (
            <SnakeTimeline items={hijos} tono={TONO_TIPO[tipo] || "estrategico"} renderItem={(n) => (
              <div className={`jer-paso${seleccionado === n.Identificador ? " jer-paso-activo" : ""}`}>
                <div className="jer-circulo" onClick={() => seleccionar(n)}>
                  {n.Orden_Consecutivo}
                </div>
                <article className="jer-card" onClick={() => seleccionar(n)}>
                  <h4>{n.Nombre_Proceso}</h4>
                  <span className="jer-nivel-tag">Nivel {n.Nivel}</span>
                  {n.Nivel < NIVEL_MAXIMO && (
                    <button className="jer-btn-abrir" onClick={(e) => { e.stopPropagation(); entrar(n); }}>
                      Agregar
                    </button>
                  )}
                </article>
              </div>
            )} />
          )}
        </section>
      </div>
    </>
  );
}

const Vacio = () => <p className="vacio">Sin procesos registrados.</p>;

// ─── PANEL INVENTARIO — ÁRBOL VERTICAL ───────────────────────────────────────

// Paleta de colores: se asignan dinámicamente según la profundidad real del árbol
const PALETA_ARB = ["#2563EB","#0891B2","#059669","#65A30D","#D97706","#DC2626","#7C3AED"];

const GRUPO_CFG_INV = {
  "Estratégico": { color: "#1e40af", bg: "#f5f7ff", borde: "#2563eb", cnt: "#2563eb" },
  "Misional":    { color: "#166534", bg: "#f0fdf4", borde: "#16a34a", cnt: "#16a34a" },
  "Apoyo":       { color: "#92400e", bg: "#fffbeb", borde: "#d97706", cnt: "#d97706" },
};

function colorPorNivel(nivel, maxNivel) {
  if (maxNivel === 0) return PALETA_ARB[0];
  const idx = Math.round((nivel / maxNivel) * (PALETA_ARB.length - 1));
  return PALETA_ARB[Math.min(idx, PALETA_ARB.length - 1)];
}

function profundidadArbol(nodo) {
  if (!nodo.hijos.length) return 0;
  return 1 + Math.max(...nodo.hijos.map(profundidadArbol));
}

function construirArbol(plano) {
  const byId = {};
  plano.forEach((n) => { byId[n.Identificador] = { ...n, hijos: [] }; });
  const raices = { "Estratégico": [], "Misional": [], "Apoyo": [] };
  plano.forEach((n) => {
    if (n.Padre_Id != null && byId[n.Padre_Id]) {
      byId[n.Padre_Id].hijos.push(byId[n.Identificador]);
    } else if (raices[n.Tipo_Proceso]) {
      raices[n.Tipo_Proceso].push(byId[n.Identificador]);
    }
  });
  const ordenar = (arr) => {
    arr.sort((a, b) => (a.Orden_Consecutivo || 0) - (b.Orden_Consecutivo || 0));
    arr.forEach((n) => ordenar(n.hijos));
  };
  Object.values(raices).forEach(ordenar);
  return raices;
}

function NodoArbol({ nodo, nivel, maxNivel }) {
  const [exp, setExp] = useState(nivel === 0);
  const color = colorPorNivel(nivel, maxNivel);
  const tieneHijos = nodo.hijos.length > 0;

  return (
    <div className="arb-item">
      <div
        className="arb-item-fila"
        style={{ paddingLeft: `${nivel * 30 + 16}px` }}
        onClick={() => tieneHijos && setExp((v) => !v)}
      >
        <div className="arb-item-barra" style={{ background: color }} />
        <div className="arb-item-texto">
          {nodo.codigo && (
            <span className="arb-item-cod" style={{ color }}>{nodo.codigo}</span>
          )}
          <span className="arb-item-nom">{nodo.Nombre_Proceso}</span>
          {tieneHijos && (
            <span className="arb-item-cnt" style={{ color }}>
              · {nodo.hijos.length} elem.
            </span>
          )}
        </div>
        {tieneHijos && (
          <button
            className="arb-toggle-v"
            style={{ color, borderColor: color }}
            onClick={(e) => { e.stopPropagation(); setExp((v) => !v); }}
          >
            {exp ? "▾" : "▸"}
          </button>
        )}
      </div>

      {tieneHijos && exp && (
        <div className="arb-item-hijos" style={{ borderLeftColor: color + "55" }}>
          {nodo.hijos.map((h) => (
            <NodoArbol key={h.Identificador} nodo={h} nivel={nivel + 1} maxNivel={maxNivel} />
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoTipo({ tipo, hijos, maxNivel }) {
  const [exp, setExp] = useState(true);
  const gcfg = GRUPO_CFG_INV[tipo] || GRUPO_CFG_INV["Misional"];
  const total = hijos.length;

  return (
    <div className="arb-grupo" style={{ '--gc': gcfg.borde }}>
      <div
        className="arb-grupo-header"
        style={{ background: gcfg.bg }}
        onClick={() => total > 0 && setExp((v) => !v)}
      >
        <span className="arb-grupo-titulo" style={{ color: gcfg.color }}>
          Procesos {tipo}s
          {total > 0 && (
            <span className="arb-cnt-badge" style={{ color: gcfg.cnt }}>{total}</span>
          )}
        </span>
        {total > 0 && (
          <button
            className="arb-toggle-v arb-toggle-grupo"
            style={{ color: gcfg.cnt, borderColor: gcfg.cnt }}
            onClick={(e) => { e.stopPropagation(); setExp((v) => !v); }}
          >
            {exp ? "▾" : "▸"}
          </button>
        )}
      </div>

      {total > 0 && exp && (
        <div className="arb-grupo-cuerpo">
          {hijos.map((h) => (
            <NodoArbol key={h.Identificador} nodo={h} nivel={0} maxNivel={maxNivel} />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelInventario() {
  const [todos, setTodos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    obtenerInventarioCompleto()
      .then(setTodos)
      .finally(() => setCargando(false));
  }, []);

  const raices = useMemo(() => construirArbol(todos), [todos]);

  const maxNivel = useMemo(() => {
    const todas = [...(raices["Estratégico"] || []), ...(raices["Misional"] || []), ...(raices["Apoyo"] || [])];
    return todas.length ? Math.max(...todas.map(profundidadArbol)) : 0;
  }, [raices]);

  if (cargando) return <div className="inv-cargando">Cargando inventario…</div>;
  if (todos.length === 0) return <div className="inv-vacio">Sin procesos registrados.</div>;

  return (
    <div className="arb-wrap">
      {/* Leyenda de niveles — arriba, colores dinámicos */}
      <div className="arb-leyenda">
        {Array.from({ length: maxNivel + 1 }, (_, i) => (
          <span key={i} className="arb-ley-item">
            <span className="arb-ley-dot" style={{ background: colorPorNivel(i, maxNivel) }} />
            <span style={{ color: colorPorNivel(i, maxNivel), fontWeight: 700 }}>Nivel {i}</span>
          </span>
        ))}
      </div>

      <div className="arb-contenedor">
        {["Estratégico", "Misional", "Apoyo"].map((tipo) => (
          <GrupoTipo key={tipo} tipo={tipo} hijos={raices[tipo] || []} maxNivel={maxNivel} />
        ))}
      </div>
    </div>
  );
}
