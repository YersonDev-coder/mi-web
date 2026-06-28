"""Capa de datos del módulo Ficha de Proceso: 5 tablas relacionadas en PostgreSQL.

Reemplaza inventario_fichas.xlsx. Conserva firmas públicas y formas de JSON.
La lógica de árbol, códigos jerárquicos y "proceso completo" se mantiene; solo
cambia el origen de los datos (Excel → ORM).
"""
from .models import FichaProceso, FichaActividad, FichaFlujoSipoc, FichaRiesgo, FichaRegistro
from apps.inventario_procesos.models import InventarioProceso

# Esquema de cada "hoja" (ahora tabla). Se conserva para el CRUD genérico.
HOJAS = {
    "procesos": ["id_proceso", "codigo", "nombre_proceso", "tipo_proceso", "dueno_proceso", "objetivo_general", "objetivo_estrategico"],
    "actividades": ["id_actividad", "id_proceso", "orden_secuencia", "descripcion_actividad"],
    "flujo_sipoc": ["id_flujo", "id_proceso", "proveedor", "elemento_entrada", "producto", "receptor"],
    "riesgos": ["id_riesgo", "id_proceso", "descripcion_riesgo"],
    "registros": ["id_registro", "id_proceso", "nombre_titulo", "tipo", "caracteristicas"],
}
LLAVES = {"procesos": "id_proceso", "actividades": "id_actividad", "flujo_sipoc": "id_flujo", "riesgos": "id_riesgo", "registros": "id_registro"}
_BASES = {"actividades": 100, "flujo_sipoc": 500, "riesgos": 700, "registros": 900}
INICIAL_TIPO = {"Misional": "M", "Estratégico": "E", "Apoyo": "A"}

# Mapa hoja → (Modelo, llave_pk)
_MODELOS = {
    "actividades": (FichaActividad, "id_actividad"),
    "flujo_sipoc": (FichaFlujoSipoc, "id_flujo"),
    "riesgos": (FichaRiesgo, "id_riesgo"),
    "registros": (FichaRegistro, "id_registro"),
}


def _obj_a_dict(obj, campos):
    """Convierte un objeto del modelo a dict usando los nombres de campo de la hoja."""
    return {c: getattr(obj, c) for c in campos}


def _siguiente_id(Modelo, llave, base):
    """Siguiente ID respetando el rango base del módulo (100, 500, 700, 900)."""
    ultimo = Modelo.objects.order_by("-" + llave).first()
    return (getattr(ultimo, llave) + 1) if ultimo else base


# ---------- ÁRBOL DE PROCESOS (desde inventario_proceso) ----------

def arbol(tipo, user_id):
    """Árbol jerárquico del usuario de un tipo, excluyendo las hojas finales."""
    nodos = list(InventarioProceso.objects.filter(tipo_proceso=tipo, id_usuario=user_id))
    if not nodos:
        return []

    def pid(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    ids_padre = {pid(n) for n in nodos if pid(n) is not None}
    completos = _ids_completos()

    def construir(padre_id):
        rama = []
        for n in nodos:
            if pid(n) == padre_id:
                idp = int(n.identificador)
                if idp not in ids_padre:   # hoja final → excluida
                    continue
                orden = int(n.orden_consecutivo) if n.orden_consecutivo is not None else 0
                rama.append({
                    "id": idp, "nombre": n.nombre_proceso, "nivel": int(n.nivel),
                    "orden": orden,
                    "completo": idp in completos, "hijos": construir(idp),
                })
        return sorted(rama, key=lambda x: x["orden"])

    return construir(None)


def _ids_completos():
    """Ids con datos maestros + ≥1 actividad + ≥1 flujo SIPOC + ≥1 registro + ≥1 riesgo."""
    completos = set()
    # ids que tienen al menos un registro en cada tabla hija
    con_act = set(FichaActividad.objects.values_list("id_proceso", flat=True))
    con_flujo = set(FichaFlujoSipoc.objects.values_list("id_proceso", flat=True))
    con_reg = set(FichaRegistro.objects.values_list("id_proceso", flat=True))
    con_riesgo = set(FichaRiesgo.objects.values_list("id_proceso", flat=True))

    for fp in FichaProceso.objects.all():
        pid = fp.id_proceso
        maestros_ok = all(getattr(fp, c) not in (None, "")
                          for c in ("codigo", "nombre_proceso", "dueno_proceso", "objetivo_general"))
        if (maestros_ok and pid in con_act and pid in con_flujo
                and pid in con_reg and pid in con_riesgo):
            completos.add(pid)
    return completos


# ---------- CÓDIGO AUTOGENERADO ----------

def _codigo_sugerido(id_proceso):
    """Construye el código jerárquico: inicial del tipo + número por nivel entre hermanos.
    Ej. M-01 (nivel 0), M-01.1 (nivel 1), M-01.1.1 (nivel 2)... Editable luego."""
    objetos = list(InventarioProceso.objects.all())
    indexado = {int(o.identificador): o for o in objetos}
    iid = int(id_proceso)
    if iid not in indexado:
        return ""
    tipo = indexado[iid].tipo_proceso
    inicial = INICIAL_TIPO.get(tipo, "X")

    def _padre(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    def _posicion_entre_hermanos(o):
        padre = _padre(o)
        hermanos = [x for x in objetos if _padre(x) == padre and x.tipo_proceso == tipo]
        hermanos.sort(key=lambda x: (x.orden_consecutivo if x.orden_consecutivo is not None else 0,
                                     int(x.identificador)))
        for i, h in enumerate(hermanos, start=1):
            if int(h.identificador) == int(o.identificador):
                return i
        return 1

    cadena, actual = [], iid
    while actual in indexado:
        o = indexado[actual]
        cadena.insert(0, _posicion_entre_hermanos(o))
        padre = _padre(o)
        if padre is None:
            break
        actual = padre

    raiz = f"{inicial}-{cadena[0]:02d}"
    resto = "".join(f".{n}" for n in cadena[1:])
    return raiz + resto


def _proc_inventario(id_proceso):
    return InventarioProceso.objects.filter(identificador=int(id_proceso)).first()


def _tipo_de(id_proceso):
    o = _proc_inventario(id_proceso)
    return o.tipo_proceso if o else None


def _nombre_de(id_proceso):
    o = _proc_inventario(id_proceso)
    return o.nombre_proceso if o else None


# ---------- FICHA COMPLETA ----------

def obtener_ficha(id_proceso):
    """Datos maestros + las 4 listas relacionadas de un proceso."""
    pid = int(id_proceso)
    maestro = FichaProceso.objects.filter(id_proceso=pid).first()
    if maestro is None:
        proceso = {"id_proceso": pid, "codigo": _codigo_sugerido(pid),
                   "tipo_proceso": _tipo_de(pid), "nombre_proceso": _nombre_de(pid)}
    else:
        proceso = _obj_a_dict(maestro, HOJAS["procesos"])
    return {
        "proceso": proceso,
        "actividades": [_obj_a_dict(o, HOJAS["actividades"]) for o in FichaActividad.objects.filter(id_proceso=pid)],
        "flujo_sipoc": [_obj_a_dict(o, HOJAS["flujo_sipoc"]) for o in FichaFlujoSipoc.objects.filter(id_proceso=pid)],
        "riesgos": [_obj_a_dict(o, HOJAS["riesgos"]) for o in FichaRiesgo.objects.filter(id_proceso=pid)],
        "registros": [_obj_a_dict(o, HOJAS["registros"]) for o in FichaRegistro.objects.filter(id_proceso=pid)],
    }


def guardar_maestro(id_proceso, datos):
    """Crea o actualiza los datos maestros del proceso."""
    pid = int(id_proceso)
    campos = {c: datos.get(c) for c in HOJAS["procesos"] if c != "id_proceso"}
    if not campos.get("tipo_proceso"):
        campos["tipo_proceso"] = _tipo_de(pid)

    obj = FichaProceso.objects.filter(id_proceso=pid).first()
    if obj is not None:
        for c, v in campos.items():
            setattr(obj, c, v)
        obj.save()
    else:
        FichaProceso.objects.create(id_proceso=pid, **campos)
    return obtener_ficha(pid)


# ---------- CRUD GENÉRICO PARA TABLAS HIJAS ----------

def agregar_detalle(hoja, datos):
    Modelo, llave = _MODELOS[hoja]
    # El Excel original arrancaba en base+1 (primer id = 101/501/701/901).
    nuevo_id = _siguiente_id(Modelo, llave, _BASES[hoja] + 1)
    campos = {c: datos.get(c) for c in HOJAS[hoja] if c != llave}
    obj = Modelo.objects.create(**{llave: nuevo_id, **campos})
    return _obj_a_dict(obj, HOJAS[hoja])


def editar_detalle(hoja, id_fila, datos):
    Modelo, llave = _MODELOS[hoja]
    obj = Modelo.objects.filter(**{llave: int(id_fila)}).first()
    if obj is None:
        return None
    for c in HOJAS[hoja]:
        if c not in (llave, "id_proceso") and c in datos:
            setattr(obj, c, datos[c])
    obj.save()
    return _obj_a_dict(obj, HOJAS[hoja])


def borrar_detalle(hoja, id_fila):
    Modelo, llave = _MODELOS[hoja]
    borrados, _ = Modelo.objects.filter(**{llave: int(id_fila)}).delete()
    return borrados > 0


def guardar_ficha_completa(id_proceso, datos_ia):
    """Reemplaza toda la ficha con datos generados por IA (bulk replace)."""
    pid = int(id_proceso)

    # 1. Datos maestros — preservar nombre_proceso, codigo y tipo_proceso del inventario
    maestro_ia = datos_ia.get("maestro", {})
    if maestro_ia:
        existente = obtener_ficha(pid)["proceso"]
        maestro_merged = {**existente, **maestro_ia}
        guardar_maestro(pid, maestro_merged)

    # 2. Actividades
    FichaActividad.objects.filter(id_proceso=pid).delete()
    base = _siguiente_id(FichaActividad, "id_actividad", _BASES["actividades"] + 1)
    FichaActividad.objects.bulk_create([
        FichaActividad(
            id_actividad=base + i,
            id_proceso=pid,
            orden_secuencia=a.get("orden_secuencia", i + 1),
            descripcion_actividad=a.get("descripcion_actividad", ""),
        )
        for i, a in enumerate(datos_ia.get("actividades", []))
    ])

    # 3. Flujo SIPOC
    FichaFlujoSipoc.objects.filter(id_proceso=pid).delete()
    base = _siguiente_id(FichaFlujoSipoc, "id_flujo", _BASES["flujo_sipoc"] + 1)
    FichaFlujoSipoc.objects.bulk_create([
        FichaFlujoSipoc(
            id_flujo=base + i,
            id_proceso=pid,
            proveedor=f.get("proveedor", ""),
            elemento_entrada=f.get("elemento_entrada", ""),
            producto=f.get("producto", ""),
            receptor=f.get("receptor", ""),
        )
        for i, f in enumerate(datos_ia.get("flujo_sipoc", []))
    ])

    # 4. Riesgos
    FichaRiesgo.objects.filter(id_proceso=pid).delete()
    base = _siguiente_id(FichaRiesgo, "id_riesgo", _BASES["riesgos"] + 1)
    FichaRiesgo.objects.bulk_create([
        FichaRiesgo(
            id_riesgo=base + i,
            id_proceso=pid,
            descripcion_riesgo=r.get("descripcion_riesgo", ""),
        )
        for i, r in enumerate(datos_ia.get("riesgos", []))
    ])

    # 5. Registros
    FichaRegistro.objects.filter(id_proceso=pid).delete()
    base = _siguiente_id(FichaRegistro, "id_registro", _BASES["registros"] + 1)
    FichaRegistro.objects.bulk_create([
        FichaRegistro(
            id_registro=base + i,
            id_proceso=pid,
            nombre_titulo=r.get("nombre_titulo", ""),
            tipo=r.get("tipo", "Digital"),
            caracteristicas=r.get("caracteristicas", ""),
        )
        for i, r in enumerate(datos_ia.get("registros", []))
    ])

    # 6. Indicador de avance (crear o actualizar)
    ind_ia = datos_ia.get("indicador", {})
    if ind_ia:
        from apps.indicadores.models import Indicador
        existente = Indicador.objects.filter(id_proceso=pid).first()
        if existente:
            existente.nombre_indicador = ind_ia.get("nombre_indicador", existente.nombre_indicador)
            existente.justificacion    = ind_ia.get("justificacion", existente.justificacion)
            existente.responsable      = ind_ia.get("responsable", existente.responsable)
            existente.metodo_calculo   = ind_ia.get("metodo_calculo", existente.metodo_calculo)
            existente.fuente_datos     = ind_ia.get("fuente_datos", existente.fuente_datos)
            existente.save()
        else:
            ultimo = Indicador.objects.order_by("-id_indicador").first()
            nuevo_id = (ultimo.id_indicador + 1) if ultimo else 1
            Indicador.objects.create(
                id_indicador=nuevo_id,
                id_proceso=pid,
                nombre_indicador=ind_ia.get("nombre_indicador", ""),
                justificacion=ind_ia.get("justificacion", ""),
                responsable=ind_ia.get("responsable", ""),
                metodo_calculo=ind_ia.get("metodo_calculo", ""),
                fuente_datos=ind_ia.get("fuente_datos", ""),
            )

    return obtener_ficha(pid)
