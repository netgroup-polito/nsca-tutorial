#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <public-ip>\n' "$0" >&2
  exit 1
fi

public_ip=$1

if [[ ! "$public_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  printf 'Error: invalid IPv4 address: %s\n' "$public_ip" >&2
  exit 1
fi

IFS=. read -r -a octets <<< "$public_ip"
for octet in "${octets[@]}"; do
  if (( 10#$octet > 255 )); then
    printf 'Error: invalid IPv4 address: %s\n' "$public_ip" >&2
    exit 1
  fi
done

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
backend_constants="$repo_root/backend_verefoo/src/utils/constants.ts"
frontend_constants="$repo_root/verefoo_app/src/utils/constants.ts"

for file in "$backend_constants" "$frontend_constants"; do
  if [[ ! -f "$file" ]]; then
    printf 'Error: expected file not found: %s\n' "$file" >&2
    exit 1
  fi
done

backend_old_ip=$(sed -nE 's/.*(https?:\/\/)([0-9]+(\.[0-9]+){3})(:[0-9]+).*/\2/p' "$backend_constants" | head -n 1)
frontend_old_ip=$(sed -nE 's/.*(https?:\/\/)([0-9]+(\.[0-9]+){3})(:[0-9]+\/?).*/\2/p' "$frontend_constants" | head -n 1)

if [[ -z "$backend_old_ip" ]]; then
  printf 'Error: could not find the current public IP in %s\n' "$backend_constants" >&2
  exit 1
fi

if [[ -z "$frontend_old_ip" ]]; then
  printf 'Error: could not find the current public IP in %s\n' "$frontend_constants" >&2
  exit 1
fi

if [[ "$backend_old_ip" == "$public_ip" && "$frontend_old_ip" == "$public_ip" ]]; then
  printf 'Public IP is already set to %s\n' "$public_ip"
  exit 0
fi

if [[ "$backend_old_ip" != "$public_ip" ]]; then
  sed -i "s#http://${backend_old_ip}:5173#http://${public_ip}:5173#" "$backend_constants"
fi

if [[ "$frontend_old_ip" != "$public_ip" ]]; then
  sed -i "s#http://${frontend_old_ip}:3000/#http://${public_ip}:3000/#" "$frontend_constants"
fi

printf 'Updated public IP to %s in:\n' "$public_ip"
printf '  %s\n' "$backend_constants"
printf '  %s\n' "$frontend_constants"
