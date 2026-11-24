from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

MIGRATION_MODULES = {"api": None}

TEST_RUNNER = "config.test_runner.ManagedModelTestRunner"