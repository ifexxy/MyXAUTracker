#!/usr/bin/env bash
set -euo pipefail
blocked_regex='\.(png|jpg|jpeg|gif|webp|ico|pdf|zip)$'
while IFS= read -r path; do
  if [[ "$path" =~ $blocked_regex ]] && [[ "$path" == public/legacy/* || "$path" == og-image.png ]]; then
    echo "Blocked binary asset for Codex compatibility: $path" >&2
    exit 1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMRT)
