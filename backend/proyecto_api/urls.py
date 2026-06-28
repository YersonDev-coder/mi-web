"""Enrutador global de la API. Cada módulo futuro se monta bajo /api/."""
from django.urls import path, include

urlpatterns = [
    path("api/", include("apps.autenticacion.urls")),
    path("api/", include("apps.gestion_procesos.urls")),
    path("api/", include("apps.inventario_procesos.urls")),
    path("api/", include("apps.fichas_procesos.urls")),
        path("api/", include("apps.indicadores.urls")),
    path("api/", include("apps.mejoras.urls")),
    path("api/", include("apps.six_sigma.urls")),

    # Futuros módulos: scraping, bots (selenium), apis_externas, tiempos_ciclo, etc.
    # path("api/scraping/", include("apps.scraping.urls")),
]
