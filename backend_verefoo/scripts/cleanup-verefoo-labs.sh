#!/usr/bin/env bash
set -euo pipefail

prefix="verefoo-lab-"
labs="$(
  docker ps -a \
    --filter label=containerlab \
    --format '{{.Label "containerlab"}}' |
    sed '/^$/d' |
    grep "^${prefix}" |
    sort -u || true
)"

if [[ -z "$labs" ]]; then
  echo "No Verefoo Containerlab labs found."
  exit 0
fi

while IFS= read -r lab; do
  [[ -n "$lab" ]] || continue
  echo "Destroying $lab"
  containerlab destroy --name "$lab" --cleanup
done <<< "$labs"
