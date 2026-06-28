"""Modelos del módulo Ficha de Mejora de Proceso (2 tablas)."""
from django.db import models


class Mejora(models.Model):
    """Hoja 'mejoras'. 1 ficha por proceso. Campos complejos en JSONB."""
    id_mejora = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField(unique=True)
    codigo_proceso = models.CharField(max_length=100, null=True, blank=True)
    proyecto = models.CharField(max_length=500, null=True, blank=True)
    codigo_proyecto = models.CharField(max_length=100, null=True, blank=True)
    proceso_asociado = models.CharField(max_length=500, null=True, blank=True)
    responsable_proceso = models.CharField(max_length=300, null=True, blank=True)
    responsable_proyecto = models.CharField(max_length=300, null=True, blank=True)
    fecha_solicitud = models.CharField(max_length=20, null=True, blank=True)
    fecha_requerida = models.CharField(max_length=20, null=True, blank=True)
    tipo_mejora = models.CharField(max_length=100, null=True, blank=True)
    importancia = models.CharField(max_length=100, null=True, blank=True)
    complejidad = models.CharField(max_length=100, null=True, blank=True)
    tipo_oportunidad = models.CharField(max_length=100, null=True, blank=True)
    oportunidades_identificadas = models.TextField(null=True, blank=True)
    # JSONB: el frontend espera estos campos con sus nombres "*_json"
    consecuencias_marcadas = models.JSONField(null=True, blank=True)
    evaluaciones_json = models.JSONField(null=True, blank=True)
    confianza_json = models.JSONField(null=True, blank=True)
    acciones_json = models.JSONField(null=True, blank=True)
    costo_valor = models.FloatField(null=True, blank=True)
    costo_nivel = models.CharField(max_length=50, null=True, blank=True)
    impacto_valor = models.FloatField(null=True, blank=True)
    impacto_nivel = models.CharField(max_length=50, null=True, blank=True)
    factibilidad_valor = models.FloatField(null=True, blank=True)
    factibilidad_nivel = models.CharField(max_length=50, null=True, blank=True)
    factibilidad_accion = models.CharField(max_length=300, null=True, blank=True)
    plazo_inicio = models.CharField(max_length=20, null=True, blank=True)
    plazo_fin = models.CharField(max_length=20, null=True, blank=True)
    estado = models.CharField(max_length=50, null=True, blank=True)
    desc_problema = models.TextField(null=True, blank=True)
    desc_objetivo = models.TextField(null=True, blank=True)
    desc_indicador_meta = models.TextField(null=True, blank=True)
    desc_alcance = models.TextField(null=True, blank=True)
    desc_accion_mejora = models.TextField(null=True, blank=True)
    desc_impacto = models.TextField(null=True, blank=True)
    cronograma_json = models.JSONField(null=True, blank=True)
    cronograma_proceso_json = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "mejora"
        managed = False


class MejCronograma(models.Model):
    """Hoja 'crono_mejoras'. Cronograma semanal de la mejora."""
    id_crono = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    semana = models.CharField(max_length=50, null=True, blank=True)
    inicio = models.CharField(max_length=20, null=True, blank=True)
    fin = models.CharField(max_length=20, null=True, blank=True)
    planificado = models.FloatField(null=True, blank=True)
    logrado = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "mej_cronograma"
        managed = False
