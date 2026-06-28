from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from apps.autenticacion.auth import requiere_auth
from . import services as sv
from .models import SSDefinicion


def _json(data, status=200):
    return JsonResponse(data, safe=False, status=status)

def _body(request):
    try:
        return json.loads(request.body)
    except Exception:
        return {}

def _ok_def(id_def, user_id):
    return SSDefinicion.objects.filter(id_def=id_def, id_usuario=user_id).exists()

# ── CARGA DE DATOS ─────────────────────────────────────────────────────────────

@requiere_auth
@require_http_methods(["GET"])
def carga_archivos(request):
    return _json(sv.listar_excels_disponibles())

@requiere_auth
@require_http_methods(["GET"])
def carga_hojas(request):
    archivo = request.GET.get("archivo", "")
    try:
        return _json(sv.obtener_hojas(archivo))
    except FileNotFoundError as e:
        return _json({"error": str(e)}, 404)

@csrf_exempt
@requiere_auth
@require_http_methods(["POST"])
def carga_previsualizar(request):
    datos = _body(request)
    try:
        return _json(sv.previsualizar_datos(datos.get("archivo",""), datos.get("hoja",""), 10))
    except Exception as e:
        return _json({"error": str(e)}, 400)

@csrf_exempt
@requiere_auth
@require_http_methods(["POST"])
def carga_importar(request):
    datos = _body(request)
    try:
        n = sv.importar_datos(datos["id_def"], datos["archivo"],
                              datos["hoja"], datos.get("mapeo", {}))
        return _json({"importadas": n})
    except Exception as e:
        return _json({"error": str(e)}, 400)

# ── DEFINE ─────────────────────────────────────────────────────────────────────

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def definicion(request):
    if request.method == "GET":
        return _json(sv.listar_definiciones(user_id=request.user_id))
    datos = _body(request)
    datos["id_usuario"] = request.user_id
    return _json(sv.crear_definicion(datos), status=201)

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "PUT", "DELETE"])
def definicion_detalle(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        d = sv.obtener_definicion(id_def)
        return _json(d) if d else _json({"error": "No encontrado"}, 404)
    if request.method == "PUT":
        d = sv.actualizar_definicion(id_def, _body(request))
        return _json(d) if d else _json({"error": "No encontrado"}, 404)
    sv.eliminar_definicion(id_def)
    return _json({"ok": True})

@requiere_auth
@require_http_methods(["GET"])
def validar_fase(request, id_def):
    return _json(sv.validar_fase(id_def))

# ── MEASURE ────────────────────────────────────────────────────────────────────

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def mediciones(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        return _json(sv.listar_mediciones(id_def))
    try:
        return _json(sv.agregar_medicion(id_def, _body(request)), status=201)
    except Exception as e:
        return _json({"error": str(e)}, 400)

@csrf_exempt
@requiere_auth
@require_http_methods(["DELETE", "PUT"])
def medicion_detalle(request, id_med):
    if request.method == "PUT":
        r = sv.actualizar_medicion(id_med, _body(request))
        return _json(r) if r else _json({"error": "No encontrado"}, 404)
    sv.eliminar_medicion(id_med)
    return _json({"ok": True})

# ── ANALYZE ────────────────────────────────────────────────────────────────────

@requiere_auth
@require_http_methods(["GET"])
def analisis_pareto(request, id_def):
    return _json(sv.calcular_pareto(id_def))

@requiere_auth
@require_http_methods(["GET"])
def analisis_temporal(request, id_def):
    return _json(sv.calcular_temporal(id_def))

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def ishikawa(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        return _json(sv.listar_causas(id_def))
    return _json(sv.agregar_causa(id_def, _body(request)), status=201)

@csrf_exempt
@requiere_auth
@require_http_methods(["DELETE"])
def ishikawa_detalle(request, id_causa):
    sv.eliminar_causa(id_causa)
    return _json({"ok": True})

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def porques(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        return _json(sv.listar_porques(id_def))
    return _json(sv.crear_porques(id_def, _body(request)), status=201)

@csrf_exempt
@requiere_auth
@require_http_methods(["PUT", "DELETE"])
def porques_detalle(request, id_porq):
    if request.method == "PUT":
        r = sv.actualizar_porques(id_porq, _body(request))
        return _json(r) if r else _json({"error": "No encontrado"}, 404)
    sv.eliminar_porques(id_porq)
    return _json({"ok": True})

# ── IMPROVE ────────────────────────────────────────────────────────────────────

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def mejoras(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        return _json(sv.listar_mejoras(id_def))
    return _json(sv.crear_mejora(id_def, _body(request)), status=201)

@csrf_exempt
@requiere_auth
@require_http_methods(["PUT", "DELETE"])
def mejora_detalle(request, id_mej):
    if request.method == "PUT":
        r = sv.actualizar_mejora(id_mej, _body(request))
        return _json(r) if r else _json({"error": "No encontrado"}, 404)
    sv.eliminar_mejora(id_mej)
    return _json({"ok": True})

# ── CONTROL ────────────────────────────────────────────────────────────────────

@csrf_exempt
@requiere_auth
@require_http_methods(["GET", "POST"])
def plan_control(request, id_def):
    if not _ok_def(id_def, request.user_id):
        return _json({"error": "No autorizado"}, 403)
    if request.method == "GET":
        return _json(sv.listar_plan_control(id_def))
    return _json(sv.agregar_plan_control(id_def, _body(request)), status=201)

@csrf_exempt
@requiere_auth
@require_http_methods(["DELETE"])
def control_detalle(request, id_ctrl):
    sv.eliminar_plan_control(id_ctrl)
    return _json({"ok": True})

@requiere_auth
@require_http_methods(["GET"])
def carta_control(request, id_def):
    return _json(sv.calcular_carta_control(id_def))

# ── HISTÓRICO ──────────────────────────────────────────────────────────────────

@requiere_auth
@require_http_methods(["GET"])
def historico(request):
    id_def = request.GET.get("id_def")
    return _json(sv.listar_historico(id_def))

# ── DASHBOARD ─────────────────────────────────────────────────────────────────

@requiere_auth
@require_http_methods(["GET"])
def dashboard(request):
    return _json(sv.dashboard_resumen())

# ── IMPORTAR DESDE SISTEMA DE INDICADORES ─────────────────────────────────────

@requiere_auth
@require_http_methods(["GET"])
def sistema_procesos(request):
    return _json(sv.procesos_sistema())

@csrf_exempt
@requiere_auth
@require_http_methods(["POST"])
def sistema_reimportar(request, id_def):
    try:
        return _json(sv.reimportar_mediciones(id_def))
    except Exception as e:
        return _json({"error": str(e)}, 400)

@csrf_exempt
@requiere_auth
@require_http_methods(["POST"])
def sistema_crear_desde(request):
    datos = _body(request)
    try:
        r = sv.crear_desde_indicador(
            datos["id_indicador"],
            datos.get("oportunidades", 1),
            nombre_proceso_ext=datos.get("nombre_proceso", ""),
            nombre_indicador_ext=datos.get("nombre_indicador", ""),
            user_id=request.user_id,
        )
        return _json(r, status=201)
    except Exception as e:
        return _json({"error": str(e)}, 400)
