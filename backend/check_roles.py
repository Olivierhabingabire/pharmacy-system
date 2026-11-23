"""Checks the 401 / 403 rules with real Supabase tokens.

It signs in as each test user, calls the API, and prints status codes only.
Passwords are typed hidden. Tokens are never printed or saved.
"""
import getpass
import json
import os
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://lkygktqzlgizhelcnabe.supabase.co"
).rstrip("/")
DJANGO_URL = os.environ.get("DJANGO_URL", "http://127.0.0.1:8000").rstrip("/")


def call(url, method="GET", headers=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method, headers=headers or {}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()
    except urllib.error.URLError as error:
        print(f"  Could not reach {url}: {error.reason}")
        return 0, b""


def sign_in(api_key, email, password):
    status, body = call(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        "POST",
        {"apikey": api_key, "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        payload = {}
    if status == 200 and payload.get("access_token"):
        return payload["access_token"]
    reason = payload.get("msg") or payload.get("message") or f"status {status}"
    print(f"  Sign-in failed for {email}: {reason}")
    return None


def check(label, expected, method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    status, _ = call(DJANGO_URL + path, method, headers, body)
    mark = "OK " if status == expected else "BAD"
    print(f"  {mark} {label:<44} {status}  (expected {expected})")


def main():
    print("Role check against", DJANGO_URL)
    api_key = input("Publishable key: ").strip()

    print("\nNo token")
    check("GET /api/medicines/", 401, "GET", "/api/medicines/")

    for email, role in (
        ("pharmacist@test.com", "pharmacist"),
        ("manager@test.com", "manager"),
    ):
        password = getpass.getpass(f"\nPassword for {email} (hidden): ")
        token = sign_in(api_key, email, password)
        if not token:
            continue
        print(f"{role.capitalize()} ({email})")
        check("GET /api/medicines/", 200, "GET", "/api/medicines/", token)
        if role == "pharmacist":
            check("GET /api/analytics/ (manager only)", 403, "GET",
                  "/api/analytics/", token)
            check("PATCH /api/medicines/999999/ (manager only)", 403, "PATCH",
                  "/api/medicines/999999/", token, {"stock": 1})
        else:
            check("GET /api/analytics/", 200, "GET", "/api/analytics/", token)
            # Allowed, so the answer is 404 (no such medicine), not 403.
            check("PATCH /api/medicines/999999/ (allowed, 404)", 404, "PATCH",
                  "/api/medicines/999999/", token, {"stock": 1})

    print("\nDone. OK = the rule behaves as designed.")


if __name__ == "__main__":
    main()