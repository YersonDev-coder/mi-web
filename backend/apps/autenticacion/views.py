"""Vistas de autenticación con aprobación WhatsApp y correo."""
import json
import threading
from datetime import datetime

import jwt
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt

from .auth import decodificar, generar_tokens, requiere_auth
from .models import Perfil, SolicitudRegistro
from .whatsapp import enviar_whatsapp


# ── Helpers ────────────────────────────────────────────────────────────────────

def _cuerpo(request):
    return json.loads(request.body or "{}")


def _usuario_json(user):
    perfil = getattr(user, "perfil", None)
    return {
        "id":             user.id,
        "username":       user.username,
        "email":          user.email,
        "nombre_completo": (perfil.nombre_completo if perfil and perfil.nombre_completo else user.first_name) or "",
        "rol":            perfil.rol if perfil else "admin",
        "organizacion":   perfil.organizacion if perfil else "",
    }


def _enviar_email(asunto, mensaje, destinatario):
    """Envía correo en segundo plano para no bloquear la respuesta."""
    def _tarea():
        try:
            send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL,
                      [destinatario], fail_silently=True)
        except Exception:
            pass
    threading.Thread(target=_tarea, daemon=True).start()


# ── HTML pages (para aprobar/rechazar desde el celular) ───────────────────────

def _html_confirmacion(accion, token, username, email, nombre, organizacion, rol_label):
    es_aprobar = accion == "aprobar"
    color  = "#22c55e" if es_aprobar else "#ef4444"
    icono  = "✅" if es_aprobar else "🚫"
    titulo = "Aprobar acceso" if es_aprobar else "Rechazar acceso"
    btn    = "CONFIRMAR APROBACIÓN" if es_aprobar else "CONFIRMAR RECHAZO"
    desc   = (f"El usuario <strong>{username}</strong> podrá ingresar al sistema."
              if es_aprobar else
              f"El usuario <strong>{username}</strong> NO podrá ingresar al sistema.")
    site_url = getattr(settings, "SITE_URL", "http://localhost:8000")
    url_ok   = f"{site_url}/api/auth/{accion}/{token}/?confirmar=1"

    filas = f"<div class='fila'><span class='lbl'>Correo</span><span class='val'>{email}</span></div>"
    if nombre:       filas += f"<div class='fila'><span class='lbl'>Nombre</span><span class='val'>{nombre}</span></div>"
    if organizacion: filas += f"<div class='fila'><span class='lbl'>Organización</span><span class='val'>{organizacion}</span></div>"
    filas += f"<div class='fila'><span class='lbl'>Rol</span><span class='val'>{rol_label}</span></div>"

    return f"""<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>{titulo}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}}
body{{min-height:100dvh;display:flex;align-items:center;justify-content:center;
     background:#020510;font-family:system-ui,-apple-system,sans-serif;padding:1.2rem}}
.card{{background:#0a1628;border:1px solid {color}33;border-radius:22px;
       padding:2rem 1.6rem 2.2rem;text-align:center;max-width:420px;width:100%;
       box-shadow:0 0 60px {color}18,0 20px 60px #00000080}}
.badge{{width:72px;height:72px;border-radius:50%;background:{color}18;
        border:2px solid {color}55;display:flex;align-items:center;justify-content:center;
        font-size:2.2rem;margin:0 auto 1.2rem;box-shadow:0 0 24px {color}30}}
h1{{color:#f0f8ff;font-size:1.2rem;font-weight:800;margin-bottom:.5rem}}
.desc{{color:#64748b;font-size:.88rem;line-height:1.6;margin-bottom:1.4rem}}
.desc strong{{color:#94a3b8}}
.info{{background:#0f1f38;border:1px solid #1e3a5f;border-radius:12px;padding:1rem;margin-bottom:1.6rem;text-align:left}}
.user{{font-size:1rem;font-weight:700;color:{color};margin-bottom:.8rem;text-align:center}}
.fila{{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #1e3a5f44}}
.fila:last-child{{border-bottom:none}}
.lbl{{font-size:.72rem;color:#475569;text-transform:uppercase;letter-spacing:.06em}}
.val{{font-size:.82rem;color:#94a3b8;font-weight:500;max-width:200px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.btn{{display:block;width:100%;padding:1rem;border:none;border-radius:14px;font-size:1rem;
      font-weight:800;letter-spacing:.06em;cursor:pointer;background:{color};color:#fff;
      box-shadow:0 6px 24px {color}44;text-decoration:none;-webkit-appearance:none}}
.btn:active{{opacity:.88}}
.cancel{{margin-top:.9rem;display:block;color:#334155;font-size:.8rem;text-decoration:none;padding:.4rem}}
</style></head><body>
<div class="card">
  <div class="badge">{icono}</div>
  <h1>{titulo}</h1>
  <p class="desc">{desc}</p>
  <div class="info"><div class="user">@{username}</div>{filas}</div>
  <a class="btn" href="{url_ok}">{btn}</a>
  <a class="cancel" href="javascript:window.close()">Cancelar</a>
</div></body></html>"""


def _html_resultado(titulo, cuerpo, color):
    icono = "✅" if "Aprobad" in titulo else "🚫" if "Rechazad" in titulo else "❌"
    return f"""<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>{titulo}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{min-height:100dvh;display:flex;align-items:center;justify-content:center;
     background:#020510;font-family:system-ui,-apple-system,sans-serif;padding:1.2rem}}
.card{{background:#0a1628;border:1px solid {color}33;border-radius:22px;
       padding:2.5rem 2rem;text-align:center;max-width:400px;width:100%;
       box-shadow:0 0 60px {color}18}}
.badge{{width:72px;height:72px;border-radius:50%;background:{color}18;
        border:2px solid {color}55;display:flex;align-items:center;justify-content:center;
        font-size:2.2rem;margin:0 auto 1.2rem;box-shadow:0 0 24px {color}30}}
h1{{color:{color};font-size:1.3rem;font-weight:800;margin-bottom:.8rem}}
p{{color:#64748b;font-size:.9rem;line-height:1.7}} p strong{{color:#94a3b8}}
.btn{{margin-top:1.8rem;display:block;color:#334155;font-size:.8rem;text-decoration:none;padding:.5rem}}
</style></head><body>
<div class="card">
  <div class="badge">{icono}</div>
  <h1>{titulo}</h1><p>{cuerpo}</p>
  <a class="btn" href="javascript:window.close()">Cerrar ventana</a>
</div></body></html>"""


# ── REGISTRO (solicitud pendiente + WhatsApp) ──────────────────────────────────

@csrf_exempt
def registro(request):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d               = _cuerpo(request)
    username        = (d.get("username") or "").strip()
    email           = (d.get("email") or "").strip().lower()
    password        = d.get("password") or ""
    nombre_completo = (d.get("nombre_completo") or d.get("nombre") or "").strip()
    organizacion    = (d.get("organizacion") or "").strip()
    rol             = "admin"   # solo Administrador por ahora

    if not username:
        return JsonResponse({"error": "El nombre de usuario es requerido"}, status=400)
    if len(username) < 3:
        return JsonResponse({"error": "El usuario debe tener al menos 3 caracteres"}, status=400)
    if not email or "@" not in email:
        return JsonResponse({"error": "Ingresa un correo electrónico válido"}, status=400)
    if not password:
        return JsonResponse({"error": "La contraseña es requerida"}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"error": "Ese nombre de usuario ya está en uso"}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"error": "Ese correo ya está registrado"}, status=400)
    if SolicitudRegistro.objects.filter(username__iexact=username, estado="pendiente").exists():
        return JsonResponse({"error": "Ya tienes una solicitud pendiente con ese usuario. Espera la aprobación."}, status=400)
    if SolicitudRegistro.objects.filter(email__iexact=email, estado="pendiente").exists():
        return JsonResponse({"error": "Ya existe una solicitud pendiente con ese correo. Espera la aprobación."}, status=400)
    try:
        validate_password(password)
    except ValidationError as e:
        return JsonResponse({"error": " | ".join(e.messages)}, status=400)

    sol = SolicitudRegistro.objects.create(
        username=username, email=email,
        password_hash=make_password(password),
        nombre_completo=nombre_completo, organizacion=organizacion, rol=rol,
    )

    site_url  = getattr(settings, "SITE_URL", "http://localhost:8000")
    fecha     = datetime.now().strftime("%d/%m/%Y  %H:%M")

    lineas = [
        "🔔 *NUEVA SOLICITUD DE ACCESO*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"👤 *Usuario:*  {username}",
        f"📧 *Correo:*   {email}",
    ]
    if nombre_completo: lineas.append(f"🪪 *Nombre:*   {nombre_completo}")
    if organizacion:    lineas.append(f"🏢 *Org:*      {organizacion}")
    lineas += [
        "👑 *Rol:*      Administrador",
        f"📅 *Fecha:*    {fecha}",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "👇 *Toca para APROBAR:*",
        f"{site_url}/api/auth/aprobar/{sol.token}/",
        "",
        "👇 *Toca para RECHAZAR:*",
        f"{site_url}/api/auth/rechazar/{sol.token}/",
    ]
    enviar_whatsapp("\n".join(lineas))

    return JsonResponse({
        "estado":  "pendiente",
        "mensaje": "Solicitud enviada. Recibirás un correo cuando tu acceso sea aprobado.",
    }, status=202)


# ── APROBAR / RECHAZAR ─────────────────────────────────────────────────────────

def _sol_o_error(token):
    try:
        return SolicitudRegistro.objects.get(token=token, estado="pendiente"), None
    except SolicitudRegistro.DoesNotExist:
        html = _html_resultado("Enlace no válido",
            "Este enlace ya fue utilizado o no existe.", "#f59e0b")
        return None, HttpResponse(html, content_type="text/html; charset=utf-8")


def aprobar(request, token):
    sol, err = _sol_o_error(token)
    if err:
        return err

    rol_label = "Superadministrador" if sol.rol == "superadmin" else "Administrador"

    if request.GET.get("confirmar") != "1":
        html = _html_confirmacion("aprobar", token, sol.username, sol.email,
                                  sol.nombre_completo, sol.organizacion, rol_label)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    user = User(username=sol.username, email=sol.email,
                is_active=True, first_name=sol.nombre_completo)
    user.password = sol.password_hash
    user.save()
    Perfil.objects.create(usuario=user, rol=sol.rol,
                          nombre_completo=sol.nombre_completo, organizacion=sol.organizacion)
    sol.estado = "aprobado"
    sol.save()

    # Correo de confirmación al usuario
    _enviar_email(
        "✅ Tu acceso al Sistema de Gestión fue aprobado",
        f"Hola {sol.nombre_completo or sol.username},\n\n"
        f"Tu solicitud de acceso al Sistema de Gestión de Procesos ha sido aprobada.\n\n"
        f"Ya puedes iniciar sesión con:\n"
        f"  • Usuario: {sol.username}\n"
        f"  • La contraseña que registraste\n\n"
        f"Ingresa en: {getattr(settings, 'SITE_URL', 'http://localhost:5173')}/login\n\n"
        f"Bienvenido al sistema.",
        sol.email,
    )

    html = _html_resultado("Acceso Aprobado ✅",
        f"El usuario <strong>{sol.username}</strong> ya puede ingresar al sistema. "
        f"Se le notificó por correo a {sol.email}.", "#22c55e")
    return HttpResponse(html, content_type="text/html; charset=utf-8")


def rechazar(request, token):
    sol, err = _sol_o_error(token)
    if err:
        return err

    rol_label = "Superadministrador" if sol.rol == "superadmin" else "Administrador"

    if request.GET.get("confirmar") != "1":
        html = _html_confirmacion("rechazar", token, sol.username, sol.email,
                                  sol.nombre_completo, sol.organizacion, rol_label)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    nombre = sol.username
    email  = sol.email
    sol.estado = "rechazado"
    sol.save()

    _enviar_email(
        "Solicitud de acceso no aprobada",
        f"Hola,\n\nTu solicitud de acceso al Sistema de Gestión de Procesos "
        f"con el usuario '{nombre}' no fue aprobada en esta ocasión.\n\n"
        f"Si tienes dudas, comunícate con el administrador.",
        email,
    )

    html = _html_resultado("Acceso Rechazado",
        f"La solicitud de <strong>{nombre}</strong> fue rechazada y notificada por correo.",
        "#ef4444")
    return HttpResponse(html, content_type="text/html; charset=utf-8")


# ── LOGIN ──────────────────────────────────────────────────────────────────────

@csrf_exempt
def login(request):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d          = _cuerpo(request)
    credencial = (d.get("username") or "").strip()
    password   = d.get("password") or ""

    if not credencial or not password:
        return JsonResponse({"error": "Usuario y contraseña son requeridos"}, status=400)

    user = (User.objects.filter(username__iexact=credencial).first()
            or User.objects.filter(email__iexact=credencial.lower()).first())

    if user is None or not user.check_password(password):
        return JsonResponse({"error": "Credenciales incorrectas"}, status=401)
    if not user.is_active:
        return JsonResponse({"error": "Cuenta desactivada. Contacta al administrador."}, status=401)

    tokens = generar_tokens(user.id)
    return JsonResponse({**tokens, "usuario": _usuario_json(user)})


# ── REFRESH ────────────────────────────────────────────────────────────────────

@csrf_exempt
def refresh(request):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d = _cuerpo(request)
    refresh_token = (d.get("refresh") or "").strip()
    if not refresh_token:
        return JsonResponse({"error": "Token requerido"}, status=400)

    try:
        payload = decodificar(refresh_token, tipo_esperado="refresh")
        user    = User.objects.get(id=payload["user_id"])
        if not user.is_active:
            return JsonResponse({"error": "Cuenta desactivada"}, status=401)
        return JsonResponse(generar_tokens(user.id))
    except jwt.ExpiredSignatureError:
        return JsonResponse({"error": "Sesión expirada", "code": "expired"}, status=401)
    except (jwt.InvalidTokenError, User.DoesNotExist):
        return JsonResponse({"error": "Token inválido", "code": "invalid"}, status=401)


# ── PERFIL ─────────────────────────────────────────────────────────────────────

@requiere_auth
def yo(request):
    return JsonResponse({"usuario": _usuario_json(request.usuario)})


@csrf_exempt
@requiere_auth
def actualizar_perfil(request):
    if request.method != "PUT":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d    = _cuerpo(request)
    user = request.usuario

    nombre_completo = (d.get("nombre_completo") or "").strip()
    email           = (d.get("email") or "").strip().lower()
    organizacion    = (d.get("organizacion") or "").strip()

    if email and "@" not in email:
        return JsonResponse({"error": "Correo inválido"}, status=400)
    if email and email != user.email:
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            return JsonResponse({"error": "Ese correo ya está en uso"}, status=400)
        user.email = email

    user.first_name = nombre_completo
    user.save()

    perfil, _ = Perfil.objects.get_or_create(usuario=user)
    perfil.nombre_completo = nombre_completo
    if organizacion is not None:
        perfil.organizacion = organizacion
    perfil.save()

    return JsonResponse({"ok": True, "usuario": _usuario_json(user)})


@csrf_exempt
@requiere_auth
def cambiar_password(request):
    if request.method != "PUT":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d            = _cuerpo(request)
    actual       = d.get("password_actual") or ""
    nueva        = d.get("password_nueva")  or ""
    confirmacion = d.get("confirmacion")    or ""

    user = request.usuario
    if not user.check_password(actual):
        return JsonResponse({"error": "La contraseña actual es incorrecta"}, status=400)
    if nueva != confirmacion:
        return JsonResponse({"error": "Las nuevas contraseñas no coinciden"}, status=400)
    try:
        validate_password(nueva, user=user)
    except ValidationError as e:
        return JsonResponse({"error": " | ".join(e.messages)}, status=400)

    user.set_password(nueva)
    user.save()
    # Generar nuevos tokens para que la sesión no expire
    tokens = generar_tokens(user.id)
    return JsonResponse({"ok": True, **tokens})


@csrf_exempt
@requiere_auth
def eliminar_cuenta(request):
    if request.method != "DELETE":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    d        = _cuerpo(request)
    password = d.get("password") or ""
    user     = request.usuario

    if not user.check_password(password):
        return JsonResponse({"error": "Contraseña incorrecta"}, status=400)

    user.delete()
    return JsonResponse({"ok": True, "mensaje": "Cuenta eliminada correctamente"})


# ── LOGOUT ─────────────────────────────────────────────────────────────────────

@csrf_exempt
@requiere_auth
def logout(request):
    return JsonResponse({"ok": True})
