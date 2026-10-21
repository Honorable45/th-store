#!/usr/bin/env bash
# Démarre un cluster PostgreSQL local, propre au projet (aucun droit administrateur requis).
# Usage : ./scripts/dev-db.sh start | stop | status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.pgdata"
PORT="${PGPORT_DEV:-5434}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"

case "${1:-start}" in
  start)
    if [ ! -d "$DATA" ]; then
      initdb -D "$DATA" -U thstore --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
      echo "Cluster initialisé dans $DATA"
    fi
    if ! pg_ctl -D "$DATA" status >/dev/null 2>&1; then
      pg_ctl -D "$DATA" -l "$DATA/server.log" -o "-p $PORT -k /tmp -c listen_addresses=localhost" start >/dev/null
    fi
    for db in thstore thstore_test; do
      psql -h localhost -p "$PORT" -U thstore -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
        || createdb -h localhost -p "$PORT" -U thstore "$db"
    done
    echo "PostgreSQL prêt : postgresql://thstore@localhost:$PORT/thstore"
    ;;
  stop) pg_ctl -D "$DATA" stop ;;
  status) pg_ctl -D "$DATA" status ;;
  *) echo "Usage : $0 start|stop|status"; exit 1 ;;
esac
