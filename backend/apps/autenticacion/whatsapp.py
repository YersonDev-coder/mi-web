"""Integración CallMeBot para notificaciones WhatsApp."""
import threading
import urllib.parse
import urllib.request
from django.conf import settings


def _enviar(texto: str) -> bool:
    cfg    = getattr(settings, "CALLMEBOT", {})
    phone  = cfg.get("phone",  "")
    apikey = cfg.get("apikey", "")
    if not phone or not apikey:
        return False
    url = (
        "https://api.callmebot.com/whatsapp.php"
        f"?phone={phone}&text={urllib.parse.quote(texto)}&apikey={apikey}"
    )
    try:
        with urllib.request.urlopen(url, timeout=15):
            return True
    except Exception:
        return False


def enviar_whatsapp(texto: str):
    """Envía en segundo plano para no bloquear la respuesta HTTP."""
    threading.Thread(target=_enviar, args=(texto,), daemon=True).start()
