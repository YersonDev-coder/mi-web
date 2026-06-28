"""Capa de datos: persistencia en PostgreSQL vía ORM de Django.

Reemplaza la antigua base en Excel (base_procesos.xlsx). Las firmas públicas
(listar, insertar, actualizar, eliminar) se conservan idénticas para que
views.py y el frontend no se enteren del cambio.
"""
from .models import BaseProceso

# Campos editables expuestos al frontend (sin el identificador autoincremental).
COLUMNAS = ["Identificador", "Tipo_Proceso", "Nombre_Proceso", "Orden_Consecutivo"]

# Mapeo nombre-de-campo-frontend → atributo-del-modelo.
_CAMPOS = {
    "Tipo_Proceso": "tipo_proceso",
    "Nombre_Proceso": "nombre_proceso",
    "Orden_Consecutivo": "orden_consecutivo",
}


def _a_dict(obj):
    """Convierte un BaseProceso al dict con los nombres que espera el frontend."""
    return {
        "Identificador": obj.identificador,
        "Tipo_Proceso": obj.tipo_proceso,
        "Nombre_Proceso": obj.nombre_proceso,
        "Orden_Consecutivo": int(obj.orden_consecutivo) if obj.orden_consecutivo is not None else 0,
    }


def listar():
    """Devuelve todos los procesos como lista de diccionarios."""
    return [_a_dict(o) for o in BaseProceso.objects.all().order_by("identificador")]


def insertar(datos):
    """Inserta un proceso generando identificador y orden consecutivo automáticos."""
    ultimo = BaseProceso.objects.order_by("-identificador").first()
    nuevo_id = (ultimo.identificador + 1) if ultimo else 1
    tipo = datos.get("Tipo_Proceso", "Misional")
    ultimo_orden = BaseProceso.objects.filter(tipo_proceso=tipo).order_by("-orden_consecutivo").first()
    nuevo_orden = (ultimo_orden.orden_consecutivo + 1) if ultimo_orden and ultimo_orden.orden_consecutivo else 1
    obj = BaseProceso.objects.create(
        identificador=nuevo_id,
        tipo_proceso=tipo,
        nombre_proceso=datos.get("Nombre_Proceso"),
        orden_consecutivo=nuevo_orden,
    )
    return _a_dict(obj)


def actualizar(identificador, datos):
    """Actualiza las columnas editables de un proceso por su identificador."""
    obj = BaseProceso.objects.filter(identificador=int(identificador)).first()
    if obj is None:
        return None
    for col, attr in _CAMPOS.items():
        if col in datos:
            setattr(obj, attr, datos[col])
    obj.save()
    return _a_dict(obj)


def eliminar(identificador):
    """Elimina un proceso por su identificador."""
    borrados, _ = BaseProceso.objects.filter(identificador=int(identificador)).delete()
    return borrados > 0
