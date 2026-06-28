"""Capa de datos del módulo Ficha de Indicador (PostgreSQL).

Reemplaza inventario_indicadores.xlsx y estados_proceso.json. Conserva firmas,
formas de JSON, rangos de ID, generación de cronograma, códigos OES/AES y los
reportes de avance/identificación (tabla A11 Ceplan). Solo cambia el origen de
datos: Excel/JSON → ORM de Django.
"""
import re
import calendar
from datetime import date, timedelta
from collections import defaultdict

from .models import (Indicador, IndRango, IndLogro, IndAvance,
                     IndObjetivo, IndAccion, IndConfig, EstadoProceso)
from apps.inventario_procesos.models import InventarioProceso
from apps.autenticacion.auth import procesos_de_usuario

ESTADOS_VALIDOS = {"en_ejecucion", "mejorar", "terminar"}
INICIAL_TIPO = {"Misional": "M", "Estratégico": "E", "Apoyo": "A"}

# Rangos de ID por entidad (se conservan exactamente).
_BASES = {"indicadores": 0, "rangos": 1000, "logros": 2000, "avance": 3000, "objetivos": 4000, "acciones": 5000}

# Esquema de campos por entidad (para CRUD genérico y serialización).
CAMPOS = {
    "indicadores": ["id_indicador", "id_proceso", "codigo", "nombre_indicador", "tipo",
                    "justificacion", "responsable", "metodo_calculo", "sentido_esperado",
                    "unidad_medida", "frecuencia", "fuente_datos", "periodicidad",
                    "fecha_inicio", "fecha_fin", "meta_final", "tipo_agregacion", "relevancia",
                    "linea_base_anio", "linea_base_valor"],
    "rangos": ["id_rango", "id_indicador", "etiqueta", "color", "desde", "hasta"],
    "logros": ["id_logro", "id_indicador", "periodo", "valor_planificado"],
    "avance": ["id_avance", "id_indicador", "periodo", "valor_real", "fecha_registro"],
    "objetivos": ["id_objetivo", "id_indicador", "codigo", "descripcion", "indicador_texto",
                  "especifico", "relevante", "medible", "realizable", "temporal", "prioridad"],
    "acciones": ["id_accion", "id_objetivo", "id_indicador", "codigo", "descripcion", "indicador_texto",
                 "especifico", "relevante", "medible", "realizable", "temporal", "prioridad"],
}
LLAVES = {"indicadores": "id_indicador", "rangos": "id_rango", "logros": "id_logro",
          "avance": "id_avance", "objetivos": "id_objetivo", "acciones": "id_accion"}
_MODELOS = {"indicadores": Indicador, "rangos": IndRango, "logros": IndLogro,
            "avance": IndAvance, "objetivos": IndObjetivo, "acciones": IndAccion}

RANGOS_DEFAULT = [
    {"etiqueta": "Riesgo Crítico", "color": "rojo",     "desde": 0,  "hasta": 74},
    {"etiqueta": "En Proceso",     "color": "amarillo", "desde": 75, "hasta": 94},
    {"etiqueta": "Óptimo",         "color": "verde",    "desde": 95, "hasta": 100},
]
MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
         "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]


def _obj_a_dict(obj, entidad):
    return {c: getattr(obj, c) for c in CAMPOS[entidad]}


def _sig(entidad):
    """Siguiente ID respetando la base de la entidad (base+1, igual que el original)."""
    Modelo = _MODELOS[entidad]
    llave = LLAVES[entidad]
    ultimo = Modelo.objects.order_by("-" + llave).first()
    return (getattr(ultimo, llave) + 1) if ultimo else _BASES[entidad] + 1


# ---------- ESTADOS DE PROCESO (reemplaza estados_proceso.json) ----------

def _cargar_estados():
    return {str(e.id_proceso): e.estado for e in EstadoProceso.objects.all()}


def obtener_estados_proceso():
    return _cargar_estados()


def actualizar_estado_proceso(id_proceso, estado):
    if estado not in ESTADOS_VALIDOS:
        raise ValueError(f"Estado inválido: {estado}")
    obj, _ = EstadoProceso.objects.update_or_create(
        id_proceso=int(id_proceso), defaults={"estado": estado})
    return {"id_proceso": id_proceso, "estado": estado}


# ---------- ÁRBOL ----------

def arbol(tipo, user_id):
    nodos = list(InventarioProceso.objects.filter(tipo_proceso=tipo, id_usuario=user_id))
    if not nodos:
        return []

    def pid(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    ids_padre = {pid(n) for n in nodos if pid(n) is not None}
    con_ind = set(Indicador.objects.values_list("id_proceso", flat=True))

    def construir(padre_id):
        rama = []
        for n in nodos:
            if pid(n) == padre_id:
                idp = int(n.identificador)
                if idp not in ids_padre:
                    continue
                orden = int(n.orden_consecutivo) if n.orden_consecutivo is not None else 0
                rama.append({
                    "id": idp, "nombre": n.nombre_proceso, "nivel": int(n.nivel),
                    "orden": orden,
                    "tiene_indicadores": idp in con_ind, "hijos": construir(idp),
                })
        return sorted(rama, key=lambda x: x["orden"])

    return construir(None)


# ---------- CÓDIGOS DE PROCESO ----------

def _codigo_proceso(id_proceso):
    objetos = list(InventarioProceso.objects.all())
    indexado = {int(o.identificador): o for o in objetos}
    iid = int(id_proceso)
    if iid not in indexado:
        return ""
    tipo = indexado[iid].tipo_proceso
    inicial = INICIAL_TIPO.get(tipo, "X")

    def _padre(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    def _pos(o):
        padre = _padre(o)
        herm = [x for x in objetos if _padre(x) == padre and x.tipo_proceso == tipo]
        herm.sort(key=lambda x: (x.orden_consecutivo if x.orden_consecutivo is not None else 0, int(x.identificador)))
        for i, h in enumerate(herm, 1):
            if int(h.identificador) == int(o.identificador):
                return i
        return 1

    cadena, actual = [], iid
    while actual in indexado:
        o = indexado[actual]
        cadena.insert(0, _pos(o))
        padre = _padre(o)
        if padre is None:
            break
        actual = padre
    return f"{inicial}-{cadena[0]:02d}" + "".join(f".{n}" for n in cadena[1:])


def _codigo_sugerido(id_proceso, n_indicador):
    base = _codigo_proceso(id_proceso)
    return base if base else f"IND.{n_indicador:02d}"


def _codigo_simple(id_proceso):
    """Código numérico jerárquico ('3', '3.1', '3.1.1'), sin prefijo de tipo."""
    objetos = list(InventarioProceso.objects.all())
    procs = {}
    for o in objetos:
        procs[int(o.identificador)] = {
            "id": int(o.identificador),
            "padre": o.padre_id if o.padre_id not in (None, 0) else None,
            "orden": int(o.orden_consecutivo) if o.orden_consecutivo is not None else 0,
        }
    iid = int(id_proceso)
    if iid not in procs:
        return str(id_proceso)
    cadena, actual = [], iid
    while actual is not None and actual in procs:
        cadena.insert(0, actual)
        actual = procs[actual]["padre"]
    partes = []
    for pid in cadena:
        padre = procs[pid]["padre"]
        hermanos = sorted([p for p in procs.values() if p["padre"] == padre],
                          key=lambda x: (x["orden"], x["id"]))
        rank = next((i + 1 for i, h in enumerate(hermanos) if h["id"] == pid), 1)
        partes.append(str(rank))
    return ".".join(partes)


# ---------- INDICADORES POR PROCESO ----------

def listar_por_proceso(id_proceso):
    return [_obj_a_dict(o, "indicadores") for o in Indicador.objects.filter(id_proceso=int(id_proceso))]


def crear_indicador(id_proceso, datos):
    """Crea un indicador con su semáforo por defecto."""
    nuevo_id = _sig("indicadores")
    n_orden = Indicador.objects.filter(id_proceso=int(id_proceso)).count() + 1
    campos = {"id_indicador": nuevo_id, "id_proceso": int(id_proceso),
              "codigo": datos.get("codigo") or _codigo_sugerido(int(id_proceso), n_orden),
              "periodicidad": datos.get("periodicidad", "anual")}
    for c in CAMPOS["indicadores"]:
        if c not in campos and c not in ("id_indicador", "id_proceso"):
            campos[c] = datos.get(c)
    Indicador.objects.create(**campos)

    # Semáforo por defecto
    base_r = _sig("rangos")
    IndRango.objects.bulk_create([
        IndRango(id_rango=base_r + i, id_indicador=nuevo_id, **r)
        for i, r in enumerate(RANGOS_DEFAULT)
    ])
    return obtener(nuevo_id)


_CAMPOS_FLOAT = {"meta_final", "relevancia"}

def actualizar_indicador(id_indicador, datos):
    obj = Indicador.objects.filter(id_indicador=int(id_indicador)).first()
    if obj is None:
        return None
    for c in CAMPOS["indicadores"]:
        if c not in ("id_indicador", "id_proceso") and c in datos:
            val = datos[c]
            if c in _CAMPOS_FLOAT:
                try:
                    val = float(val) if val not in (None, "", "null") else None
                except (ValueError, TypeError):
                    val = None
            setattr(obj, c, val)
    obj.save()
    return obtener(int(id_indicador))


def eliminar_indicador(id_indicador):
    iid = int(id_indicador)
    if not Indicador.objects.filter(id_indicador=iid).exists():
        return False
    Indicador.objects.filter(id_indicador=iid).delete()
    for Modelo in (IndRango, IndLogro, IndAvance, IndObjetivo, IndAccion):
        Modelo.objects.filter(id_indicador=iid).delete()
    return True


def obtener(id_indicador):
    """Ficha completa: maestros + rangos + logros + avance + objetivos + acciones."""
    iid = int(id_indicador)
    maestro = Indicador.objects.filter(id_indicador=iid).first()
    if maestro and not maestro.codigo:
        maestro.codigo = _codigo_sugerido(int(maestro.id_proceso), 1)
        maestro.save(update_fields=["codigo"])
    rangos = [_obj_a_dict(o, "rangos") for o in IndRango.objects.filter(id_indicador=iid)]
    logros = [_obj_a_dict(o, "logros") for o in IndLogro.objects.filter(id_indicador=iid).order_by("periodo")]
    linea_base = {
        "anio": maestro.linea_base_anio if maestro else None,
        "valor": maestro.linea_base_valor if maestro else None,
    }
    avance = [_obj_a_dict(o, "avance") for o in IndAvance.objects.filter(id_indicador=iid)]
    objetivos = [_obj_a_dict(o, "objetivos") for o in IndObjetivo.objects.filter(id_indicador=iid)]
    acciones = [_obj_a_dict(o, "acciones") for o in IndAccion.objects.filter(id_indicador=iid)]
    meta_final = 100
    tipo_agr = None
    if maestro is not None:
        if maestro.meta_final is not None:
            meta_final = float(maestro.meta_final)
        tipo_agr = maestro.tipo_agregacion
    return {
        "indicador": _obj_a_dict(maestro, "indicadores") if maestro else {"id_indicador": iid},
        "rangos": sorted(rangos, key=lambda x: (x["desde"] if x["desde"] is not None else 0)),
        "logros": logros, "avance": avance, "objetivos": objetivos, "acciones": acciones,
        "linea_base": linea_base,
        "resumen": _resumen(avance, rangos, meta_final, tipo_agr),
    }


def _resumen(avance, rangos, meta_final=100, tipo_agregacion=None):
    """Avance real según tipo_agregacion (suma / último / promedio)."""
    vals = [float(a["valor_real"]) for a in avance if a.get("valor_real") is not None]
    ta = (str(tipo_agregacion) if tipo_agregacion is not None else "").strip().lower()
    if not vals:
        real_acumulado = 0.0
    elif ta in ("último valor", "ultimo valor", "progreso acumulado", "último"):
        real_acumulado = vals[-1]
    elif ta == "promedio":
        real_acumulado = sum(vals) / len(vals)
    else:
        real_acumulado = sum(vals)
    real_acumulado = round(real_acumulado, 1)
    meta = meta_final if meta_final and meta_final > 0 else 100
    pct = round(min(real_acumulado / meta * 100, 100), 1) if meta > 0 else 0
    estado = None
    for r in rangos:
        d = r["desde"] if r["desde"] is not None else 0
        h = r["hasta"] if r["hasta"] is not None else 100
        if d <= pct <= h:
            estado = {"etiqueta": r["etiqueta"], "color": r["color"]}
            break
    return {"meta_final": meta, "valor_actual": real_acumulado, "cumplimiento_pct": pct, "estado": estado}


# ---------- GENERACIÓN DE CRONOGRAMA ----------

def _suma_meses(d, meses):
    m = d.month - 1 + meses
    y = d.year + m // 12
    m = m % 12 + 1
    dia = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, dia)


def generar_cronograma(id_indicador, frecuencia, inicio, fin):
    """Genera los periodos entre dos fechas según la frecuencia."""
    iid = int(id_indicador)

    ind = Indicador.objects.filter(id_indicador=iid).first()
    if ind is not None and ind.id_proceso is not None:
        if _cargar_estados().get(str(int(ind.id_proceso))) == "terminar":
            return {"error": "bloqueado", "mensaje": "El proceso está terminado. El cronograma está congelado."}

    tiene_logros  = IndLogro.objects.filter(id_indicador=iid, es_linea_base=False).exists()
    tiene_avances = IndAvance.objects.filter(id_indicador=iid).exists()
    if tiene_avances and tiene_logros:
        return {"error": "bloqueado", "mensaje": "Ya hay avances registrados. Elimina los avances para poder regenerar el cronograma."}
    if tiene_avances and not tiene_logros:
        # Avances huérfanos (sin cronograma): limpiar y continuar
        IndAvance.objects.filter(id_indicador=iid).delete()

    try:
        d0 = date.fromisoformat(inicio)
        d1 = date.fromisoformat(fin)
    except (ValueError, TypeError):
        return obtener(iid)
    if d1 < d0:
        d0, d1 = d1, d0

    periodos = []
    cursor = d0
    while cursor <= d1:
        if frecuencia == "diaria":
            fin_tramo = cursor
        elif frecuencia == "semanal":
            fin_tramo = cursor + timedelta(days=6)
        elif frecuencia == "quincenal":
            fin_tramo = cursor + timedelta(days=14)
        elif frecuencia == "mensual":
            fin_tramo = _suma_meses(cursor, 1) - timedelta(days=1)
        elif frecuencia == "trimestral":
            fin_tramo = _suma_meses(cursor, 3) - timedelta(days=1)
        elif frecuencia == "anual":
            fin_tramo = _suma_meses(cursor, 12) - timedelta(days=1)
        else:
            fin_tramo = cursor + timedelta(days=6)
        if fin_tramo > d1:
            fin_tramo = d1
        etiqueta = cursor.isoformat() if frecuencia == "diaria" else f"{cursor.isoformat()} → {fin_tramo.isoformat()}"
        periodos.append(etiqueta)
        cursor = fin_tramo + timedelta(days=1)

    IndLogro.objects.filter(id_indicador=iid).delete()
    base = _sig("logros")
    nuevos = [
        IndLogro(id_logro=base + k, id_indicador=iid, periodo=p,
                 es_linea_base=False, valor_planificado=None)
        for k, p in enumerate(periodos)
    ]
    if nuevos:
        IndLogro.objects.bulk_create(nuevos)
    return obtener(iid)


# ---------- PROPAGACIÓN DE CRONOGRAMA A SUBPROCESOS ----------

def propagar_cronograma(id_indicador):
    """Copia los logros (planificado + logrado) del indicador a todos sus subprocesos, excepto el último nivel."""
    from apps.inventario_procesos.models import InventarioProceso
    from django.db.models import Max

    iid = int(id_indicador)
    ind = Indicador.objects.filter(id_indicador=iid).first()
    if ind is None or ind.id_proceso is None:
        return {"error": "not_found", "mensaje": "Indicador no encontrado."}

    logros_origen = list(
        IndLogro.objects.filter(id_indicador=iid, es_linea_base=False).order_by("periodo")
    )
    if not logros_origen:
        return {"error": "sin_datos", "mensaje": "El indicador no tiene cronograma definido."}

    max_nivel = InventarioProceso.objects.aggregate(m=Max("nivel"))["m"] or 0

    def _descendientes(pid):
        hijos = list(InventarioProceso.objects.filter(padre_id=pid).values("identificador", "nivel"))
        result = []
        for h in hijos:
            if h["nivel"] < max_nivel:
                result.append(h["identificador"])
                result.extend(_descendientes(h["identificador"]))
        return result

    ids_desc = _descendientes(int(ind.id_proceso))
    if not ids_desc:
        return {"error": "sin_hijos", "mensaje": "Este proceso no tiene subprocesos para recibir los datos."}

    indicadores_desc = list(
        Indicador.objects.filter(id_proceso__in=ids_desc).values_list("id_indicador", flat=True)
    )
    if not indicadores_desc:
        return {"error": "sin_indicadores", "mensaje": "Los subprocesos no tienen indicadores registrados."}

    # ── Copiar logros (planificado + valor_real del logro) ────────────────────
    IndLogro.objects.filter(id_indicador__in=indicadores_desc, es_linea_base=False).delete()
    base = _sig("logros")
    nuevos_logros = []
    for i, desc_id in enumerate(indicadores_desc):
        for k, logro in enumerate(logros_origen):
            nuevos_logros.append(IndLogro(
                id_logro=base + i * len(logros_origen) + k,
                id_indicador=desc_id,
                periodo=logro.periodo,
                es_linea_base=False,
                valor_planificado=logro.valor_planificado,
            ))
    if nuevos_logros:
        IndLogro.objects.bulk_create(nuevos_logros)

    # ── Copiar avances (% logrado registrado por periodo) ─────────────────────
    avances_origen = list(IndAvance.objects.filter(id_indicador=iid))
    IndAvance.objects.filter(id_indicador__in=indicadores_desc).delete()
    if avances_origen:
        base_av = _sig("avance")
        nuevos_av = []
        for i, desc_id in enumerate(indicadores_desc):
            for k, av in enumerate(avances_origen):
                nuevos_av.append(IndAvance(
                    id_avance=base_av + i * len(avances_origen) + k,
                    id_indicador=desc_id,
                    periodo=av.periodo,
                    valor_real=av.valor_real,
                    fecha_registro=av.fecha_registro,
                ))
        if nuevos_av:
            IndAvance.objects.bulk_create(nuevos_av)

    return {"ok": True, "propagados": len(indicadores_desc), "periodos": len(logros_origen)}


# ---------- CÓDIGOS OES / AES ----------

def _recalcular_codigos(id_indicador):
    """Asigna/actualiza códigos OES y AES de objetivos y acciones de un indicador."""
    iid = int(id_indicador)
    ind = Indicador.objects.filter(id_indicador=iid).first()
    if ind is None or ind.id_proceso is None:
        return
    proc_code = _codigo_simple(int(ind.id_proceso))

    objs = list(IndObjetivo.objects.filter(id_indicador=iid).order_by("id_objetivo"))
    n_objs = len(objs)
    for i, obj in enumerate(objs):
        seq_obj = i + 1
        oes_code = f"OES {proc_code}" if n_objs == 1 else f"OES {proc_code}.{seq_obj}"
        obj.codigo = oes_code
        obj.save(update_fields=["codigo"])

        oes_num = oes_code[4:]
        accs = list(IndAccion.objects.filter(id_objetivo=obj.id_objetivo).order_by("id_accion"))
        for j, acc in enumerate(accs):
            acc.codigo = f"AES {oes_num}.{j + 1}"
            acc.save(update_fields=["codigo"])


def migrar_codigos():
    """Recalcula los códigos OES/AES de TODOS los indicadores existentes."""
    ids_ind = IndObjetivo.objects.values_list("id_indicador", flat=True).distinct()
    for iid in ids_ind:
        if iid is not None:
            _recalcular_codigos(iid)


# ---------- LÍNEA BASE ----------

def actualizar_linea_base(id_indicador, anio, valor):
    iid = int(id_indicador)
    val = float(valor) if valor is not None else 0.0
    anio_str = str(anio).strip() if anio else ""
    anio_int = int(anio_str) if anio_str.isdigit() else None
    Indicador.objects.filter(id_indicador=iid).update(
        linea_base_anio=anio_int, linea_base_valor=val
    )
    return {"id_indicador": iid, "anio": anio, "valor": val}


# ---------- CRUD GENÉRICO ----------

def agregar(hoja, datos):
    Modelo = _MODELOS[hoja]
    llave = LLAVES[hoja]
    nuevo_id = _sig(hoja)
    campos = {c: datos.get(c) for c in CAMPOS[hoja] if c != llave}
    obj = Modelo.objects.create(**{llave: nuevo_id, **campos})
    if hoja in ("objetivos", "acciones"):
        id_ind = datos.get("id_indicador")
        if id_ind is not None:
            _recalcular_codigos(id_ind)
    return _obj_a_dict(obj, hoja)


def editar(hoja, id_fila, datos):
    Modelo = _MODELOS[hoja]
    llave = LLAVES[hoja]
    obj = Modelo.objects.filter(**{llave: int(id_fila)}).first()
    if obj is None:
        return None
    for c in CAMPOS[hoja]:
        if c not in (llave, "id_indicador") and c in datos:
            setattr(obj, c, datos[c])
    obj.save()
    return _obj_a_dict(obj, hoja)


def borrar(hoja, id_fila):
    Modelo = _MODELOS[hoja]
    llave = LLAVES[hoja]
    obj = Modelo.objects.filter(**{llave: int(id_fila)}).first()
    if obj is None:
        return False
    id_ind = getattr(obj, "id_indicador", None) if hoja in ("objetivos", "acciones") else None
    obj.delete()
    if hoja == "objetivos":
        IndAccion.objects.filter(id_objetivo=int(id_fila)).delete()
    if id_ind is not None:
        _recalcular_codigos(id_ind)
    return True


# ---------- REPORTE GENERAL DE AVANCE ----------

def _inicio_periodo(p):
    return str(p).split("→")[0].strip()


def _grupo_codigo(codigo):
    return str(codigo).split(".")[0] if codigo else ""


def _precomputar_codigos(objetos):
    """Códigos jerárquicos de todos los procesos del inventario, por tipo."""
    if not objetos:
        return {}

    def _padre_id(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    codigos = {}
    for tipo, inicial in INICIAL_TIPO.items():
        children = {}
        for o in objetos:
            if o.tipo_proceso != tipo:
                continue
            pid = int(o.identificador)
            padre = _padre_id(o)
            orden = o.orden_consecutivo or 0
            children.setdefault(padre, []).append((orden, pid, o))
        for lst in children.values():
            lst.sort(key=lambda x: (x[0], x[1]))

        def _gen(padre, prefix):
            for i, (_, pid, _o) in enumerate(children.get(padre, []), 1):
                code = f"{inicial}-{i:02d}" if prefix == "" else f"{prefix}.{i}"
                codigos[pid] = code
                _gen(pid, code)
        _gen(None, "")
    return codigos


def reporte_avance(hasta=None, user_id=None):
    """Todos los indicadores con su avance acumulado, filtrado por usuario."""
    qs = InventarioProceso.objects.all()
    if user_id is not None:
        qs = qs.filter(id_usuario=user_id)
    inv = list(qs)
    estados_proc = _cargar_estados()
    codigos_inv = _precomputar_codigos(inv)

    nombres_proc, niveles_proc = {}, {}
    for o in inv:
        pid = int(o.identificador)
        nombres_proc[pid] = o.nombre_proceso
        niveles_proc[pid] = int(o.nivel) if o.nivel is not None else 0
    max_nivel = max(niveles_proc.values()) if niveles_proc else None
    fecha_corte = _inicio_periodo(hasta) if hasta else None

    # Pre-cargar hijas agrupadas por indicador
    logros_by = defaultdict(list)
    for o in IndLogro.objects.all():
        logros_by[o.id_indicador].append(_obj_a_dict(o, "logros"))
    avance_by = defaultdict(list)
    for o in IndAvance.objects.all():
        avance_by[o.id_indicador].append(_obj_a_dict(o, "avance"))
    rangos_by = defaultdict(list)
    for o in IndRango.objects.all():
        rangos_by[o.id_indicador].append(_obj_a_dict(o, "rangos"))

    resultado = []
    for row in Indicador.objects.all():
        iid = int(row.id_indicador)
        try:
            id_proc = int(row.id_proceso) if row.id_proceso is not None else None
        except (ValueError, TypeError):
            id_proc = None
        nivel = niveles_proc.get(id_proc, 0) if id_proc else 0
        if max_nivel is not None and nivel == max_nivel:
            continue
        logros = logros_by.get(iid, [])
        if not logros:
            continue
        avance = avance_by.get(iid, [])
        rangos = rangos_by.get(iid, [])
        meta_final = float(row.meta_final) if row.meta_final is not None else 100.0
        periodos_con_avance = [a for a in avance if a.get("valor_real") is not None]
        if fecha_corte is not None:
            avance_filtrado = [a for a in periodos_con_avance
                               if _inicio_periodo(a.get("periodo") or "") <= fecha_corte]
        else:
            avance_filtrado = periodos_con_avance
        tipo_agr = row.tipo_agregacion
        resumen = _resumen(avance_filtrado, rangos, meta_final, tipo_agr)
        codigo = row.codigo or codigos_inv.get(id_proc, "") or ""

        def _ultimo_con_valor(lista):
            con_valor = [a for a in lista if (a.get("valor_real") or 0) > 0]
            if con_valor:
                return con_valor[-1]["periodo"]
            return lista[-1]["periodo"] if lista else None

        ultimo_real = _ultimo_con_valor(avance_filtrado if fecha_corte is not None else periodos_con_avance)

        resultado.append({
            "id_indicador": iid, "id_proceso": id_proc, "nivel": nivel,
            "nombre_proceso": nombres_proc.get(id_proc, f"Proceso {id_proc}") if id_proc else "Sin proceso",
            "nombre_indicador": row.nombre_indicador or "",
            "codigo": codigo, "grupo": _grupo_codigo(codigo),
            "meta_final": meta_final, "valor_actual": resumen["valor_actual"],
            "cumplimiento_pct": resumen["cumplimiento_pct"], "estado": resumen["estado"],
            "periodos_con_avance": len(periodos_con_avance), "ultimo_periodo": ultimo_real,
            "estado_proceso": estados_proc.get(str(id_proc), "en_ejecucion") if id_proc else "en_ejecucion",
        })

    def _clave(item):
        partes = re.split(r'(\d+)', item.get("codigo") or "")
        return [int(p) if p.isdigit() else p.upper() for p in partes]
    resultado.sort(key=_clave)
    return resultado


def periodos_disponibles(user_id=None):
    qs = IndLogro.objects.exclude(periodo__isnull=True)
    if user_id is not None:
        user_procs = procesos_de_usuario(user_id) if user_id else set()
        ind_ids = list(Indicador.objects.filter(id_proceso__in=user_procs).values_list("id_indicador", flat=True))
        qs = qs.filter(id_indicador__in=ind_ids)
    periodos = list(qs.values_list("periodo", flat=True).distinct())
    periodos = [p for p in periodos if p]
    periodos.sort(key=_inicio_periodo)
    return [str(p) for p in periodos]


# ---------- CONFIG ----------

def obtener_config(clave):
    obj = IndConfig.objects.filter(clave=clave).first()
    return None if obj is None else (None if obj.valor is None else str(obj.valor))


def guardar_config(clave, valor):
    IndConfig.objects.update_or_create(clave=clave, defaults={"valor": valor})


# ---------- CRONOGRAMA GLOBAL ----------

_CLAVES_CRONO = ["crono_inicio", "crono_fin", "crono_frecuencia", "crono_meta", "crono_tipo"]

def _crono_bloqueado(tipo_proceso=None):
    """Bloqueado para un tipo si ya hay avance real en indicadores de ese tipo."""
    from apps.inventario_procesos.models import InventarioProceso
    if tipo_proceso:
        ids_proc = set(
            InventarioProceso.objects.filter(tipo_proceso=tipo_proceso)
            .values_list("identificador", flat=True)
        )
        ids_ind = set(
            Indicador.objects.filter(id_proceso__in=ids_proc)
            .values_list("id_indicador", flat=True)
        )
        return IndAvance.objects.filter(id_indicador__in=ids_ind).exists()
    return IndAvance.objects.exists()

def _total_indicadores_cronograma():
    from django.db.models import Max
    from apps.inventario_procesos.models import InventarioProceso
    max_nivel = InventarioProceso.objects.aggregate(m=Max("nivel"))["m"]
    if max_nivel is not None and max_nivel > 0:
        ids_act = set(InventarioProceso.objects.filter(nivel=max_nivel).values_list("identificador", flat=True))
        ids_validos = InventarioProceso.objects.exclude(identificador__in=ids_act).values_list("identificador", flat=True)
        return Indicador.objects.filter(id_proceso__in=ids_validos).count()
    return Indicador.objects.count()


def obtener_cronograma_global():
    cfg = {c.clave: c.valor for c in IndConfig.objects.filter(clave__in=_CLAVES_CRONO)}
    generado = IndLogro.objects.filter(es_linea_base=False).exists()
    total_periodos = (
        IndLogro.objects.filter(es_linea_base=False)
        .values("periodo").distinct().count()
        if generado else 0
    )
    return {
        "config": {
            "fecha_inicio":  cfg.get("crono_inicio", ""),
            "fecha_fin":     cfg.get("crono_fin", ""),
            "frecuencia":    cfg.get("crono_frecuencia", "mensual"),
            "meta_final":    float(cfg.get("crono_meta") or 100),
            "tipo_proceso":  cfg.get("crono_tipo", "Misional"),
        },
        "generado":          generado,
        "bloqueado":         {t: _crono_bloqueado(t) for t in ("Estratégico", "Misional", "Apoyo")},
        "total_indicadores": _total_indicadores_cronograma(),
        "total_periodos":    total_periodos,
    }

def _asegurar_rangos_todos():
    """Reemplaza TODOS los rangos de todos los indicadores con RANGOS_DEFAULT."""
    todos_ids = list(Indicador.objects.values_list("id_indicador", flat=True))
    if not todos_ids:
        return
    IndRango.objects.all().delete()
    base_r = _sig("rangos")
    nuevos = []
    for j, iid in enumerate(todos_ids):
        for k, r in enumerate(RANGOS_DEFAULT):
            nuevos.append(IndRango(
                id_rango=base_r + j * len(RANGOS_DEFAULT) + k,
                id_indicador=iid,
                **r
            ))
    IndRango.objects.bulk_create(nuevos)


def generar_cronograma_global(fecha_inicio, fecha_fin, frecuencia, meta_final, tipo_proceso=None, user_id=None):
    if _crono_bloqueado(tipo_proceso):
        return {"error": "bloqueado",
                "mensaje": f"El cronograma de procesos {tipo_proceso or ''} está bloqueado: ya existen datos de avance registrados."}
    try:
        d0 = date.fromisoformat(fecha_inicio)
        d1 = date.fromisoformat(fecha_fin)
    except (ValueError, TypeError):
        return {"error": "fechas", "mensaje": "Las fechas no son válidas."}
    if d1 < d0:
        d0, d1 = d1, d0

    # Reutiliza la misma lógica de periodos del cronograma individual
    periodos, cursor = [], d0
    while cursor <= d1:
        if frecuencia == "diaria":
            fin_tramo = cursor
        elif frecuencia == "semanal":
            fin_tramo = cursor + timedelta(days=6)
        elif frecuencia == "quincenal":
            fin_tramo = cursor + timedelta(days=14)
        elif frecuencia == "mensual":
            fin_tramo = _suma_meses(cursor, 1) - timedelta(days=1)
        elif frecuencia == "bimestral":
            fin_tramo = _suma_meses(cursor, 2) - timedelta(days=1)
        elif frecuencia == "trimestral":
            fin_tramo = _suma_meses(cursor, 3) - timedelta(days=1)
        elif frecuencia == "semestral":
            fin_tramo = _suma_meses(cursor, 6) - timedelta(days=1)
        elif frecuencia == "anual":
            fin_tramo = _suma_meses(cursor, 12) - timedelta(days=1)
        else:
            fin_tramo = cursor + timedelta(days=6)
        if fin_tramo > d1:
            fin_tramo = d1
        etiqueta = (cursor.isoformat() if frecuencia == "diaria"
                    else f"{cursor.isoformat()} → {fin_tramo.isoformat()}")
        periodos.append(etiqueta)
        cursor = fin_tramo + timedelta(days=1)

    # Guardar configuración
    guardar_config("crono_inicio",     fecha_inicio)
    guardar_config("crono_fin",        fecha_fin)
    guardar_config("crono_frecuencia", frecuencia)
    guardar_config("crono_meta",       str(meta_final))
    if tipo_proceso:
        guardar_config("crono_tipo", tipo_proceso)

    # Procesos válidos = del tipo seleccionado, excepto el último nivel (actividades)
    from django.db.models import Max
    from apps.inventario_procesos.models import InventarioProceso
    qs_base = InventarioProceso.objects.all()
    if user_id is not None:
        qs_base = qs_base.filter(id_usuario=user_id)
    if tipo_proceso:
        qs_base = qs_base.filter(tipo_proceso=tipo_proceso)
    max_nivel = qs_base.aggregate(m=Max("nivel"))["m"]
    if max_nivel is not None and max_nivel > 0:
        ids_actividades = set(
            qs_base.filter(nivel=max_nivel)
            .values_list("identificador", flat=True)
        )
        ids_procesos_validos = list(
            qs_base.exclude(identificador__in=ids_actividades)
            .values_list("identificador", flat=True)
        )
    else:
        ids_procesos_validos = list(
            qs_base.values_list("identificador", flat=True)
        )

    # Auto-crear Indicador vacío para procesos que no tienen uno aún
    con_indicador = set(
        Indicador.objects.filter(id_proceso__in=ids_procesos_validos)
        .values_list("id_proceso", flat=True)
    )
    sin_indicador = [pid for pid in ids_procesos_validos if pid not in con_indicador]
    if sin_indicador:
        ultimo_id = (Indicador.objects.order_by("-id_indicador").values_list("id_indicador", flat=True).first() or 0)
        nuevos_ind = [
            Indicador(
                id_indicador=ultimo_id + 1 + i,
                id_proceso=pid,
                codigo=_codigo_sugerido(pid, 1),
            )
            for i, pid in enumerate(sin_indicador)
        ]
        Indicador.objects.bulk_create(nuevos_ind)
        # Rangos por defecto para los indicadores recién creados
        base_r = _sig("rangos")
        nuevos_rangos = []
        for j, ind in enumerate(nuevos_ind):
            for k, r in enumerate(RANGOS_DEFAULT):
                nuevos_rangos.append(IndRango(
                    id_rango=base_r + j * len(RANGOS_DEFAULT) + k,
                    id_indicador=ind.id_indicador,
                    **r
                ))
        if nuevos_rangos:
            IndRango.objects.bulk_create(nuevos_rangos)

    # Garantizar rangos para cualquier indicador existente que no tenga ninguno
    _asegurar_rangos_todos()

    # Ahora sí: todos los indicadores de procesos válidos
    indicadores = list(
        Indicador.objects.filter(id_proceso__in=ids_procesos_validos)
        .values_list("id_indicador", flat=True)
    )
    IndLogro.objects.filter(id_indicador__in=indicadores, es_linea_base=False).delete()

    base = _sig("logros")
    nuevos = []
    for i, ind_id in enumerate(indicadores):
        for k, p in enumerate(periodos):
            nuevos.append(IndLogro(
                id_logro=base + i * len(periodos) + k,
                id_indicador=ind_id,
                periodo=p,
                es_linea_base=False,
                valor_planificado=None,
            ))
    if nuevos:
        IndLogro.objects.bulk_create(nuevos)

    return obtener_cronograma_global()


# ---------- REPORTE IDENTIFICACIÓN DE ALERTAS (Tabla A11 Ceplan) ----------

def _rangos_globales():
    """Rangos del primer indicador disponible como referencia común, o los DEFAULT."""
    primer = IndRango.objects.order_by("id_indicador").first()
    if primer is not None:
        rangos_raw = [_obj_a_dict(o, "rangos")
                      for o in IndRango.objects.filter(id_indicador=primer.id_indicador)]
        rangos = sorted(rangos_raw, key=lambda r: r.get("desde") or 0)
        if rangos:
            return [{"id_rango": f"g{i+1}", "etiqueta": r.get("etiqueta", ""),
                     "color": r.get("color", "rojo"), "desde": r.get("desde", 0) or 0,
                     "hasta": r.get("hasta", 100) or 100}
                    for i, r in enumerate(rangos)]
    return [{"id_rango": f"g{i+1}", "etiqueta": r["etiqueta"], "color": r["color"],
             "desde": r["desde"], "hasta": r["hasta"]}
            for i, r in enumerate(RANGOS_DEFAULT)]


def _color_por_rangos(avance, rangos):
    for r in sorted(rangos, key=lambda x: x.get("desde") or 0):
        if (r.get("desde") or 0) <= avance <= (r.get("hasta") or 100):
            return r["color"]
    return (rangos[0]["color"] if rangos else "rojo")


def _avance_tipo_i(vo, le, sentido):
    """Avance Tipo I Ceplan. Ascendente: VO/LE×100. Descendente: LE/VO×100."""
    try:
        vo, le = float(vo or 0), float(le or 0)
    except (TypeError, ValueError):
        return 0
    es_asc = "desc" not in str(sentido or "Ascendente").lower()
    if es_asc:
        if le == 0:
            return 0
        return min(100, max(0, round(vo / le * 100)))
    else:
        if vo == 0:
            return 100
        return min(100, max(0, round(le / vo * 100)))


def _rid_vacio():
    rangos = _rangos_globales()
    cero = {"rojo": 0, "amarillo": 0, "verde": 0}
    return {
        "filas": [], "periodos": [], "rangos": rangos,
        "resumen": {k: dict(cero) for k in ("objetivos", "ind_objetivos", "acciones", "ind_acciones")},
        "alertas": [], "indicador_info": {}, "ult_periodo": "",
    }


def reporte_identificacion(tipo_proceso=None, id_proceso=None, user_id=None):
    """Tabla A11 Ceplan usando OEI/AEI del inventario Nivel 0. OEI→IND→AEI→IND."""
    rangos_globales = _rangos_globales()

    def _color(avance):
        return _color_por_rangos(avance, rangos_globales)

    qs_inv = InventarioProceso.objects.all()
    if user_id is not None:
        qs_inv = qs_inv.filter(id_usuario=user_id)
    inv = list(qs_inv)
    if not inv:
        return _rid_vacio()

    inv_dict = {int(o.identificador): o for o in inv}

    # Determinar tipo si solo viene id_proceso
    tipo_fil = tipo_proceso
    if tipo_fil is None and id_proceso is not None:
        o = inv_dict.get(int(id_proceso))
        if o is not None:
            tipo_fil = o.tipo_proceso

    nivel0 = []
    for o in inv:
        nivel = int(o.nivel) if o.nivel is not None else -1
        if nivel != 0:
            continue
        if tipo_fil and o.tipo_proceso != tipo_fil:
            continue
        oei = o.objetivo_estrategico
        if not oei:
            continue
        aei = o.accion_estrategica or ""
        nivel0.append({"id": int(o.identificador), "oei": str(oei).strip(), "aei": str(aei).strip()})

    if not nivel0:
        return _rid_vacio()

    inds_all = [_obj_a_dict(o, "indicadores") for o in Indicador.objects.all()]
    log_all = [_obj_a_dict(o, "logros") for o in IndLogro.objects.all()]
    av_all = [_obj_a_dict(o, "avance") for o in IndAvance.objects.all()]

    ind_by_proc = defaultdict(list)
    for ind in inds_all:
        pid = ind.get("id_proceso")
        if pid is None:
            continue
        try:
            ind_by_proc[int(pid)].append(ind)
        except (ValueError, TypeError):
            pass

    log_by_ind = defaultdict(list)
    for l in log_all:
        log_by_ind[l["id_indicador"]].append(l)
    av_by_ind = defaultdict(list)
    for a in av_all:
        av_by_ind[a["id_indicador"]].append(a)
    ind_dict_id = {ind["id_indicador"]: ind for ind in inds_all}

    def logros_ind(iid):
        out = {}
        for l in log_by_ind.get(iid, []):
            p = str(l.get("periodo") or "").strip()
            v = l.get("valor_planificado")
            if p and v is not None:
                out[p] = float(v)
        return out

    def avances_ind(iid):
        out = {}
        for av in av_by_ind.get(iid, []):
            p = str(av.get("periodo") or "").strip()
            v = av.get("valor_real")
            if p and v is not None:
                out[p] = float(v)
        return out

    def lb_ind(iid):
        ind = ind_dict_id.get(iid, {})
        anio = ind.get("linea_base_anio")
        valor = ind.get("linea_base_valor")
        return {"anio": anio, "valor": valor}

    children_of = defaultdict(list)
    for iid_inv, o in inv_dict.items():
        padre = o.padre_id
        if padre is not None:
            try:
                children_of[int(padre)].append(iid_inv)
            except (ValueError, TypeError):
                pass

    def get_all_descendants(root_id):
        result, stack = set(), [root_id]
        while stack:
            curr = stack.pop()
            result.add(curr)
            for c in children_of.get(curr, []):
                if c not in result:
                    stack.append(c)
        return result

    def pid_int(v):
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

    all_desc_ids = set()
    for p in nivel0:
        all_desc_ids |= get_all_descendants(p["id"])

    periodos_set = set()
    for ind in inds_all:
        if pid_int(ind.get("id_proceso")) in all_desc_ids:
            iid = ind["id_indicador"]
            periodos_set.update(logros_ind(iid).keys())
            periodos_set.update(avances_ind(iid).keys())
    periodos = sorted(periodos_set, key=_inicio_periodo)

    ult_periodo = None
    for _p in reversed(periodos):
        for _ind in inds_all:
            if pid_int(_ind.get("id_proceso")) in all_desc_ids:
                if logros_ind(_ind["id_indicador"]).get(_p, 0) > 0:
                    ult_periodo = _p
                    break
        if ult_periodo:
            break
    if ult_periodo is None:
        ult_periodo = periodos[-1] if periodos else None

    oei_dict, oei_orden = {}, []
    for p in nivel0:
        oei, aei = p["oei"], p["aei"]
        if oei not in oei_dict:
            oei_dict[oei] = {}
            oei_orden.append(oei)
        if aei not in oei_dict[oei]:
            oei_dict[oei][aei] = []
        oei_dict[oei][aei].append(p["id"])

    cero = {"rojo": 0, "amarillo": 0, "verde": 0}
    resumen = {k: dict(cero) for k in ("objetivos", "ind_objetivos", "acciones", "ind_acciones")}
    filas, alertas_src = [], []

    for oei_idx, oei_text in enumerate(oei_orden, 1):
        aei_grupos = oei_dict[oei_text]
        cod_oei = f"OEI {oei_idx:02d}"
        aei_orden_local = list(aei_grupos.keys())
        oei_inds_all, oei_rows_buf = [], []

        for aei_idx, aei_text in enumerate(aei_orden_local, 1):
            if not aei_text:
                continue
            aei_procs = aei_grupos[aei_text]
            cod_aei = f"AEI {oei_idx:02d}.{aei_idx:02d}"
            aei_inds = []

            for nivel0_id in aei_procs:
                nivel0_row = inv_dict.get(nivel0_id)
                nivel0_nombre = nivel0_row.nombre_proceso if nivel0_row else ""
                desc_ids = get_all_descendants(nivel0_id)

                for desc_pid in sorted(desc_ids):
                    for ind in ind_by_proc.get(desc_pid, []):
                        iid = ind["id_indicador"]
                        log_data = {p: round(v, 2) for p, v in logros_ind(iid).items() if p in periodos_set}
                        if not any(v > 0 for v in log_data.values()):
                            continue
                        av_per = avances_ind(iid)
                        cumul, total_av = {}, 0.0
                        for p in periodos:
                            if p in av_per:
                                total_av += av_per[p]
                            cumul[p] = round(total_av, 2)
                        av_acum = {p: cumul[p] for p in log_data if av_per.get(p, 0) > 0}
                        av_cumul = {p: cumul[p] for p in log_data}
                        ult_ind = next((p for p in reversed(periodos) if log_data.get(p, 0) > 0), None)
                        if not ult_ind:
                            continue
                        vo_last = cumul.get(ult_ind, 0)
                        le_last = log_data[ult_ind]
                        sentido = ind.get("sentido_esperado") or "Ascendente"
                        ati_ind = _avance_tipo_i(vo_last, le_last, sentido)
                        color_ind = _color(ati_ind)
                        lb = lb_ind(iid)
                        try:
                            rel = float(ind.get("relevancia") or 1)
                        except (ValueError, TypeError):
                            rel = 1.0
                        desc_inv = inv_dict.get(desc_pid)
                        nivel_proc = int(desc_inv.nivel) if desc_inv and desc_inv.nivel is not None else 0
                        aei_inds.append({
                            "id_indicador": int(iid), "codigo": ind.get("codigo", ""),
                            "nombre": ind.get("nombre_indicador", ""), "responsable": ind.get("responsable", ""),
                            "sentido": sentido, "tipo_agregacion": ind.get("tipo_agregacion", ""),
                            "relevancia": rel, "lb_anio": lb["anio"], "lb_valor": lb["valor"],
                            "logros": log_data, "avances": av_acum, "av_cumul": av_cumul,
                            "vo": vo_last, "le": le_last, "ati": ati_ind, "color": color_ind,
                            "proc_n0": nivel0_nombre, "nivel_proceso": nivel_proc,
                        })

            if not aei_inds:
                continue

            r_max_aei = max(i["relevancia"] for i in aei_inds)
            pesos_brutos = [r_max_aei - (i["relevancia"] - 1) for i in aei_inds]
            total_peso_aei = sum(pesos_brutos) or len(aei_inds)
            for ind_info, pb in zip(aei_inds, pesos_brutos):
                ind_info["peso"] = round(pb / total_peso_aei, 4)
            ati_aei = round(sum(pb / total_peso_aei * i["ati"] for pb, i in zip(pesos_brutos, aei_inds)), 2)
            color_aei = _color(ati_aei)

            oei_rows_buf.append({"tipo": "accion", "codigo": cod_aei, "descripcion": aei_text,
                                 "avance_tipo_i": ati_aei, "color_ceplan": color_aei})
            for ind_info in aei_inds:
                oei_rows_buf.append({
                    "tipo": "ind_detalle", "id_indicador": ind_info["id_indicador"],
                    "codigo": ind_info["codigo"], "descripcion": ind_info["nombre"],
                    "responsable": ind_info["responsable"], "sentido": ind_info["sentido"],
                    "tipo_agregacion": ind_info["tipo_agregacion"], "relevancia": ind_info["relevancia"],
                    "peso": ind_info["peso"], "lb_anio": ind_info["lb_anio"], "lb_valor": ind_info["lb_valor"],
                    "logros": ind_info["logros"], "avances": ind_info["avances"], "av_cumul": ind_info["av_cumul"],
                    "vo": ind_info["vo"], "le": ind_info["le"],
                    "avance_tipo_i": ind_info["ati"], "color_ceplan": ind_info["color"],
                    "nivel_proceso": ind_info["nivel_proceso"],
                })

            oei_inds_all.extend(aei_inds)
            resumen["acciones"][color_aei] += 1
            for ind_info in aei_inds:
                resumen["ind_acciones"][ind_info["color"]] += 1
            if color_aei != "verde":
                alertas_src.append((cod_aei, aei_text, ati_aei, color_aei, "aei"))
            for col_ord in ("rojo", "amarillo"):
                for ind_info in aei_inds:
                    if ind_info["color"] == col_ord:
                        alertas_src.append((ind_info["codigo"], ind_info["nombre"],
                                            ind_info["ati"], ind_info["color"], "indicador"))

        if not oei_inds_all:
            continue

        r_max_oei = max(i["relevancia"] for i in oei_inds_all)
        pesos_oei = [r_max_oei - (i["relevancia"] - 1) for i in oei_inds_all]
        total_peso_oei = sum(pesos_oei) or len(oei_inds_all)
        ati_oei = round(sum(p / total_peso_oei * i["ati"] for p, i in zip(pesos_oei, oei_inds_all)), 2)
        color_oei = _color(ati_oei)

        filas.append({"tipo": "objetivo", "codigo": cod_oei, "descripcion": oei_text,
                      "avance_tipo_i": ati_oei, "color_ceplan": color_oei})
        filas.extend(oei_rows_buf)
        resumen["objetivos"][color_oei] += 1
        if color_oei != "verde":
            alertas_src.insert(0, (cod_oei, oei_text, ati_oei, color_oei, "oei"))

    alertas = []
    for item in alertas_src:
        c, d, a, col = item[0], item[1], item[2], item[3]
        tipo = item[4] if len(item) > 4 else "indicador"
        alertas.append({
            "codigo": c, "descripcion": d, "avance": a, "color": col, "tipo": tipo,
            "nivel": "Riesgo Crítico" if col == "rojo" else ("En Proceso" if col == "amarillo" else "Óptimo"),
        })
    if not alertas:
        alertas = [{"codigo": None, "descripcion": "Ninguna. Todos los indicadores están en nivel óptimo.",
                    "avance": None, "color": "verde", "tipo": "info", "nivel": "Óptimo"}]

    return {
        "filas": filas, "periodos": periodos, "rangos": rangos_globales,
        "resumen": resumen, "alertas": alertas, "indicador_info": {},
        "ult_periodo": ult_periodo or "",
    }
