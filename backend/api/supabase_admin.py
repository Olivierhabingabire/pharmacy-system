import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


class SupabaseAdminError(Exception):
    def __init__(self, status_code):
        self.status_code = status_code


class SupabaseAdminConfigurationError(Exception):
    pass


class SupabaseAdminUnavailable(Exception):
    pass


def _admin_request(method, path, payload=None):
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SupabaseAdminConfigurationError(
            "Supabase admin credentials are not configured."
        )

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{url}/auth/v1/admin/{path}",
        data=data,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urlopen(request, timeout=10) as response:
            response_body = response.read()
    except HTTPError as error:
        logger.warning("Supabase admin API returned HTTP %s.", error.code)
        raise SupabaseAdminError(error.code) from error
    except (URLError, TimeoutError) as error:
        logger.error("Supabase admin API request failed.")
        raise SupabaseAdminUnavailable from error

    if not response_body:
        return {}
    try:
        return json.loads(response_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        logger.error("Supabase admin API returned an invalid response.")
        raise SupabaseAdminUnavailable from error


def create_confirmed_user(email, password, full_name):
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": full_name},
    }
    try:
        user = _admin_request("POST", "users", payload)
    except SupabaseAdminError as error:
        if error.status_code not in (409, 422):
            raise
        user = _confirm_existing_unconfirmed_user(
            email, payload, error.status_code
        )

    user_id = user.get("id")
    if not user_id:
        logger.error("Supabase admin API created a user without returning an id.")
        raise SupabaseAdminUnavailable
    return user_id


def _confirm_existing_unconfirmed_user(email, payload, original_status):
    normalized_email = email.casefold()
    existing_confirmed_user = False
    for page in range(1, 101):
        result = _admin_request(
            "GET",
            f"users?{urlencode({'page': page, 'per_page': 1000})}",
        )
        users = result.get("users", [])
        if not users:
            break
        for user in users:
            if (user.get("email") or "").casefold() != normalized_email:
                continue
            if user.get("email_confirmed_at"):
                existing_confirmed_user = True
                continue
            return _admin_request("PUT", f"users/{user['id']}", payload)
        if len(users) < 1000:
            break

    raise SupabaseAdminError(
        409 if existing_confirmed_user else original_status
    )


def delete_user(user_id):
    _admin_request("DELETE", f"users/{user_id}")
