"""Modelos del módulo Ficha de Indicador (7 tablas + estado de proceso)."""
from django.db import models


class Indicador(models.Model):
    """Hoja 'indicadores'. Datos maestros. Un proceso puede tener varios."""
    id_indicador = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    codigo = models.CharField(max_length=100, null=True, blank=True)
    nombre_indicador = models.CharField(max_length=500, null=True, blank=True)
    tipo = models.CharField(max_length=100, null=True, blank=True)
    justificacion = models.TextField(null=True, blank=True)
    responsable = models.CharField(max_length=300, null=True, blank=True)
    metodo_calculo = models.TextField(null=True, blank=True)
    sentido_esperado = models.CharField(max_length=50, null=True, blank=True)
    unidad_medida = models.CharField(max_length=100, null=True, blank=True)
    frecuencia = models.CharField(max_length=50, null=True, blank=True)
    fuente_datos = models.CharField(max_length=300, null=True, blank=True)
    periodicidad = models.CharField(max_length=50, null=True, blank=True)
    fecha_inicio = models.CharField(max_length=20, null=True, blank=True)
    fecha_fin = models.CharField(max_length=20, null=True, blank=True)
    meta_final = models.FloatField(null=True, blank=True)
    tipo_agregacion = models.CharField(max_length=100, null=True, blank=True)
    relevancia = models.FloatField(null=True, blank=True)
    linea_base_anio = models.IntegerField(null=True, blank=True)
    linea_base_valor = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "indicador"
        managed = False


class IndRango(models.Model):
    """Hoja 'rangos'. Semáforo. IDs desde 1000."""
    id_rango = models.IntegerField(primary_key=True)
    id_indicador = models.IntegerField()
    etiqueta = models.CharField(max_length=200, null=True, blank=True)
    color = models.CharField(max_length=30, null=True, blank=True)
    desde = models.FloatField(null=True, blank=True)
    hasta = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "ind_rango"
        managed = False


class IndLogro(models.Model):
    """Hoja 'logros'. Cronograma planificado. IDs desde 2000."""
    id_logro = models.IntegerField(primary_key=True)
    id_indicador = models.IntegerField()
    periodo = models.CharField(max_length=100, null=True, blank=True)
    es_linea_base = models.BooleanField(default=False)
    valor_planificado = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "ind_logro"
        managed = False


class IndAvance(models.Model):
    """Hoja 'avance'. Avance real. IDs desde 3000."""
    id_avance = models.IntegerField(primary_key=True)
    id_indicador = models.IntegerField()
    periodo = models.CharField(max_length=100, null=True, blank=True)
    valor_real = models.FloatField(null=True, blank=True)
    fecha_registro = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = "ind_avance"
        managed = False


class IndObjetivo(models.Model):
    """Hoja 'objetivos'. SMART. IDs desde 4000."""
    id_objetivo = models.IntegerField(primary_key=True)
    id_indicador = models.IntegerField()
    codigo = models.CharField(max_length=100, null=True, blank=True)
    descripcion = models.TextField(null=True, blank=True)
    indicador_texto = models.TextField(null=True, blank=True)
    especifico = models.TextField(null=True, blank=True)
    relevante = models.TextField(null=True, blank=True)
    medible = models.TextField(null=True, blank=True)
    realizable = models.TextField(null=True, blank=True)
    temporal = models.TextField(null=True, blank=True)
    prioridad = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = "ind_objetivo"
        managed = False


class IndAccion(models.Model):
    """Hoja 'acciones'. SMART de cada objetivo. IDs desde 5000."""
    id_accion = models.IntegerField(primary_key=True)
    id_objetivo = models.IntegerField()
    id_indicador = models.IntegerField()
    codigo = models.CharField(max_length=100, null=True, blank=True)
    descripcion = models.TextField(null=True, blank=True)
    indicador_texto = models.TextField(null=True, blank=True)
    especifico = models.TextField(null=True, blank=True)
    relevante = models.TextField(null=True, blank=True)
    medible = models.TextField(null=True, blank=True)
    realizable = models.TextField(null=True, blank=True)
    temporal = models.TextField(null=True, blank=True)
    prioridad = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = "ind_accion"
        managed = False


class IndConfig(models.Model):
    """Hoja 'config'. clave→valor para notas/alertas del reporte."""
    clave = models.CharField(max_length=200, primary_key=True)
    valor = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ind_config"
        managed = False


class EstadoProceso(models.Model):
    """Reemplaza estados_proceso.json. Estado operativo por proceso."""
    id_proceso = models.IntegerField(primary_key=True)
    estado = models.CharField(max_length=20, default="en_ejecucion")

    class Meta:
        db_table = "estado_proceso"
        managed = False
