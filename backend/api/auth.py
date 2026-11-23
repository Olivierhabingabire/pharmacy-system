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

    def __init__(self, id, email, role):
        self.id = id
        self.email = email
        self.role = role  # "pharmacist", "manager", or None if no profile row


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
        user = SupabaseUser(
            id=user_id,
            email=claims.get("email", ""),
            role=profile.role if profile else None,
        )
        return (user, token)

    def authenticate_header(self, request):
        # Makes DRF answer 401 (not 403) when authentication is missing or bad.
        return 'Bearer realm="api"'