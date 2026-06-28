from django.urls import path
from . import views

urlpatterns = [
    path("auth/registro/",              views.registro),
    path("auth/login/",                 views.login),
    path("auth/refresh/",               views.refresh),
    path("auth/yo/",                    views.yo),
    path("auth/logout/",                views.logout),
    path("auth/perfil/",                views.actualizar_perfil),
    path("auth/cambiar-password/",      views.cambiar_password),
    path("auth/cuenta/",                views.eliminar_cuenta),
    path("auth/aprobar/<str:token>/",   views.aprobar),
    path("auth/rechazar/<str:token>/",  views.rechazar),
]
