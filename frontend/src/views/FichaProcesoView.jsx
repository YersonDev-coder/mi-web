// Módulo Ficha de Proceso: árbol por tipo + ficha editable + vista completa de solo lectura.
import { useState, useEffect } from "react";
import {
  obtenerArbol, obtenerFicha, guardarMaestro,
  agregarDetalle, editarDetalle, borrarDetalle,
} from "../services/api";
import "./FichaProcesoView.css";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];
const MAESTRO_VACIO = { codigo: "", nombre_proceso: "", tipo_proceso: "", dueno_proceso: "", objetivo_general: "", objetivo_estrategico: "" };

export default function FichaProcesoView() {
  const [tipo, setTipo] = useState("Misional");
  const [arbol, setArbol] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [idSel, setIdSel] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [maestro, setMaestro] = useState(MAESTRO_VACIO);
  const [verCompleta, setVerCompleta]   = useState(false);
  const [completando, setCompletando]   = useState(false);
  const [msgIa, setMsgIa]               = useState("");

  useEffect(() => { cargarArbol(); /* eslint-disable-next-line */ }, [tipo]);

  const cargarArbol = () => obtenerArbol(tipo).then(setArbol);
  const alternar = (id) => setExpandidos((e) => ({ ...e, [id]: !e[id] }));

  const seleccionar = (id) => {
    setIdSel(id);
    obtenerFicha(id).then((f) => {
      setFicha(f);
      setMaestro({ ...MAESTRO_VACIO, ...f.proceso });
    });
  };

  const recargarFicha = () => obtenerFicha(idSel).then(setFicha);
  const cambiarMaestro = (e) => setMaestro({ ...maestro, [e.target.name]: e.target.value });

  const guardarDatosMaestros = async () => {
    await guardarMaestro(idSel, maestro);
    await recargarFicha();
    cargarArbol();
  };

  const refrescar = () => { recargarFicha(); cargarArbol(); };

  const completarConIA = async () => {
    if (!idSel) return;
    setCompletando(true);
    setMsgIa("");
    try {
      const r = await fetch(`http://localhost:8000/api/fichas/proceso/${idSel}/completar-ia/`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.error) { setMsgIa(d.error || "Error al completar con IA."); return; }
      const f = d.ficha;
      setFicha(f);
      setMaestro({ ...MAESTRO_VACIO, ...f.proceso });
      cargarArbol();
      setMsgIa("ok");
    } catch {
      setMsgIa("No se pudo conectar con el servidor.");
    } finally {
      setCompletando(false);
    }
  };

  const Nodo = ({ nodo }) => {
    const tieneHijos = nodo.hijos && nodo.hijos.length > 0;
    const abierto = expandidos[nodo.id];
    return (
      <div className="fp-nodo">
        <div className={`fp-nodo-fila ${idSel === nodo.id ? "sel" : ""}`}>
          <span className="fp-toggle" onClick={() => tieneHijos && alternar(nodo.id)}>
            {tieneHijos ? (abierto ? "▼" : "▶") : ""}
          </span>
          <span className={`fp-punto ${nodo.completo ? "verde" : "rojo"}`} title={nodo.completo ? "Completo" : "Faltan datos"} />
          <span className="fp-nodo-nombre" onClick={() => seleccionar(nodo.id)}>{nodo.nombre}</span>
        </div>
        {tieneHijos && abierto && (
          <div className="fp-hijos">{nodo.hijos.map((h) => <Nodo key={h.id} nodo={h} />)}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fp-vista">
      <div className="fp-cabecera">
        <h2>Ficha de Proceso</h2>
        <div className="fp-cabecera-derecha">
          <div className="fp-tabs">
            {TIPOS.map((t) => (
              <button key={t} className={`fp-tab ${tipo === t ? "activo" : ""}`}
                onClick={() => { setTipo(t); setIdSel(null); setFicha(null); }}>
                {t}
              </button>
            ))}
          </div>
          {ficha && (
            <>
              <button
                className="fp-btn fp-btn-ia"
                onClick={completarConIA}
                disabled={completando}
                title="La IA analiza tus indicadores y rellena toda la ficha automáticamente"
              >
                {completando
                  ? <><span className="fp-ia-spin" /> Generando...</>
                  : <><span className="fp-ia-star">✦</span> Completar con IA</>}
              </button>
              <button
                className="fp-btn fp-btn-diagrama"
                onClick={() => window.open(`/diagrama/${idSel}?nombre=${encodeURIComponent(maestro.nombre_proceso || "")}`, "_blank")}
              >
                ◈ Diagrama
              </button>
              <button className="fp-btn fp-btn-ver" onClick={() => setVerCompleta(true)}>
                📄 Ver ficha
              </button>
            </>
          )}
        </div>
      </div>

      {msgIa === "ok" && (
        <div className="fp-ia-bar fp-ia-bar-ok">
          ✓ Ficha completada con IA. Revisa y ajusta los datos según necesites.
          <button onClick={() => setMsgIa("")}>✕</button>
        </div>
      )}
      {msgIa && msgIa !== "ok" && (
        <div className="fp-ia-bar fp-ia-bar-err">
          ⚠ {msgIa}
          <button onClick={() => setMsgIa("")}>✕</button>
        </div>
      )}

      <div className="fp-layout">
        <aside className="fp-arbol">
          <div className="fp-arbol-titulo">Procesos {tipo}s</div>
          {arbol.length === 0
            ? <p className="fp-tabla-vacia">No hay procesos en este tipo.</p>
            : arbol.map((n) => <Nodo key={n.id} nodo={n} />)}
          <div className="fp-leyenda">
            <span><i className="fp-punto verde" /> Completo</span>
            <span><i className="fp-punto rojo" /> Faltan datos</span>
          </div>
        </aside>

        <div className="fp-panel">
          {!ficha ? (
            <div className="fp-vacio-panel">Selecciona un proceso en el árbol para ver y editar su ficha.</div>
          ) : (
            <>
              <SeccionMaestro maestro={maestro} onCambio={cambiarMaestro} onGuardar={guardarDatosMaestros} />
              <SeccionActividades ficha={ficha} idProceso={idSel} onCambio={refrescar} />
              <SeccionSipoc ficha={ficha} idProceso={idSel} onCambio={refrescar} />
              <SeccionRiesgos ficha={ficha} idProceso={idSel} onCambio={refrescar} />
              <SeccionRegistros ficha={ficha} idProceso={idSel} onCambio={refrescar} />
            </>
          )}
        </div>
      </div>

      {verCompleta && ficha && (
        <FichaCompleta ficha={ficha} maestro={maestro} onCerrar={() => setVerCompleta(false)} />
      )}

    </div>
  );
}

function SeccionMaestro({ maestro, onCambio, onGuardar }) {
  return (
    <section className="fp-seccion">
      <div className="fp-seccion-cab"><h3>Datos Maestros</h3></div>
      <div className="fp-grid">
        <label className="fp-campo">
          <span>Código (auto, editable)</span>
          <input name="codigo" value={maestro.codigo || ""} onChange={onCambio} placeholder="Ej. M-03" />
        </label>
        <label className="fp-campo">
          <span>Tipo de Proceso</span>
          <input name="tipo_proceso" value={maestro.tipo_proceso || ""} onChange={onCambio} disabled />
        </label>
        <label className="fp-campo full">
          <span>Nombre del Proceso</span>
          <input name="nombre_proceso" value={maestro.nombre_proceso || ""} onChange={onCambio} />
        </label>
        <label className="fp-campo full">
          <span>Dueño del Proceso</span>
          <input name="dueno_proceso" value={maestro.dueno_proceso || ""} onChange={onCambio} placeholder="Ej. Jefe / Analista de..." />
        </label>
        <label className="fp-campo full">
          <span>Objetivo del Proceso (General)</span>
          <textarea name="objetivo_general" rows="2" value={maestro.objetivo_general || ""} onChange={onCambio} />
        </label>
        <label className="fp-campo full">
          <span>Objetivo Estratégico</span>
          <textarea name="objetivo_estrategico" rows="2" value={maestro.objetivo_estrategico || ""} onChange={onCambio} />
        </label>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="fp-btn fp-btn-primario" onClick={onGuardar}>Guardar Datos Maestros</button>
      </div>
    </section>
  );
}

function SeccionActividades({ ficha, idProceso, onCambio }) {
  const [nuevo, setNuevo] = useState({ descripcion_actividad: "" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const agregar = async () => {
    if (!nuevo.descripcion_actividad.trim()) return;
    const maxOrden = ficha.actividades.length
      ? Math.max(...ficha.actividades.map((a) => a.orden_secuencia || 0))
      : 0;
    await agregarDetalle("actividades", {
      id_proceso: idProceso,
      descripcion_actividad: nuevo.descripcion_actividad,
      orden_secuencia: maxOrden + 1,
    });
    setNuevo({ descripcion_actividad: "" }); onCambio();
  };
  const guardar = async (id) => { await editarDetalle("actividades", id, editVal); setEditId(null); onCambio(); };
  const borrar = async (id) => { if (window.confirm("¿Eliminar actividad?")) { await borrarDetalle("actividades", id); onCambio(); } };

  return (
    <section className="fp-seccion">
      <div className="fp-seccion-cab"><h3>Actividades del Proceso</h3><span className="fp-sub">{ficha.actividades.length} registradas</span></div>
      <table className="fp-tabla">
        <thead><tr><th style={{ width: 70 }}>Orden</th><th>Descripción</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {ficha.actividades.map((a) => (
            <tr key={a.id_actividad}>
              {editId === a.id_actividad ? (
                <>
                  <td><input type="number" defaultValue={a.orden_secuencia} onChange={(e) => setEditVal({ ...editVal, orden_secuencia: Number(e.target.value) })} /></td>
                  <td><input defaultValue={a.descripcion_actividad} onChange={(e) => setEditVal({ ...editVal, descripcion_actividad: e.target.value })} /></td>
                  <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={() => guardar(a.id_actividad)}>OK</button></td>
                </>
              ) : (
                <>
                  <td>{a.orden_secuencia}</td><td>{a.descripcion_actividad}</td>
                  <td className="fp-acciones-fila">
                    <button className="fp-btn-icono fp-btn-editar" onClick={() => { setEditId(a.id_actividad); setEditVal({}); }}>✎</button>
                    <button className="fp-btn-icono fp-btn-borrar" onClick={() => borrar(a.id_actividad)}>🗑</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {ficha.actividades.length === 0 && <tr><td colSpan="3" className="fp-tabla-vacia">Sin actividades.</td></tr>}
          <tr>
            <td></td>
            <td><input placeholder="Nueva actividad..." value={nuevo.descripcion_actividad} onChange={(e) => setNuevo({ ...nuevo, descripcion_actividad: e.target.value })} onKeyDown={(e) => e.key === "Enter" && agregar()} /></td>
            <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={agregar}>+ Añadir</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SeccionSipoc({ ficha, idProceso, onCambio }) {
  const VACIO = { proveedor: "", elemento_entrada: "", producto: "", receptor: "" };
  const [nuevo, setNuevo] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const agregar = async () => {
    if (!nuevo.elemento_entrada.trim() && !nuevo.producto.trim()) return;
    await agregarDetalle("flujo_sipoc", { id_proceso: idProceso, ...nuevo });
    setNuevo(VACIO); onCambio();
  };
  const guardar = async (id) => { await editarDetalle("flujo_sipoc", id, editVal); setEditId(null); onCambio(); };
  const borrar = async (id) => { if (window.confirm("¿Eliminar fila?")) { await borrarDetalle("flujo_sipoc", id); onCambio(); } };

  return (
    <section className="fp-seccion">
      <div className="fp-seccion-cab"><h3>Elementos de Flujo (SIPOC)</h3><span className="fp-sub">{ficha.flujo_sipoc.length} registrados</span></div>
      <table className="fp-tabla">
        <thead><tr><th>Proveedor de entrada</th><th>Elemento de entrada</th><th>Producto</th><th>Receptor del producto</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {ficha.flujo_sipoc.map((f) => (
            <tr key={f.id_flujo}>
              {editId === f.id_flujo ? (
                <>
                  <td><textarea className="fp-ta" defaultValue={f.proveedor} onChange={(e) => setEditVal({ ...editVal, proveedor: e.target.value })} /></td>
                  <td><textarea className="fp-ta" defaultValue={f.elemento_entrada} onChange={(e) => setEditVal({ ...editVal, elemento_entrada: e.target.value })} /></td>
                  <td><textarea className="fp-ta" defaultValue={f.producto} onChange={(e) => setEditVal({ ...editVal, producto: e.target.value })} /></td>
                  <td><textarea className="fp-ta" defaultValue={f.receptor} onChange={(e) => setEditVal({ ...editVal, receptor: e.target.value })} /></td>
                  <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={() => guardar(f.id_flujo)}>OK</button></td>
                </>
              ) : (
                <>
                  <td>{f.proveedor}</td><td>{f.elemento_entrada}</td><td>{f.producto}</td><td>{f.receptor}</td>
                  <td className="fp-acciones-fila">
                    <button className="fp-btn-icono fp-btn-editar" onClick={() => { setEditId(f.id_flujo); setEditVal({}); }}>✎</button>
                    <button className="fp-btn-icono fp-btn-borrar" onClick={() => borrar(f.id_flujo)}>🗑</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {ficha.flujo_sipoc.length === 0 && <tr><td colSpan="5" className="fp-tabla-vacia">Sin elementos de flujo.</td></tr>}
          <tr className="fp-fila-nueva">
            <td><textarea className="fp-ta" placeholder="Proveedor..." value={nuevo.proveedor} onChange={(e) => setNuevo({ ...nuevo, proveedor: e.target.value })} /></td>
            <td><textarea className="fp-ta" placeholder="Entrada..." value={nuevo.elemento_entrada} onChange={(e) => setNuevo({ ...nuevo, elemento_entrada: e.target.value })} /></td>
            <td><textarea className="fp-ta" placeholder="Producto..." value={nuevo.producto} onChange={(e) => setNuevo({ ...nuevo, producto: e.target.value })} /></td>
            <td><textarea className="fp-ta" placeholder="Receptor..." value={nuevo.receptor} onChange={(e) => setNuevo({ ...nuevo, receptor: e.target.value })} /></td>
            <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={agregar}>+ Añadir</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SeccionRiesgos({ ficha, idProceso, onCambio }) {
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const agregar = async () => {
    if (!nuevo.trim()) return;
    await agregarDetalle("riesgos", { id_proceso: idProceso, descripcion_riesgo: nuevo });
    setNuevo(""); onCambio();
  };
  const guardar = async (id) => { await editarDetalle("riesgos", id, { descripcion_riesgo: editVal }); setEditId(null); onCambio(); };
  const borrar = async (id) => { if (window.confirm("¿Eliminar riesgo?")) { await borrarDetalle("riesgos", id); onCambio(); } };

  return (
    <section className="fp-seccion">
      <div className="fp-seccion-cab"><h3>Riesgos del Proceso</h3><span className="fp-sub">{ficha.riesgos.length} registrados</span></div>
      <table className="fp-tabla">
        <thead><tr><th>Descripción del riesgo</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {ficha.riesgos.map((r) => (
            <tr key={r.id_riesgo}>
              {editId === r.id_riesgo ? (
                <>
                  <td><input defaultValue={r.descripcion_riesgo} onChange={(e) => setEditVal(e.target.value)} /></td>
                  <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={() => guardar(r.id_riesgo)}>OK</button></td>
                </>
              ) : (
                <>
                  <td>{r.descripcion_riesgo}</td>
                  <td className="fp-acciones-fila">
                    <button className="fp-btn-icono fp-btn-editar" onClick={() => { setEditId(r.id_riesgo); setEditVal(r.descripcion_riesgo); }}>✎</button>
                    <button className="fp-btn-icono fp-btn-borrar" onClick={() => borrar(r.id_riesgo)}>🗑</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {ficha.riesgos.length === 0 && <tr><td colSpan="2" className="fp-tabla-vacia">Sin riesgos.</td></tr>}
          <tr>
            <td><input placeholder="Nuevo riesgo..." value={nuevo} onChange={(e) => setNuevo(e.target.value)} /></td>
            <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={agregar}>+ Añadir</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SeccionRegistros({ ficha, idProceso, onCambio }) {
  const VACIO = { nombre_titulo: "", tipo: "Digital", caracteristicas: "" };
  const [nuevo, setNuevo] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const agregar = async () => {
    if (!nuevo.nombre_titulo.trim()) return;
    await agregarDetalle("registros", { id_proceso: idProceso, ...nuevo });
    setNuevo(VACIO); onCambio();
  };
  const guardar = async (id) => { await editarDetalle("registros", id, editVal); setEditId(null); onCambio(); };
  const borrar = async (id) => { if (window.confirm("¿Eliminar registro?")) { await borrarDetalle("registros", id); onCambio(); } };

  return (
    <section className="fp-seccion">
      <div className="fp-seccion-cab"><h3>Registros</h3><span className="fp-sub">{ficha.registros.length} registrados</span></div>
      <table className="fp-tabla">
        <thead><tr><th style={{ width: 200 }}>Nombre / Título</th><th style={{ width: 110 }}>Tipo</th><th>Características</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {ficha.registros.map((r) => (
            <tr key={r.id_registro}>
              {editId === r.id_registro ? (
                <>
                  <td><textarea className="fp-ta" defaultValue={r.nombre_titulo} onChange={(e) => setEditVal({ ...editVal, nombre_titulo: e.target.value })} /></td>
                  <td><textarea className="fp-ta" defaultValue={r.tipo} onChange={(e) => setEditVal({ ...editVal, tipo: e.target.value })} /></td>
                  <td><textarea className="fp-ta" defaultValue={r.caracteristicas} onChange={(e) => setEditVal({ ...editVal, caracteristicas: e.target.value })} /></td>
                  <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={() => guardar(r.id_registro)}>OK</button></td>
                </>
              ) : (
                <>
                  <td>{r.nombre_titulo}</td><td>{r.tipo}</td><td>{r.caracteristicas}</td>
                  <td className="fp-acciones-fila">
                    <button className="fp-btn-icono fp-btn-editar" onClick={() => { setEditId(r.id_registro); setEditVal({}); }}>✎</button>
                    <button className="fp-btn-icono fp-btn-borrar" onClick={() => borrar(r.id_registro)}>🗑</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {ficha.registros.length === 0 && <tr><td colSpan="4" className="fp-tabla-vacia">Sin registros.</td></tr>}
          <tr className="fp-fila-nueva">
            <td><textarea className="fp-ta" placeholder="Nombre/Título..." value={nuevo.nombre_titulo} onChange={(e) => setNuevo({ ...nuevo, nombre_titulo: e.target.value })} /></td>
            <td><textarea className="fp-ta" placeholder="Tipo..." value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} /></td>
            <td><textarea className="fp-ta" placeholder="Características..." value={nuevo.caracteristicas} onChange={(e) => setNuevo({ ...nuevo, caracteristicas: e.target.value })} /></td>
            <td className="fp-acciones-fila"><button className="fp-btn fp-btn-mini" onClick={agregar}>+ Añadir</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function FichaCompleta({ ficha, maestro, onCerrar }) {
  const p = maestro;
  return (
    <div className="fp-modal-fondo" onClick={onCerrar}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modal-barra">
          <strong>{p.nombre_proceso || "Ficha de proceso"}</strong>
          <button className="fp-btn fp-btn-mini" onClick={onCerrar}>✕ Cerrar</button>
        </div>
        <div className="fp-doc">
          <div className="fp-doc-titulo">Ficha de producto y proceso</div>

          <table className="fp-doc-tabla">
            <tbody>
              <tr><th className="fp-az">Nombre del proceso</th><td>{p.nombre_proceso}</td><th className="fp-az">Tipo de proceso</th><td>{p.tipo_proceso}</td></tr>
              <tr><th className="fp-az">Dueño del proceso</th><td colSpan="3">{p.dueno_proceso}</td></tr>
              <tr><th className="fp-az">Objetivos del proceso</th><td colSpan="3">{p.objetivo_general}</td></tr>
              <tr><th className="fp-az">Objetivo estratégico</th><td colSpan="3" className="fp-amarillo">{p.objetivo_estrategico}</td></tr>
            </tbody>
          </table>

          <table className="fp-doc-tabla">
            <thead><tr><th className="fp-az">Proveedor de entrada</th><th className="fp-az">Elementos de entrada</th><th className="fp-az">Producto</th><th className="fp-az">Receptor del producto</th></tr></thead>
            <tbody>
              {ficha.flujo_sipoc.map((f) => (
                <tr key={f.id_flujo}><td>{f.proveedor}</td><td>{f.elemento_entrada}</td><td>{f.producto}</td><td>{f.receptor}</td></tr>
              ))}
              {ficha.flujo_sipoc.length === 0 && <tr><td colSpan="4" className="fp-tabla-vacia">—</td></tr>}
            </tbody>
          </table>

          <div className="fp-doc-banda">Actividades del proceso</div>
          <table className="fp-doc-tabla">
            <tbody>
              {[...ficha.actividades].sort((a, b) => a.orden_secuencia - b.orden_secuencia).map((a) => (
                <tr key={a.id_actividad}><th style={{ width: 40 }}>{a.orden_secuencia}</th><td>{a.descripcion_actividad}</td></tr>
              ))}
              {ficha.actividades.length === 0 && <tr><td className="fp-tabla-vacia">—</td></tr>}
            </tbody>
          </table>

          <div className="fp-doc-banda">Riesgos</div>
          <table className="fp-doc-tabla">
            <tbody>
              {ficha.riesgos.map((r) => <tr key={r.id_riesgo}><td>{r.descripcion_riesgo}</td></tr>)}
              {ficha.riesgos.length === 0 && <tr><td className="fp-tabla-vacia">—</td></tr>}
            </tbody>
          </table>

          <div className="fp-doc-banda">Registros</div>
          <table className="fp-doc-tabla">
            <tbody>
              {ficha.registros.map((r) => (
                <tr key={r.id_registro}><th style={{ width: 200 }}>{r.nombre_titulo}</th>
                  <td>Tipo: {r.tipo}<br />Características: {r.caracteristicas}</td></tr>
              ))}
              {ficha.registros.length === 0 && <tr><td className="fp-tabla-vacia">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
