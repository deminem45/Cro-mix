#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
if [[ ! -f .env ]]; then cp .env.example .env; fi
set -a
# shellcheck disable=SC1091
source .env
set +a
exec .venv/bin/python -m uvicorn app:app --host "${ASR_HOST:-127.0.0.1}" --port "${ASR_PORT:-8765}"
