import os

import jwt
from jwt import PyJWKClient
from rest_framework import authentication, exceptions

from .models import Profile

ISSUER = f"{os.environ['SUPABASE_URL'].rstrip('/')}/auth/v1"

# The public keys Supabase publishes. PyJWKClient caches them in memory.
_jwks = PyJWKClient(f"{ISSUER}/.well-known/jwks.json", cache_keys=True)


class SupabaseUser:
    """The person making the request, as proven by a verified Supabase token."""

    is_authenticated = True

    def __init__(self, id, email, role, full_name="", is_active=True):
        self.id = id
        self.pk = id
        self.email = email
        self.role = role  # "pharmacist", "manager", or None if no profile row
        self.full_name = full_name
        self.is_active = is_active


class SupabaseAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None  # no token: the permission check will answer 401

        token = header[len("Bearer "):].strip()
        try:
            signing_key = _jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                issuer=ISSUER,
            )
        except jwt.PyJWTError:
            raise exceptions.AuthenticationFailed("Invalid or expired token.")

        user_id = claims["sub"]
        profile = Profile.objects.filter(id=user_id).first()
        user_metadata = claims.get("user_metadata")
        token_name = (
            user_metadata.get("full_name", "")
            if isinstance(user_metadata, dict)
            else ""
        )
        user = SupabaseUser(
            id=user_id,
            email=claims.get("email", ""),
            role=profile.role if profile and profile.is_active else None,
            full_name=profile.full_name if profile else token_name,
            is_active=profile.is_active if profile else True,
        )
        return (user, token)

    def authenticate_header(self, request):
        # Makes DRF answer 401 (not 403) when authentication is missing or bad.
        return 'Bearer realm="api"'