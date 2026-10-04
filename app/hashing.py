import hashlib
import hmac
import logging

from app.config import settings

_log = logging.getLogger(__name__)
_SALT_WARNED = False


def hash_device_id(device_id: str) -> str:
    global _SALT_WARNED
    salt = settings.device_hash_salt or settings.jwt_secret
    if not settings.device_hash_salt and not _SALT_WARNED:
        _SALT_WARNED = True
        _log.warning("DEVICE_HASH_SALT is empty; hashing device ids with JWT_SECRET")
    return hmac.new(salt.encode("utf-8"), device_id.encode("utf-8"), hashlib.sha256).hexdigest()
