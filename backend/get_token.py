"""Signs in to Supabase and prints a token for curl commands.

Run from the backend folder (any Python 3 works, no packages needed):

    python get_token.py

It reads the Supabase address from backend/.env and the publishable key from
frontend/.env.local, asks for an email and password (the password is hidden),
and prints one line to paste into your terminal. Tokens last about an hour.
"""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read_env(path):
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main():
    backend = read_env(HERE / ".env")
    frontend = read_env(HERE.parent / "frontend" / ".env.local")
    url = (os.environ.get("SUPABASE_URL") or backend.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_KEY") or frontend.get(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""
    )
    if not url or not key:
        sys.exit(
            "Missing SUPABASE_URL (backend/.env) or the publishable key "
            "(frontend/.env.local). See the README, section 'Run it locally'."
        )

    email = input("Email: ").strip()
    password = getpass.getpass("Password (hidden): ")

    request = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"apikey": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            token = json.loads(response.read())["access_token"]
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read())
            message = detail.get("msg") or detail.get("message") or error.code
        except ValueError:
            message = error.code
        sys.exit(f"Sign-in failed: {message}")
    except urllib.error.URLError as error:
        sys.exit(f"Could not reach Supabase: {error.reason}")

    print(f"\nSigned in as {email}. The token works for about an hour.\n")
    print("Command Prompt (cmd):  copy this line, paste it, press Enter")
    print(f"  set TOKEN={token}\n")
    print("PowerShell:")
    print(f'  $env:TOKEN="{token}"\n')
    print("macOS / Linux:")
    print(f'  export TOKEN="{token}"\n')


main()