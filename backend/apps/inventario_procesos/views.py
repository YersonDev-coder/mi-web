"""Controladores REST del módulo de Inventario de Procesos (jerárquico)."""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from apps.autenticacion.auth import requiere_auth
from . import services


def _cuerpo(request):
    return json.loads(request.body or "{}")


@csrf_exempt
@requiere_auth
def hijos(request):
    """GET: lista los hijos de un padre (?padre=<id>; vacío = nivel 0). POST: inserta."""
    if request.method == "GET":
        return JsonResponse(services.listar_hijos(request.GET.get("padre"), request.user_id), safe=False)
    if request.method == "POST":
        resultado = services.insertar(_cuerpo(request), request.user_id)
        estado = 400 if "error" in resultado else 201
        return JsonResponse(resultado, status=estado)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def detalle(request, identificador):
    """PUT actualiza, DELETE elimina en cascada."""
    if request.method == "PUT":
        resultado = services.actualizar(identificador, _cuerpo(request), request.user_id)
        return JsonResponse(resultado) if resultado else JsonResponse({"error": "No encontrado"}, status=404)
    if request.method == "DELETE":
        ok = services.eliminar(identificador, request.user_id)
        return JsonResponse({"eliminado": True}) if ok else JsonResponse({"error": "No encontrado"}, status=404)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@requiere_auth
def ruta(request, identificador):
    """GET: devuelve la ruta de navegación (breadcrumb) del proceso."""
    return JsonResponse(services.ruta_navegacion(identificador, request.user_id), safe=False)


@requiere_auth
def inventario_completo(request):
    """GET: todos los procesos del usuario con código jerárquico calculado."""
    return JsonResponse(services.todos_con_codigo(request.user_id), safe=False)
