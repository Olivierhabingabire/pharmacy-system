from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role in self.allowed_roles
        )


class IsManager(HasRole):
    allowed_roles = ("manager",)


class IsCustomer(HasRole):
    allowed_roles = ("customer",)


class IsStaff(HasRole):
    """Any signed-in person with a role: pharmacist or manager."""

    allowed_roles = ("pharmacist", "manager")


class IsAccountUser(HasRole):
    allowed_roles = ("customer", "pharmacist", "manager")


class ManagerCanWrite(BasePermission):
    """Staff may read; only managers may create, change or delete."""

    def has_permission(self, request, view):
        permission = IsStaff() if request.method in SAFE_METHODS else IsManager()
        return permission.has_permission(request, view)