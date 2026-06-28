// Vista principal: gestión CRUD + mapa de procesos empresarial.
import { useState, useEffect } from "react";
import { obtenerProcesos, crearProceso, actualizarProceso, eliminarProceso } from "../services/api";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];
const FORM_VACIO = { Nombre_Proceso: "", Tipo_Proceso: "Misional", Orden_Consecutivo: 1 };

export default function IdentificacionProcesosView() {
  const [procesos, setProcesos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [seleccionado, setSeleccionado] = useState(null); // null = modo creación

  // Carga inicial
  useEffect(() => { cargar(); }, []);
  const cargar = () => obtenerProcesos().then(setProcesos);

  // Estado controlado genérico
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const limpiar = () => { setForm(FORM_VACIO); setSeleccionado(null); };

  // Un solo handler distingue crear vs editar según 'seleccionado'
  const guardar = async () => {
    if (!form.Nombre_Proceso.trim()) return;
    const datos = { ...form, Orden_Consecutivo: Number(form.Orden_Consecutivo) };
    seleccionado ? await actualizarProceso(seleccionado, datos) : await crearProceso(datos);
    limpiar();
    cargar();
  };

  const borrar = async () => {
    if (!seleccionado) return;
    await eliminarProceso(seleccionado);
    limpiar();
    cargar();
  };

  // Al hacer clic en una tarjeta se puebla el formulario para edición rápida
  const seleccionar = (p) => {
    setSeleccionado(p.Identificador);
    setForm({ Nombre_Proceso: p.Nombre_Proceso, Tipo_Proceso: p.Tipo_Proceso, Orden_Consecutivo: p.Orden_Consecutivo });
  };

  // Filtra y ordena por consecutivo para cada banda del mapa
  const porTipo = (tipo) =>
    procesos
      .filter((p) => p.Tipo_Proceso === tipo)
      .sort((a, b) => a.Orden_Consecutivo - b.Orden_Consecutivo);

  return (
    <div className="vista">
      <header className="cabecera-vista">
        <h2>Identificación de Procesos</h2>
        <p>Define y organiza el mapa de procesos de la organización.</p>
      </header>

      <div className="rejilla-principal">
        {/* ---------- FORMULARIO DE GESTIÓN ---------- */}
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
            <button className="btn btn-primario" onClick={guardar}>
              {seleccionado ? "Modificar" : "Guardar"}
            </button>
            <button className="btn btn-peligro" onClick={borrar} disabled={!seleccionado}>Eliminar</button>
            {seleccionado && <button className="btn btn-fantasma" onClick={limpiar}>Cancelar</button>}
          </div>
        </section>

        {/* ---------- MAPA DE PROCESOS EMPRESARIAL ---------- */}
        <section className="mapa">
          <Banda titulo="Procesos Estratégicos" tono="estrategico" items={porTipo("Estratégico")} sel={seleccionado} onSel={seleccionar} />

          <div className="banda banda-misional">
            <div className="banda-encabezado">
              <span className="banda-titulo tono-misional">Procesos Misionales</span>
            </div>
            <div className="fila-tarjetas flujo-horizontal">
              {porTipo("Misional").length === 0 && <Vacio />}
              {porTipo("Misional").map((p, i, arr) => (
                <div key={p.Identificador} className="eslabon">
                  <TarjetaProceso p={p} sel={seleccionado} onSel={seleccionar} />
                  {i < arr.length - 1 && <span className="flecha">→</span>}
                </div>
              ))}
            </div>
          </div>

          <Banda titulo="Procesos de Apoyo" tono="apoyo" items={porTipo("Apoyo")} sel={seleccionado} onSel={seleccionar} />
        </section>
      </div>
    </div>
  );
}

// Banda genérica (Estratégicos / Apoyo)
function Banda({ titulo, tono, items, sel, onSel }) {
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

function TarjetaProceso({ p, sel, onSel }) {
  return (
    <article className={`tarjeta-proceso ${sel === p.Identificador ? "activa" : ""}`} onClick={() => onSel(p)}>
      <span className="badge">#{p.Orden_Consecutivo}</span>
      <h4>{p.Nombre_Proceso}</h4>
      <span className="id-proceso">ID {p.Identificador}</span>
    </article>
  );
}

const Vacio = () => <p className="vacio">Sin procesos registrados.</p>;
