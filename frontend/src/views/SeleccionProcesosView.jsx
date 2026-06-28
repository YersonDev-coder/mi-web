// Vista de Inventario: primero se elige un tipo, luego navegación jerárquica tipo carpetas (niveles 0 a 4).
import { useState, useEffect } from "react";
import { obtenerHijos, crearNodo, actualizarNodo, eliminarNodo } from "../services/api";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];
const NIVEL_MAXIMO = 4;
const ETIQUETAS_NIVEL = ["Proceso", "Subproceso", "Subproceso", "Subproceso", "Subproceso"];
const FORM_VACIO = { Nombre_Proceso: "", Orden_Consecutivo: 1 };

export default function SeleccionProcesosView() {
  const [tipo, setTipo] = useState(null);        // null = aún no se elige tipo
  const [ruta, setRuta] = useState([]);          // breadcrumb de ancestros
  const [hijos, setHijos] = useState([]);        // nodos del nivel actual
  const [form, setForm] = useState(FORM_VACIO);
  const [seleccionado, setSeleccionado] = useState(null);

  const padreActual = ruta.length ? ruta[ruta.length - 1] : null;
  const nivelActual = padreActual ? padreActual.Nivel + 1 : 0;
  const puedeAgregar = nivelActual <= NIVEL_MAXIMO;

  useEffect(() => { if (tipo) cargar(); /* eslint-disable-next-line */ }, [tipo, padreActual?.Identificador]);

  const cargar = () =>
    obtenerHijos(padreActual?.Identificador).then((datos) => {
      // En nivel 0 filtramos por el tipo elegido; en subniveles ya todos pertenecen al mismo tipo
      const filtrados = padreActual ? datos : datos.filter((n) => n.Tipo_Proceso === tipo);
      setHijos(filtrados);
      limpiar();
    });

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const limpiar = () => { setForm(FORM_VACIO); setSeleccionado(null); };

  // Cambiar de tipo = reiniciar navegación
  const elegirTipo = (t) => { setTipo(t); setRuta([]); };
  const volverASeleccion = () => { setTipo(null); setRuta([]); setHijos([]); };

  // Entrar a un proceso = ver sus hijos
  const entrar = (nodo) => setRuta([...ruta, nodo]);

  // Regresar un nivel hacia arriba
  const regresar = () => setRuta(ruta.slice(0, -1));

  // Navegar por el breadcrumb (índice -1 = raíz del tipo)
  const navegar = (indice) => setRuta(indice < 0 ? [] : ruta.slice(0, indice + 1));

  const guardar = async () => {
    if (!form.Nombre_Proceso.trim()) return;
    const datos = {
      Nombre_Proceso: form.Nombre_Proceso,
      Orden_Consecutivo: Number(form.Orden_Consecutivo),
      Tipo_Proceso: tipo,                          // todo el árbol pertenece al tipo elegido
      Padre_Id: padreActual?.Identificador || null,
    };
    if (seleccionado) await actualizarNodo(seleccionado, datos);
    else await crearNodo(datos);
    cargar();
  };

  const borrar = async () => {
    if (!seleccionado) return;
    if (!window.confirm("Se eliminará este proceso y TODOS sus subprocesos. ¿Continuar?")) return;
    await eliminarNodo(seleccionado);
    cargar();
  };

  const seleccionar = (n) => {
    setSeleccionado(n.Identificador);
    setForm({ Nombre_Proceso: n.Nombre_Proceso, Orden_Consecutivo: n.Orden_Consecutivo });
  };

  const etiqueta = ETIQUETAS_NIVEL[nivelActual] || "Elemento";

  // ---------- PANTALLA 1: elegir el tipo de proceso ----------
  if (!tipo) {
    return (
      <div className="vista">
        <header className="cabecera-vista">
          <h2>Selección de Procesos</h2>
          <p>Elige primero qué grupo de procesos deseas administrar.</p>
        </header>
        <div className="selector-tipos">
          {TIPOS.map((t) => (
            <button key={t} className={`tarjeta-tipo tono-${t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
              onClick={() => elegirTipo(t)}>
              <span className="tipo-icono">▸</span>
              <h3>Procesos {t}s</h3>
              <p>Ver y administrar la jerarquía de procesos {t.toLowerCase()}s.</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- PANTALLA 2: navegación jerárquica del tipo elegido ----------
  return (
    <div className="vista">
      <header className="cabecera-vista">
        <h2>Procesos {tipo}s</h2>
        <p>Navega por la jerarquía y administra subprocesos por niveles.</p>
      </header>

      {/* Barra de navegación: cambiar tipo + regresar + migas */}
      <div className="barra-navegacion">
        <button className="btn btn-fantasma" onClick={volverASeleccion}>⟲ Cambiar tipo</button>
        {padreActual && (
          <button className="btn btn-secundario" onClick={regresar}>← Regresar</button>
        )}
        <nav className="migas">
          <button className="miga" onClick={() => navegar(-1)}>{tipo}s (Nivel 0)</button>
          {ruta.map((n, i) => (
            <span key={n.Identificador}>
              <span className="miga-sep">›</span>
              <button className="miga" onClick={() => navegar(i)}>{n.Nombre_Proceso}</button>
            </span>
          ))}
        </nav>
      </div>

      <div className="rejilla-principal">
        {/* ---------- FORMULARIO ---------- */}
        <section className="tarjeta panel-form">
          <h3>{seleccionado ? `Editar ${etiqueta}` : `Nuevo ${etiqueta} (Nivel ${nivelActual})`}</h3>

          {!puedeAgregar && (
            <p className="aviso">Has alcanzado el nivel máximo ({NIVEL_MAXIMO}). No se pueden añadir más subniveles.</p>
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
              <span>Orden Consecutivo</span>
              <input type="number" min="1" name="Orden_Consecutivo" value={form.Orden_Consecutivo}
                onChange={cambiar} disabled={!puedeAgregar} />
            </label>
          )}

          <div className="acciones">
            <button className="btn btn-primario" onClick={guardar} disabled={!puedeAgregar}>
              {seleccionado ? "Modificar" : "Guardar"}
            </button>
            <button className="btn btn-peligro" onClick={borrar} disabled={!seleccionado}>Eliminar</button>
            {seleccionado && <button className="btn btn-fantasma" onClick={limpiar}>Cancelar</button>}
          </div>
        </section>

        {/* ---------- LISTA DE NODOS DEL NIVEL ACTUAL ---------- */}
        <section className="tarjeta panel-lista">
          <div className="lista-encabezado">
            <h3>{padreActual ? `Subprocesos de "${padreActual.Nombre_Proceso}"` : `Procesos ${tipo}s (Nivel 0)`}</h3>
            <span className="contador">{hijos.length} elemento(s)</span>
          </div>

          {hijos.length === 0 ? (
            <p className="vacio">No hay elementos en este nivel. Usa el formulario para agregar.</p>
          ) : (
            <div className="fila-tarjetas">
              {hijos.map((n) => (
                <article key={n.Identificador}
                  className={`tarjeta-proceso ${seleccionado === n.Identificador ? "activa" : ""}`}>
                  <div onClick={() => seleccionar(n)}>
                    <span className="badge">#{n.Orden_Consecutivo}</span>
                    <h4>{n.Nombre_Proceso}</h4>
                    <span className="id-proceso">Nivel {n.Nivel}</span>
                  </div>
                  {n.Nivel < NIVEL_MAXIMO && (
                    <button className="btn-entrar" onClick={() => entrar(n)}>Abrir subprocesos →</button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
