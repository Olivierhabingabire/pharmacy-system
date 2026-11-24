from rest_framework.throttling import ScopedRateThrottle


class RegistrationIPThrottle(ScopedRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }
