#!/usr/bin/env bash
# Starts the PostgreSQL server that ships with the GitHub ubuntu-24.04 runner and sets the
# password used by tests/db (TEST_DATABASE_URL). No Docker and no service containers.
set -euo pipefail
sudo systemctl start postgresql.service
for _ in $(seq 1 20); do
  if pg_isready -q -h localhost; then break; fi
  sleep 1
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "alter user postgres password 'postgres';"
psql --version
