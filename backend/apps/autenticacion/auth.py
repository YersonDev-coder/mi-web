"""Utilidades JWT y decorador de autenticación."""
import datetime
from functools import wraps

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.http import JsonResponse

_ACCESS_TTL  = datetime.timedelta(hours=8)
_REFRESH_TTL = datetime.timedelta(days=30)
_ALGO = "HS256"


def _generar(user_id, tipo, ttl):
    payload = {
        "user_id": user_id,
        "tipo": tipo,
        "exp": datetime.datetime.utcnow() + ttl,
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGO)


def generar_tokens(user_id):
    return {
        "token":   _generar(user_id, "access",  _ACCESS_TTL),
        "refresh": _generar(user_id, "refresh", _REFRESH_TTL),
    }


def decodificar(token, tipo_esperado="access"):
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGO])
    if payload.get("tipo") != tipo_esperado:
        raise jwt.InvalidTokenError("Tipo de token incorrecto")
    return payload


def requiere_auth(fn):
    """Decorador: valida JWT Bearer y expone request.usuario (User) y request.user_id (int)."""
    @wraps(fn)
    def wrapper(request, *args, **kwargs):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return JsonResponse({"error": "No autenticado", "code": "no_auth"}, status=401)
        token = header[7:]
        try:
            payload = decodificar(token)
            user = User.objects.select_related("perfil").get(id=payload["user_id"])
            if not user.is_active:
                return JsonResponse({"error": "Cuenta desactivada", "code": "inactive"}, status=401)
            request.usuario = user
            request.user_id = user.id
        except jwt.ExpiredSignatureError:
            return JsonResponse({"error": "Sesión expirada", "code": "expired"}, status=401)
        except (jwt.InvalidTokenError, User.DoesNotExist):
            return JsonResponse({"error": "Token inválido", "code": "invalid"}, status=401)
        return fn(request, *args, **kwargs)
    return wrapper


def procesos_de_usuario(user_id):
    """Devuelve el conjunto de IDs de inventario_proceso que pertenecen al usuario."""
    from apps.inventario_procesos.models import InventarioProceso
    return set(
        InventarioProceso.objects.filter(id_usuario=user_id)
        .values_list("identificador", flat=True)
    )
