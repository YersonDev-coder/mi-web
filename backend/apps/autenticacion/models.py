"""Perfil extendido del usuario y solicitudes de registro pendientes."""
import secrets
from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    rol = models.CharField(
        max_length=20, default="admin",
        choices=[("superadmin", "Superadministrador"), ("admin", "Administrador")],
    )
    nombre_completo = models.CharField(max_length=200, null=True, blank=True)
    organizacion    = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        db_table = "auth_perfil"
        managed  = False


class SolicitudRegistro(models.Model):
    """Solicitud de acceso pendiente de aprobación por WhatsApp."""
    username        = models.CharField(max_length=150)
    email           = models.EmailField()
    password_hash   = models.CharField(max_length=256)
    nombre_completo = models.CharField(max_length=200, blank=True, default="")
    organizacion    = models.CharField(max_length=200, blank=True, default="")
    rol             = models.CharField(max_length=20, default="admin")
    token           = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    estado          = models.CharField(max_length=20, default="pendiente")
    fecha_solicitud = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auth_solicitud_registro"
