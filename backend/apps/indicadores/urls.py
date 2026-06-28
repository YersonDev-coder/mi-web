"""Endpoints del módulo Ficha de Indicador."""
from django.urls import path
from . import views

urlpatterns = [
    path("indicadores/reporte/periodos/", views.periodos_reporte),
    path("indicadores/reporte/identificacion/", views.reporte_identificacion),
    path("indicadores/migrar-codigos/", views.migrar_codigos),
    path("indicadores/asegurar-rangos/", views.asegurar_rangos),
    path("indicadores/cronograma-global/", views.cronograma_global),
    path("indicadores/reporte/", views.reporte),
    path("indicadores/config/", views.config),
    path("indicadores/arbol/", views.arbol),
    path("indicadores/proceso/<int:id_proceso>/", views.indicadores_de_proceso),
    path("indicadores/<int:id_indicador>/", views.indicador),
    path("indicadores/<int:id_indicador>/cronograma/", views.generar_cronograma),
    path("indicadores/<int:id_indicador>/propagar/", views.propagar_cronograma),
    path("indicadores/<int:id_indicador>/linea-base/", views.linea_base),
    path("indicadores/detalle/<str:hoja>/", views.detalle),
    path("indicadores/detalle/<str:hoja>/<int:id_fila>/", views.detalle_item),
    path("indicadores/estados-proceso/", views.estados_proceso),
    path("indicadores/estados-proceso/<int:id_proceso>/", views.estado_proceso_item),
]
