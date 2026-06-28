"""Modelos del módulo Six Sigma (DMAIC, 7 tablas)."""
from django.db import models


class SSDefinicion(models.Model):
    """Hoja 'definicion'. Fase DEFINE."""
    id_def = models.IntegerField(primary_key=True)
    nombre_proceso = models.CharField(max_length=500, null=True, blank=True)
    descripcion = models.TextField(null=True, blank=True)
    indicador = models.CharField(max_length=200, null=True, blank=True)
    meta = models.FloatField(null=True, blank=True)
    unidad_medida = models.CharField(max_length=100, null=True, blank=True)
    tipo_indicador = models.CharField(max_length=100, null=True, blank=True)
    definicion_defecto = models.TextField(null=True, blank=True)
    oportunidades_defecto = models.FloatField(default=1, null=True, blank=True)
    fecha_creacion = models.CharField(max_length=30, null=True, blank=True)
    estado = models.CharField(max_length=30, default="activo")
    id_usuario = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "ss_definicion"
        managed = False


class SSMedicion(models.Model):
    """Hoja 'mediciones'. Fase MEASURE."""
    id_med = models.IntegerField(primary_key=True)
    id_def = models.IntegerField()
    periodo = models.CharField(max_length=100, null=True, blank=True)
    unidades_evaluadas = models.FloatField(null=True, blank=True)
    defectos = models.FloatField(null=True, blank=True)
    yield_pct = models.FloatField(null=True, blank=True)
    dpmo = models.FloatField(null=True, blank=True)
    nivel_sigma = models.FloatField(null=True, blank=True)
    cumplimiento = models.FloatField(null=True, blank=True)
    fecha_registro = models.CharField(max_length=30, null=True, blank=True)
    observacion = models.TextField(null=True, blank=True)
    fuente = models.CharField(max_length=300, null=True, blank=True)

    class Meta:
        db_table = "ss_mediciones"
        managed = False


class SSCausaIshikawa(models.Model):
    """Hoja 'causas_ishikawa'. Fase ANALYZE."""
    id_causa = models.IntegerField(primary_key=True)
    id_def = models.IntegerField()
    categoria = models.CharField(max_length=100, null=True, blank=True)
    causa = models.TextField(null=True, blank=True)
    subcausa = models.TextField(null=True, blank=True)
    descripcion = models.TextField(null=True, blank=True)
    proceso_relacionado = models.CharField(max_length=300, null=True, blank=True)
    fecha_registro = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = "ss_causas_ishikawa"
        managed = False


class SSCincoPorques(models.Model):
    """Hoja 'cinco_porques'. Fase ANALYZE."""
    id_porq = models.IntegerField(primary_key=True)
    id_def = models.IntegerField()
    problema = models.TextField(null=True, blank=True)
    por1 = models.TextField(null=True, blank=True)
    resp1 = models.TextField(null=True, blank=True)
    por2 = models.TextField(null=True, blank=True)
    resp2 = models.TextField(null=True, blank=True)
    por3 = models.TextField(null=True, blank=True)
    resp3 = models.TextField(null=True, blank=True)
    por4 = models.TextField(null=True, blank=True)
    resp4 = models.TextField(null=True, blank=True)
    por5 = models.TextField(null=True, blank=True)
    resp5 = models.TextField(null=True, blank=True)
    causa_raiz = models.TextField(null=True, blank=True)
    fecha_registro = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = "ss_cinco_porques"
        managed = False


class SSMejora(models.Model):
    """Hoja 'mejoras' (del libro six_sigma). Fase IMPROVE."""
    id_mej = models.IntegerField(primary_key=True)
    id_def = models.IntegerField()
    id_causa = models.IntegerField(null=True, blank=True)
    problema_encontrado = models.TextField(null=True, blank=True)
    accion_propuesta = models.TextField(null=True, blank=True)
    responsable = models.CharField(max_length=300, null=True, blank=True)
    fecha_inicio = models.CharField(max_length=20, null=True, blank=True)
    fecha_fin = models.CharField(max_length=20, null=True, blank=True)
    estado = models.CharField(max_length=50, null=True, blank=True)
    sigma_antes = models.FloatField(null=True, blank=True)
    sigma_despues = models.FloatField(null=True, blank=True)
    resultado = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ss_mejoras"
        managed = False


class SSControl(models.Model):
    """Hoja 'control'. Fase CONTROL."""
    id_ctrl = models.IntegerField(primary_key=True)
    id_def = models.IntegerField()
    que_controlar = models.TextField(null=True, blank=True)
    como_medir = models.TextField(null=True, blank=True)
    limite_superior = models.CharField(max_length=50, null=True, blank=True)
    limite_central = models.CharField(max_length=50, null=True, blank=True)
    limite_inferior = models.CharField(max_length=50, null=True, blank=True)
    frecuencia = models.CharField(max_length=100, null=True, blank=True)
    responsable = models.CharField(max_length=300, null=True, blank=True)
    registro = models.CharField(max_length=300, null=True, blank=True)
    accion_correctiva = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ss_control"
        managed = False


class SSHistorico(models.Model):
    """Hoja 'historico'. Bitácora DMAIC."""
    id_hist = models.IntegerField(primary_key=True)
    fecha_hora = models.CharField(max_length=30, null=True, blank=True)
    proceso = models.CharField(max_length=500, null=True, blank=True)
    fase_dmaic = models.CharField(max_length=50, null=True, blank=True)
    accion = models.CharField(max_length=200, null=True, blank=True)
    detalle = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ss_historico"
        managed = False
