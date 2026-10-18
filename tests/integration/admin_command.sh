#!/bin/sh
cd /home/claude/careerbridge
SERVICE=$(python3 tests/integration/jwt.py postgres)
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3002
q() { curl -s -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" "http://127.0.0.1:3002/rest/v1/profiles?email=eq.$1&select=role"; }
runit() { echo "--- $1"; shift; env -i PATH="$PATH" NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL "$@" node scripts/make-admin.mjs $EMAIL > /tmp/ma.txt 2>&1; echo "exit code: $?"; grep -E "✔|✘" /tmp/ma.txt; }
echo "before: $(q b@x.com)"
EMAIL=b@x.com runit "promote an existing account (service key)" SUPABASE_SERVICE_ROLE_KEY=$SERVICE
echo "after:  $(q b@x.com)"
EMAIL=b@x.com runit "run again: already admin" SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EMAIL=nobody@x.com runit "unknown email" SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EMAIL=notanemail runit "invalid email" SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EMAIL=a@x.com runit "missing service key" 
CAND=$(python3 tests/integration/jwt.py authenticated $(curl -s -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" "http://127.0.0.1:3002/rest/v1/profiles?email=eq.a@x.com&select=id" | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])"))
EMAIL=a@x.com runit "a normal user's key must NOT be able to promote anyone" SUPABASE_SERVICE_ROLE_KEY=$CAND
echo "a@x.com role afterwards (must still be candidate): $(q a@x.com)"
