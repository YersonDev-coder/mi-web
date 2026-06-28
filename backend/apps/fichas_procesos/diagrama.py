"""Generador de diagramas: PlantUML (legado) + draw.io con IA."""
import os
import json
import zlib
import base64
import requests
from collections import defaultdict, deque

PLANTUML_SERVER = "https://www.plantuml.com/plantuml/png/"
RUTA_DIAGRAMAS   = os.path.join(os.path.dirname(__file__), "..", "..", "diagramas")

SYSTEM_PROMPT = (
    "Eres un analista de procesos senior, experto en notacion UML y en "
    "diagramas de actividad. Recibes una lista de actividades en lenguaje "
    "natural (texto largo y desordenado) y la transformas en un diagrama de "
    "actividad PlantUML claro, profesional y bien estructurado. Sintetizas "
    "el texto, infieres los puntos de decision, y produces codigo PlantUML "
    "valido y limpio. Respondes EXCLUSIVAMENTE con el codigo, sin "
    "explicaciones, sin comentarios y sin formato markdown."
)

EJEMPLO_FEWSHOT = """--- EJEMPLO DE REFERENCIA ---

Actividades de entrada:
1. Recibir la solicitud del cliente con todos los datos requeridos.
2. Verificar que la documentacion presentada este completa y correcta.
3. Registrar la solicitud en el sistema y asignar un numero de expediente.
4. Aprobar o rechazar la solicitud segun los criterios establecidos.
5. Notificar al cliente el resultado final del tramite.

Salida PlantUML esperada:
@startuml
title Proceso de Atencion de Solicitudes
start
:Recibir solicitud del cliente;
if (¿Documentacion completa?) then (si)
  :Registrar solicitud en sistema;
  :Asignar numero de expediente;
  if (¿Cumple criterios?) then (aprobar)
    :Aprobar solicitud;
  else (rechazar)
    :Rechazar solicitud;
  endif
  :Notificar resultado al cliente;
  stop
else (no)
  :Solicitar correccion al cliente;
  stop
endif
@enduml

--- FIN DEL EJEMPLO ---"""


def _encode_plantuml(texto):
    datos = texto.encode("utf-8")
    comprimido = zlib.compress(datos)[2:-4]
    alfabeto = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
    resultado = ""
    b = comprimido
    for i in range(0, len(b), 3):
        b1, b2, b3 = b[i], b[i+1] if i+1 < len(b) else 0, b[i+2] if i+2 < len(b) else 0
        resultado += (
            alfabeto[(b1 >> 2) & 0x3F] +
            alfabeto[((b1 & 3) << 4 | b2 >> 4) & 0x3F] +
            alfabeto[((b2 & 0xF) << 2 | b3 >> 6) & 0x3F] +
            alfabeto[b3 & 0x3F]
        )
    return resultado


def _descargar_png(codigo_plantuml):
    url = PLANTUML_SERVER + _encode_plantuml(codigo_plantuml)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def construir_prompt(nombre_proceso, actividades):
    """Devuelve el texto del prompt listo para copiar y usar en cualquier IA."""
    lista = "\n".join(f"{a['orden']}. {a['descripcion']}" for a in actividades)
    return f"""{EJEMPLO_FEWSHOT}

Ahora haz lo mismo con el siguiente proceso real.

Proceso: {nombre_proceso}

Actividades de entrada:
{lista}

INSTRUCCIONES (siguelas en este orden):

PASO 1 - ANALIZA. Antes de escribir, clasifica mentalmente cada actividad:
  - Accion simple  -> sera un paso  :accion;
  - Verificacion / validacion / aprobacion / revision de criterios / control
    de calidad -> sera un nodo de decision con dos caminos (if/else).
  Pista: verbos como verificar, validar, aprobar, revisar, controlar,
  comprobar, evaluar casi siempre indican una decision.

PASO 2 - SINTETIZA. Convierte el texto largo de cada actividad en una
  etiqueta corta de accion, de 3 a 6 palabras, empezando con un verbo en
  infinitivo. Elimina relleno. Ejemplo:
  "Revisar el diseno tecnico, reglas de negocio y tareas backend asignadas"
  -> :Revisar diseno tecnico;

PASO 3 - CONSTRUYE LAS DECISIONES. Para cada actividad que clasificaste
  como decision, usa exactamente esta estructura:
      if (condicion?) then (si)
        :que pasa cuando se cumple;
      else (no)
        :accion correctiva o regreso al paso anterior;
      endif
  La rama "no" debe llevar a una accion correctiva real.

PASO 4 - ENSAMBLA el diagrama:
  - Empieza con 'start' y 'title {nombre_proceso}'.
  - Coloca las actividades en su orden logico.
  - Cierra cada camino con 'stop'.

REGLAS DE SINTAXIS PLANTUML:
  - Cada accion:  :texto de la accion;
  - Decisiones:  if (...) then (...) / else (...) / endif
  - No uses notas, colores ni estilos.
  - No dejes ningun if sin su endif.

Responde UNICAMENTE con el codigo entre @startuml y @enduml."""


def generar(id_proceso, nombre_proceso, actividades):
    """
    Llama a DeepSeek para obtener PlantUML, descarga el PNG del servidor
    público y guarda ambos archivos. Devuelve el PNG en base64.
    """
    clave = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not clave or clave == "PON_AQUI_TU_CLAVE":
        raise ValueError(
            "La clave de DeepSeek no está configurada. "
            "Abre el archivo backend/.env, reemplaza PON_AQUI_TU_CLAVE "
            "con tu clave real de https://platform.deepseek.com/ y reinicia el servidor."
        )

    lista = "\n".join(f"{a['orden']}. {a['descripcion']}" for a in actividades)

    prompt = f"""{EJEMPLO_FEWSHOT}

Ahora haz lo mismo con el siguiente proceso real.

Proceso: {nombre_proceso}

Actividades de entrada:
{lista}

INSTRUCCIONES (siguelas en este orden):

PASO 1 - ANALIZA. Antes de escribir, clasifica mentalmente cada actividad:
  - Accion simple  -> sera un paso  :accion;
  - Verificacion / validacion / aprobacion / revision de criterios / control
    de calidad -> sera un nodo de decision con dos caminos (if/else).
  Pista: verbos como verificar, validar, aprobar, revisar, controlar,
  comprobar, evaluar casi siempre indican una decision.

PASO 2 - SINTETIZA. Convierte el texto largo de cada actividad en una
  etiqueta corta de accion, de 3 a 6 palabras, empezando con un verbo en
  infinitivo. Elimina relleno. Ejemplo:
  "Revisar el diseno tecnico, reglas de negocio y tareas backend asignadas"
  -> :Revisar diseno tecnico;

PASO 3 - CONSTRUYE LAS DECISIONES. Para cada actividad que clasificaste
  como decision, usa exactamente esta estructura:
      if (¿condicion?) then (si)
        :que pasa cuando se cumple;
      else (no)
        :accion correctiva o regreso al paso anterior;
      endif
  La rama "no" debe llevar a una accion correctiva real, no a un callejon sin salida.

PASO 4 - ENSAMBLA. Arma el diagrama:
  - Empieza con 'start' y 'title {nombre_proceso}'.
  - Coloca las actividades en su orden logico.
  - Cierra cada camino con 'stop'.
  - El diagrama debe tener al menos un nodo de decision si el proceso lo permite.

REGLAS DE SINTAXIS PLANTUML:
  - Cada accion:  :texto de la accion;
  - Decisiones:  if (...) then (...) / else (...) / endif
  - No uses notas, colores ni estilos; manten el codigo limpio.
  - No dejes ningun if sin su endif.

Responde UNICAMENTE con el codigo entre @startuml y @enduml."""

    headers = {"Authorization": f"Bearer {clave}", "Content-Type": "application/json"}
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1000,
    }
    resp = requests.post("https://api.deepseek.com/chat/completions",
                         headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    codigo = resp.json()["choices"][0]["message"]["content"].strip()
    codigo = codigo.replace("```plantuml", "").replace("```", "").strip()
    if "@startuml" not in codigo:
        codigo = "@startuml\n" + codigo
    if "@enduml" not in codigo:
        codigo += "\n@enduml"

    png_bytes = _descargar_png(codigo)

    os.makedirs(RUTA_DIAGRAMAS, exist_ok=True)
    slug = f"proceso_{id_proceso}"
    with open(os.path.join(RUTA_DIAGRAMAS, f"{slug}.puml"), "w", encoding="utf-8") as f:
        f.write(codigo)
    with open(os.path.join(RUTA_DIAGRAMAS, f"{slug}.png"), "wb") as f:
        f.write(png_bytes)

    return {
        "codigo": codigo,
        "imagen_b64": base64.b64encode(png_bytes).decode("utf-8"),
    }


def cargar_guardado(id_proceso):
    """Devuelve el PNG guardado previamente en base64, o None si no existe."""
    ruta_png = os.path.join(RUTA_DIAGRAMAS, f"proceso_{id_proceso}.png")
    if not os.path.exists(ruta_png):
        return None
    with open(ruta_png, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def cargar_codigo(id_proceso):
    """Devuelve el código PlantUML guardado, o None si no existe."""
    ruta = os.path.join(RUTA_DIAGRAMAS, f"proceso_{id_proceso}.puml")
    if not os.path.exists(ruta):
        return None
    with open(ruta, "r", encoding="utf-8") as f:
        return f.read()


def guardar_manual(id_proceso, codigo):
    """Renderiza el código PlantUML enviado por el usuario y guarda PNG + .puml."""
    codigo = codigo.strip()
    if "@startuml" not in codigo:
        codigo = "@startuml\n" + codigo
    if "@enduml" not in codigo:
        codigo += "\n@enduml"

    png_bytes = _descargar_png(codigo)

    os.makedirs(RUTA_DIAGRAMAS, exist_ok=True)
    slug = f"proceso_{id_proceso}"
    with open(os.path.join(RUTA_DIAGRAMAS, f"{slug}.puml"), "w", encoding="utf-8") as f:
        f.write(codigo)
    with open(os.path.join(RUTA_DIAGRAMAS, f"{slug}.png"), "wb") as f:
        f.write(png_bytes)

    return {
        "codigo": codigo,
        "imagen_b64": base64.b64encode(png_bytes).decode("utf-8"),
    }


def guardar_imagen(id_proceso, imagen_bytes):
    """Guarda una imagen PNG subida directamente por el usuario (sin PlantUML)."""
    os.makedirs(RUTA_DIAGRAMAS, exist_ok=True)
    ruta = os.path.join(RUTA_DIAGRAMAS, f"proceso_{id_proceso}.png")
    with open(ruta, "wb") as f:
        f.write(imagen_bytes)
    return {"imagen_b64": base64.b64encode(imagen_bytes).decode("utf-8")}


def previsualizar(codigo):
    """Renderiza el código PlantUML sin guardar nada. Solo devuelve la imagen."""
    codigo = codigo.strip()
    if "@startuml" not in codigo:
        codigo = "@startuml\n" + codigo
    if "@enduml" not in codigo:
        codigo += "\n@enduml"
    png_bytes = _descargar_png(codigo)
    return base64.b64encode(png_bytes).decode("utf-8")


# ═══════════════════════════════════════════════════════════════════════════════
#  GENERACIÓN draw.io CON IA
# ═══════════════════════════════════════════════════════════════════════════════

_SYSTEM_DRAWIO = (
    "Eres un analista de procesos senior experto en diagramas de flujo profesionales. "
    "Recibes actividades de un proceso y produces un diagrama completo en JSON. "
    "Identificas acciones, decisiones, sistemas/bases de datos, documentos generados "
    "y datos externos. Usas los 8 tipos de nodo disponibles según corresponda. "
    "Respondes EXCLUSIVAMENTE con JSON válido, sin markdown ni texto adicional."
)


def _esc(s):
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


# ── Paleta de estilos vibrantes por tipo de nodo ─────────────────────────────
_ESTILOS = {
    "inicio": (
        "ellipse;whiteSpace=wrap;html=1;"
        "fillColor=#0D9488;strokeColor=#0F766E;strokeWidth=3;"
        "fontColor=#FFFFFF;fontStyle=1;fontSize=13;shadow=1;"
    ),
    "fin": (
        "ellipse;whiteSpace=wrap;html=1;"
        "fillColor=#DC2626;strokeColor=#B91C1C;strokeWidth=3;"
        "fontColor=#FFFFFF;fontStyle=1;fontSize=13;shadow=1;"
    ),
    "actividad": (
        "rounded=1;whiteSpace=wrap;html=1;arcSize=12;"
        "fillColor=#2563EB;strokeColor=#1D4ED8;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=12;fontStyle=1;shadow=1;"
        "gradientColor=#3B82F6;gradientDirection=south;"
    ),
    "decision": (
        "rhombus;whiteSpace=wrap;html=1;"
        "fillColor=#D97706;strokeColor=#B45309;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=11;fontStyle=1;shadow=1;"
    ),
    "base_datos": (
        "shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;"
        "fillColor=#7C3AED;strokeColor=#6D28D9;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=11;fontStyle=1;shadow=1;"
    ),
    "documento": (
        "shape=mxgraph.flowchart.document;whiteSpace=wrap;html=1;"
        "fillColor=#059669;strokeColor=#047857;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=11;shadow=1;"
    ),
    "datos_externos": (
        "parallelogram;whiteSpace=wrap;html=1;perimeter=parallelogramPerimeter;"
        "fillColor=#DB2777;strokeColor=#BE185D;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=11;shadow=1;"
    ),
    "subproceso": (
        "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;"
        "fillColor=#0891B2;strokeColor=#0E7490;strokeWidth=2;"
        "fontColor=#FFFFFF;fontSize=11;shadow=1;"
    ),
}

_ANCHO = {
    "inicio": 130, "fin": 130,
    "actividad": 210, "decision": 190,
    "base_datos": 160, "documento": 160,
    "datos_externos": 180, "subproceso": 210,
}
_ALTO = {
    "inicio": 55, "fin": 55,
    "actividad": 58, "decision": 78,
    "base_datos": 68, "documento": 65,
    "datos_externos": 55, "subproceso": 58,
}

# ── Estilos de aristas ────────────────────────────────────────────────────────
_EDGE_BASE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;"
    "jettySize=auto;html=1;strokeWidth=2.5;"
)
_EDGE_MAIN = _EDGE_BASE + "strokeColor=#475569;fontColor=#1E293B;fontSize=11;fontStyle=1;"
_EDGE_SI   = _EDGE_BASE + "strokeColor=#059669;fontColor=#047857;fontSize=11;fontStyle=1;"
_EDGE_NO   = (
    _EDGE_BASE
    + "strokeColor=#DC2626;fontColor=#B91C1C;fontSize=11;fontStyle=1;"
    + "exitX=1;exitY=0.5;exitDx=0;exitDy=0;"
)
_EDGE_DATA = (
    _EDGE_BASE
    + "strokeColor=#7C3AED;fontColor=#6D28D9;fontSize=10;fontStyle=2;dashed=1;"
)

_TIPOS_DATO = {"base_datos", "documento", "datos_externos"}


def _json_a_drawio_xml(data):
    """Convierte JSON a draw.io XML.

    Estrategia de layout:
    - Nodos de flujo (inicio/actividad/decision/fin/subproceso): columna 0 (izq.)
      o columna 1 (rama No, der.), separados por capas topológicas.
    - Nodos de datos (base_datos/documento/datos_externos): columna derecha fija
      (X=960), posicionados a la misma altura que el nodo de flujo al que se conectan.
      NO participan en el cálculo de capas del flujo → nunca desplazan ni solapan
      los nodos de proceso.
    """
    nodos_map  = {n["id"]: n for n in data.get("nodes", [])}
    conexiones = data.get("conexiones", [])
    titulo     = data.get("titulo", "Diagrama de Proceso")
    all_ids    = list(nodos_map.keys())

    if not all_ids:
        return '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'

    # ── Clasificar nodos ─────────────────────────────────────────────────────
    flow_set = {nid for nid in all_ids
                if nodos_map[nid].get("tipo", "actividad") not in _TIPOS_DATO}
    data_set = set(all_ids) - flow_set
    flow_ids = [nid for nid in all_ids if nid in flow_set]   # orden original

    # ── Grafo de adyacencia completo ─────────────────────────────────────────
    adj_out = defaultdict(list)
    adj_in  = defaultdict(list)
    for e in conexiones:
        adj_out[e["de"]].append((e["a"], e.get("etiqueta", "")))
        adj_in[e["a"]].append((e["de"], e.get("etiqueta", "")))

    # ── Capas topológicas SOLO entre nodos de flujo (Kahn + rotura de ciclos) ──
    # Los ciclos (rama "No" que vuelve atrás) impiden que deg_tmp llegue a 0
    # para esos nodos; se detectan y se les asigna una capa tras sus predecesores.
    flow_in_deg = {
        nid: sum(1 for (fid, _) in adj_in.get(nid, []) if fid in flow_set)
        for nid in flow_ids
    }
    capas      = {nid: 0 for nid in flow_ids}
    deg_tmp    = dict(flow_in_deg)
    cola       = deque(nid for nid in flow_ids if deg_tmp[nid] == 0)
    orden_flow = []
    procesados = set()

    while len(procesados) < len(flow_ids):
        # Fase normal: procesar nodos con grado 0
        while cola:
            nid = cola.popleft()
            if nid in procesados:
                continue
            orden_flow.append(nid)
            procesados.add(nid)
            for (to_id, _) in adj_out.get(nid, []):
                if to_id in flow_set and to_id not in procesados:
                    capas[to_id] = max(capas.get(to_id, 0), capas[nid] + 1)
                    deg_tmp[to_id] -= 1
                    if deg_tmp[to_id] <= 0:
                        cola.append(to_id)

        # Fase de rotura de ciclos: quedan nodos con ciclos
        pendientes = [nid for nid in flow_ids if nid not in procesados]
        if not pendientes:
            break
        # Elegir el nodo con menor grado restante (menos dependencias sin resolver)
        mejor = min(pendientes, key=lambda n: deg_tmp.get(n, 0))
        preds_ok = [capas[fid] for (fid, _) in adj_in.get(mejor, []) if fid in procesados]
        capas[mejor] = (max(preds_ok) + 1) if preds_ok else (max(capas.values(), default=0) + 1)
        cola.append(mejor)

    # ── Columnas de flujo: 0=principal (Sí/neutro), 1=rama No ───────────────
    columnas = {}
    raiz = next(
        (nid for nid in orden_flow if flow_in_deg.get(nid, 0) == 0),
        orden_flow[0] if orden_flow else None
    )
    if raiz:
        pila = [(raiz, 0)]
        while pila:
            nid, col = pila.pop()
            if nid in columnas or nid not in flow_set:
                continue
            columnas[nid] = col
            for (to_id, lbl) in adj_out.get(nid, []):
                if to_id in flow_set and to_id not in columnas:
                    pila.append((to_id, 1 if lbl.lower() == "no" else col))
    for nid in flow_ids:
        if nid not in columnas:
            columnas[nid] = 0

    # ── Posicionar nodos de flujo (sin solapamientos en la misma celda) ──────
    COL_CX    = {0: 380, 1: 720}
    GAP_Y     = 170
    Y0        = 90
    PAD_SLOT  = 40   # espacio extra entre nodos que comparten (col, capa)

    # slot_y_offset acumula el desplazamiento real usando la altura de cada nodo previo
    slot_y_offset = defaultdict(int)
    pos_flow = {}
    for nid in orden_flow:
        col  = columnas.get(nid, 0)
        capa = capas.get(nid, 0)
        slot = (col, capa)
        tipo = nodos_map.get(nid, {}).get("tipo", "actividad")
        w    = _ANCHO.get(tipo, 210)
        h    = _ALTO.get(tipo, 58)
        cx   = COL_CX.get(col, 380)
        x    = cx - w // 2
        y    = Y0 + capa * GAP_Y + slot_y_offset[slot]
        slot_y_offset[slot] += h + PAD_SLOT   # reserva la altura REAL + padding
        pos_flow[nid] = (x, y, w, h)

    # ── Posicionar nodos de datos LATERALMENTE a su nodo de flujo ────────────
    # Se ubican en X=960 (columna derecha), a la misma altura que
    # el nodo de flujo al que se conectan. Nunca afectan el layout vertical.
    DATA_CX = 960
    data_cnt_y = defaultdict(int)   # cuántos nodos de datos ya en esa Y
    pos_data   = {}
    for nid in all_ids:
        if nid not in data_set:
            continue
        tipo = nodos_map.get(nid, {}).get("tipo", "actividad")
        w    = _ANCHO.get(tipo, 160)
        h    = _ALTO.get(tipo, 65)
        # Buscar el nodo de flujo vecino (salida o entrada)
        ref_y = None
        for (to_id, _) in adj_out.get(nid, []):
            if to_id in pos_flow:
                ref_y = pos_flow[to_id][1]
                break
        if ref_y is None:
            for (from_id, _) in adj_in.get(nid, []):
                if from_id in pos_flow:
                    ref_y = pos_flow[from_id][1]
                    break
        if ref_y is None:
            ref_y = Y0
        cnt = data_cnt_y[ref_y]
        data_cnt_y[ref_y] += 1
        pos_data[nid] = (DATA_CX - w // 2, ref_y + cnt * (h + 20), w, h)

    posiciones = {**pos_flow, **pos_data}

    # ── Construir XML ────────────────────────────────────────────────────────
    celdas  = []
    cell_id = 2
    id_map  = {}

    # Título
    celdas.append(
        f'<mxCell id="title0" value="{_esc(titulo)}" '
        f'style="text;html=1;strokeColor=none;fillColor=none;align=center;'
        f'verticalAlign=middle;whiteSpace=wrap;fontSize=16;fontStyle=1;fontColor=#0F172A;" '
        f'vertex="1" parent="1">'
        f'<mxGeometry x="100" y="10" width="960" height="44" as="geometry" /></mxCell>'
    )

    emit_order = orden_flow + [nid for nid in all_ids if nid in data_set]
    for nid in emit_order:
        if nid not in posiciones:
            continue
        nodo = nodos_map[nid]
        tipo = nodo.get("tipo", "actividad")
        x, y, w, h = posiciones[nid]
        est  = _ESTILOS.get(tipo, _ESTILOS["actividad"])
        cid  = str(cell_id)
        id_map[nid] = cid
        celdas.append(
            f'<mxCell id="{cid}" value="{_esc(nodo.get("etiqueta",""))}" '
            f'style="{est}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" /></mxCell>'
        )
        cell_id += 1

    for e in conexiones:
        src = id_map.get(e["de"])
        tgt = id_map.get(e["a"])
        if not src or not tgt:
            continue
        lbl      = e.get("etiqueta", "")
        src_tipo = nodos_map.get(e["de"], {}).get("tipo", "actividad")
        tgt_tipo = nodos_map.get(e["a"],  {}).get("tipo", "actividad")

        # "fin" es un sumidero: nunca puede ser origen de ninguna conexión
        if src_tipo == "fin":
            continue

        if src_tipo in _TIPOS_DATO or tgt_tipo in _TIPOS_DATO:
            est = _EDGE_DATA
        elif lbl.lower() == "no":
            est = _EDGE_NO
        elif lbl.lower() in ("sí", "si"):
            est = _EDGE_SI
        else:
            est = _EDGE_MAIN
        celdas.append(
            f'<mxCell id="{cell_id}" value="{_esc(lbl)}" '
            f'style="{est}" edge="1" source="{src}" target="{tgt}" parent="1">'
            f'<mxGeometry relative="1" as="geometry" /></mxCell>'
        )
        cell_id += 1

    return (
        '<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" '
        'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        'pageWidth="1169" pageHeight="827" math="0" shadow="1">'
        '<root><mxCell id="0" /><mxCell id="1" parent="0" />'
        + ''.join(celdas)
        + '</root></mxGraphModel>'
    )


def generar_drawio(nombre_proceso, actividades):
    """
    Llama a DeepSeek para obtener la estructura JSON del diagrama,
    luego convierte a draw.io XML con layout automático.
    Devuelve {"xml": "..."}.
    """
    clave = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not clave or clave == "PON_AQUI_TU_CLAVE":
        raise ValueError(
            "La clave de DeepSeek no está configurada. "
            "Abre el archivo backend/.env, reemplaza PON_AQUI_TU_CLAVE "
            "con tu clave real de https://platform.deepseek.com/ y reinicia el servidor."
        )

    lista = "\n".join(f"{a['orden']}. {a['descripcion']}" for a in actividades)

    prompt = f"""Analiza el proceso "{nombre_proceso}" y genera un diagrama de flujo completo y detallado.

TIPOS DE NODOS DISPONIBLES (usa los que correspondan al proceso):
- "inicio"         → 1 nodo, etiqueta "Inicio". Óvalo verde.
- "fin"            → 1 nodo, etiqueta "Fin". Óvalo rojo.
- "actividad"      → Acción concreta. Etiqueta corta (verbo + 2-5 palabras). Rectángulo azul.
- "decision"       → Verificación / validación / aprobación / control de calidad.
                      Etiqueta en forma de pregunta "¿...?". Rombo naranja.
                      SIEMPRE exactamente 2 conexiones salientes: "Sí" y "No".
                      La rama "No" lleva a una acción correctiva real.
- "base_datos"     → Sistema informático, base de datos, repositorio o ERP consultado/actualizado.
                      Úsalo cuando el proceso registra o consulta información en un sistema.
                      Etiqueta: nombre del sistema (ej. "Sistema de Gestión", "Repositorio Git").
- "documento"      → Documento, reporte, acta o registro formal que se produce o se recibe.
                      Úsalo cuando el proceso genera un entregable documental.
                      Etiqueta: nombre del documento (ej. "Reporte de Avance", "Acta de Reunión").
- "datos_externos" → Información o recurso proveniente de fuera del proceso.
                      Úsalo cuando hay entradas externas al proceso (cliente, proveedor, otro equipo).
                      Etiqueta: origen o tipo de dato (ej. "Requisitos del Cliente").
- "subproceso"     → Sub-proceso completo llamado internamente.
                      Úsalo cuando una actividad involucra un proceso propio complejo.

REGLAS OBLIGATORIAS:
1. IDs consecutivos: "n1", "n2", "n3", ... en orden de aparición.
2. Todo nodo "decision" tiene EXACTAMENTE 2 conexiones salientes: etiquetas "Sí" y "No".
3. Ningún nodo queda sin conexión de entrada (excepto "inicio") ni sin salida (excepto "fin").
4. El nodo "fin" es un SUMIDERO: NUNCA tiene conexiones salientes. Solo recibe flechas, jamás las envía.
5. SIN CICLOS NI RETROCESOS: La rama "No" de una decisión SIEMPRE avanza hacia nodos que aparecen
   MÁS ADELANTE en el flujo (mayor número de ID) o va directamente al "fin".
   PROHIBIDO conectar "No" hacia un nodo con ID menor (nodo anterior). El flujo siempre avanza.
   Si hay corrección, agregar un nodo nuevo de actividad correctiva → luego avanzar hacia "fin".
6. Los nodos "base_datos", "documento" y "datos_externos" se conectan con flechas a las actividades que los usan.
7. El diagrama debe tener MÍNIMO 10 nodos para ser suficientemente completo.
8. Incluye al menos 1 "decision", y si el proceso usa sistemas agrega al menos 1 "base_datos".

RESPONDE ÚNICAMENTE CON ESTE JSON (sin markdown, sin explicaciones):
{{
  "titulo": "{nombre_proceso}",
  "nodes": [
    {{"id": "n1", "tipo": "inicio",         "etiqueta": "Inicio"}},
    {{"id": "n2", "tipo": "datos_externos", "etiqueta": "Requisitos de entrada"}},
    {{"id": "n3", "tipo": "actividad",      "etiqueta": "Actividad principal"}},
    {{"id": "n4", "tipo": "base_datos",     "etiqueta": "Sistema de registro"}},
    {{"id": "n5", "tipo": "decision",       "etiqueta": "¿Cumple criterios?"}},
    {{"id": "n6", "tipo": "actividad",      "etiqueta": "Acción correctiva"}},
    {{"id": "n7", "tipo": "actividad",      "etiqueta": "Siguiente paso"}},
    {{"id": "n8", "tipo": "documento",      "etiqueta": "Reporte generado"}},
    {{"id": "n9", "tipo": "fin",            "etiqueta": "Fin"}}
  ],
  "conexiones": [
    {{"de": "n1", "a": "n3",  "etiqueta": ""}},
    {{"de": "n2", "a": "n3",  "etiqueta": ""}},
    {{"de": "n3", "a": "n4",  "etiqueta": ""}},
    {{"de": "n4", "a": "n5",  "etiqueta": ""}},
    {{"de": "n5", "a": "n7",  "etiqueta": "Sí"}},
    {{"de": "n5", "a": "n6",  "etiqueta": "No"}},
    {{"de": "n6", "a": "n5",  "etiqueta": ""}},
    {{"de": "n7", "a": "n8",  "etiqueta": ""}},
    {{"de": "n8", "a": "n9",  "etiqueta": ""}}
  ]
}}

ACTIVIDADES DEL PROCESO "{nombre_proceso}":
{lista}"""

    headers = {"Authorization": f"Bearer {clave}", "Content-Type": "application/json"}
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": _SYSTEM_DRAWIO},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.25,
        "max_tokens": 3000,
        "response_format": {"type": "json_object"},
    }
    resp = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers=headers, json=payload, timeout=90
    )
    resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"].strip()
    content = content.replace("```json", "").replace("```", "").strip()

    data = json.loads(content)
    xml  = _json_a_drawio_xml(data)
    return {"xml": xml}


# ── Completador de Ficha completa con IA ────────────────────────────────────

def completar_ficha_con_ia(proceso, jerarquia, hermanos):
    """
    Genera el contenido completo de una ficha de proceso usando DeepSeek.
    Usa solo el árbol de procesos como contexto (indicadores pueden estar vacíos).
    Retorna dict con: maestro, actividades, flujo_sipoc, riesgos, registros.
    """
    clave = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not clave or clave == "PON_AQUI_TU_CLAVE":
        raise ValueError(
            "La clave de DeepSeek no está configurada. "
            "Edita backend/.env con tu clave real y reinicia el servidor."
        )

    nombre  = proceso.get("nombre_proceso", "")
    codigo  = proceso.get("codigo", "")
    tipo    = proceso.get("tipo_proceso", "")
    jer_txt = " > ".join(jerarquia) if jerarquia else nombre
    padre_nombre = jerarquia[-2] if len(jerarquia) >= 2 else tipo

    her_txt = (
        "\n".join(f"  - {h}" for h in hermanos)
        if hermanos else "  (proceso único en este nivel)"
    )

    prompt = f"""Documenta la ficha de proceso completa para "{nombre}".

IDENTIDAD DEL PROCESO:
  Nombre  : {nombre}
  Código  : {codigo}
  Tipo    : {tipo}
  Posición: {jer_txt}

PROCESOS HERMANOS (mismo nivel — definen qué NO cubre "{nombre}"):
{her_txt}
→ "{nombre}" debe ser DIFERENTE y COMPLEMENTARIO a los anteriores.
   No repitas responsabilidades que ya cubren esos procesos hermanos.

════════════════════════════════════════════════════════
REGLA DE ORO: Las 8 secciones cuentan LA MISMA HISTORIA.
  Las actividades → definen QUÉ se hace.
  El SIPOC        → describe CÓMO fluye la información en esas actividades.
  Los riesgos     → son lo que puede fallar EN esas actividades.
  Los registros   → son los documentos que PRODUCEN esas actividades.
  El indicador    → mide el avance de EXACTAMENTE esas actividades.
  Todo debe ser coherente entre sí. Nada inventado por separado.
════════════════════════════════════════════════════════

[1] DUEÑO DEL PROCESO
Cargo específico del responsable de "{nombre}".
✓ Correcto : "Líder de Integración de Componentes", "Arquitecto de Software Senior"
✗ Incorrecto: "Responsable del proceso", "Encargado general"

[2] OBJETIVO GENERAL
2 oraciones como máximo. Debe leerse como un OBJETIVO, no como una descripción.
Primera oración: verbo de logro + qué se logra + criterio de calidad.
Segunda oración (opcional): condición o estándar que debe cumplirse.
✓ Correcto : "Implementar la lógica de negocio definida en el diseño técnico asegurando
              que el código sea funcional, mantenible y validado antes de su integración.
              Cada entregable debe cumplir los estándares de codificación y superar las
              pruebas de aceptación establecidas."
✗ Incorrecto: "Este proceso se encarga de desarrollar el código del sistema. Aplica buenas
               prácticas y sigue los estándares del equipo para que todo funcione bien."
Verbos guía: Garantizar, Asegurar, Implementar, Establecer, Lograr, Ejecutar, Controlar.

[3] OBJETIVO ESTRATÉGICO
2 oraciones como máximo. Cómo "{nombre}" aporta a "{padre_nombre}" y al tipo {tipo}.
Primera oración: contribución concreta al proceso padre.
Segunda oración: impacto en la organización o en la calidad del resultado final.
✓ Correcto : "Contribuir al cumplimiento de los entregables de '{padre_nombre}' asegurando
              que cada módulo implementado sea integrable y cumpla los criterios de aceptación.
              Esto garantiza que el producto final sea robusto, reduciendo defectos en etapas
              posteriores de integración y despliegue."
✗ Incorrecto: "Es importante para la organización porque permite que los módulos funcionen
               y se alineen con los objetivos del área."

[4] ACTIVIDADES (6 a 12 según complejidad de "{nombre}")
• Verbo en infinitivo al inicio de cada actividad.
• Secuencia lógica: cada una tiene sentido después de la anterior.
• 100% específicas — si se pueden copiar a otro proceso, están MAL.
• IMPORTANTE: estas actividades son la base de las secciones 5, 6, 7 y 8.

[5] FLUJO SIPOC (3 a 6 filas — etapas reales de las actividades de [4])
• proveedor      : quién entrega al proceso (área, sistema, proceso previo)
• elemento_entrada: qué documento/dato/recurso concreto entra
• producto       : qué entregable concreto produce esta etapa
• receptor       : quién recibe ese producto
⚠ Los PRODUCTOS del SIPOC deben coincidir con los REGISTROS de [7].

[6] RIESGOS (3 a 6 riesgos directamente relacionados con las actividades de [4])
Formato exacto: "Riesgo de [qué puede fallar] debido a [causa raíz], lo que puede
provocar [consecuencia en el proceso o la organización]."
Tipos: técnicos, de calidad, de tiempo, de datos, humanos, de integración.

[7] REGISTROS (3 a 5 documentos que PRODUCEN las actividades de [4])
• nombre_titulo : nombre exacto del documento (no genérico)
• tipo          : "Digital" o "Físico"
• caracteristicas: formato + sistema de almacenamiento + quién lo revisa + frecuencia
⚠ Estos registros deben ser la FUENTE DE DATOS del indicador [8].

[8] INDICADOR DE AVANCE (1 indicador que mide el % de cumplimiento de "{nombre}")
• nombre_indicador: menciona "{nombre}" o su función clave
• justificacion  : por qué mide fielmente el avance (menciona actividades o entregables
                   concretos de [4] y [5]) — 2-3 oraciones
• responsable    : cargo que reporta este indicador (generalmente el dueño de [1])
• metodo_calculo : fórmula exacta usando variables medibles de las actividades de [4]
                   Ejemplo: "(Módulos integrados / Total planificados) × 100"
• fuente_datos   : debe referenciar los registros de [7] como fuente principal
                   Ejemplo: "Actas de revisión técnica, log del repositorio, reporte de validación"

RESPONDE ÚNICAMENTE CON JSON VÁLIDO (sin markdown, sin texto extra):
{{
  "maestro": {{
    "dueno_proceso": "...",
    "objetivo_general": "...",
    "objetivo_estrategico": "..."
  }},
  "actividades": [
    {{"orden_secuencia": 1, "descripcion_actividad": "..."}},
    {{"orden_secuencia": 2, "descripcion_actividad": "..."}}
  ],
  "flujo_sipoc": [
    {{"proveedor": "...", "elemento_entrada": "...", "producto": "...", "receptor": "..."}}
  ],
  "riesgos": [
    {{"descripcion_riesgo": "..."}}
  ],
  "registros": [
    {{"nombre_titulo": "...", "tipo": "Digital", "caracteristicas": "..."}}
  ],
  "indicador": {{
    "nombre_indicador": "...",
    "justificacion": "...",
    "responsable": "...",
    "metodo_calculo": "...",
    "fuente_datos": "..."
  }}
}}"""

    headers = {"Authorization": f"Bearer {clave}", "Content-Type": "application/json"}
    payload = {
        "model": "deepseek-chat",
        "temperature": 0.2,
        "max_tokens": 4000,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Eres un consultor senior en gestión de procesos bajo ISO 9001:2015 con experiencia "
                    "en ingeniería de procesos y automatización industrial. "
                    "Tu especialidad es crear fichas de proceso donde TODAS las secciones son coherentes "
                    "entre sí: las actividades, el SIPOC, los riesgos, los registros y el indicador "
                    "describen el MISMO proceso con total consistencia interna. "
                    "Nunca produces contenido genérico. Cada ficha es única para el proceso documentado. "
                    "Respondes EXCLUSIVAMENTE con JSON válido y completo, sin texto adicional."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }

    resp = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers=headers, json=payload, timeout=90
    )
    resp.raise_for_status()

    contenido = resp.json()["choices"][0]["message"]["content"].strip()
    contenido = contenido.replace("```json", "").replace("```", "").strip()

    try:
        datos = json.loads(contenido)
    except json.JSONDecodeError as e:
        raise ValueError(f"DeepSeek devolvió JSON inválido: {e}\n{contenido[:300]}")

    for campo in ("maestro", "actividades", "flujo_sipoc", "riesgos", "registros"):
        if campo not in datos:
            raise ValueError(f"El JSON de la IA no contiene el campo requerido: '{campo}'")
    # "indicador" es opcional: si la IA no lo devuelve el guardado lo omite

    return datos
