#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Ensuring journey_templates table exists..."
python ensure_journey_templates.py

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
