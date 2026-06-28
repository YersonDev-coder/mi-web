"""Configuración del proyecto API REST."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG      = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "apps.autenticacion",
    "apps.gestion_procesos",
    "apps.inventario_procesos",
    "apps.fichas_procesos",
    "apps.indicadores",
    "apps.mejoras",
    "apps.six_sigma",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = "proyecto_api.urls"
WSGI_APPLICATION = "proyecto_api.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     os.getenv("DB_NAME",     "automatizacion_procesos"),
        "USER":     os.getenv("DB_USER",     "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST":     os.getenv("DB_HOST",     "localhost"),
        "PORT":     os.getenv("DB_PORT",     "5432"),
    }
}

# ── Correo electrónico (Gmail SMTP) ──────────────────────────────────────────
EMAIL_BACKEND      = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST         = "smtp.gmail.com"
EMAIL_PORT         = 587
EMAIL_USE_TLS      = True
EMAIL_HOST_USER    = os.getenv("EMAIL_HOST_USER",     "")
EMAIL_HOST_PASSWORD= os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = f"Sistema de Gestión <{os.getenv('EMAIL_HOST_USER', '')}>"

# ── WhatsApp (CallMeBot) ──────────────────────────────────────────────────────
SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")

CALLMEBOT = {
    "phone":  os.getenv("CALLMEBOT_PHONE",  ""),
    "apikey": os.getenv("CALLMEBOT_APIKEY", ""),
}

LANGUAGE_CODE      = "es"
TIME_ZONE          = "America/Lima"
USE_TZ             = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        # Solo errores 5xx — silencia 401, 403, 404
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        # Silencia el log de acceso por petición del runserver
        "django.server":  {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django":         {"handlers": ["console"], "level": "WARNING"},
    },
}
