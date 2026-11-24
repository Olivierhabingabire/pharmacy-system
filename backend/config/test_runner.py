from django.apps import apps
from django.test.runner import DiscoverRunner


class ManagedModelTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self._unmanaged = [m for m in apps.get_models() if not m._meta.managed]
        for model in self._unmanaged:
            model._meta.managed = True

    def teardown_test_environment(self, **kwargs):
        super().teardown_test_environment(**kwargs)
        for model in self._unmanaged:
            model._meta.managed = False