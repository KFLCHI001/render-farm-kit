#!/usr/bin/env bash
# session.sh: run ComfyUI on a RunPod Secure Cloud pod from the PC (Git Bash or Linux/macOS).
#
#   session.sh up --gpu "NVIDIA H100 80GB HBM3" --volume <volume id> [--models "h3 wan"] [options]
#   session.sh volume create --name comfy --size 150 --dc EU-RO-1
#   session.sh volume list | volume delete <id> --yes
#   session.sh gpus [--dc EU-RO-1]       GPU prices and stock per data centre
#   session.sh status                    pods on the account with their hourly cost
#   session.sh down [pod id]             terminate the pod (default: the one this tool started last)
#   session.sh reap                      terminate every pod whose name starts with "rfk-"
#
# `up` creates the pod, waits for SSH, copies and runs setup-pod.sh, opens a tunnel
# (localhost:8188 -> pod:8188) and then stays in the foreground. The pod is TERMINATED when
# you press Ctrl+C, when this script is killed with a signal that can be trapped, when
# --max-hours is reached (default 4), or on any error, unless you pass --keep. The same
# limit is also set on RunPod's side (--terminate-after), so a killed shell cannot leak a pod.
#
# up options:
#   --gpu ID            gpu id from `session.sh gpus` (or env RUNPOD_GPU)
#   --dc ID             data centre; taken from the volume when --volume is given
#   --volume ID         network volume, mounted at /workspace (keeps ComfyUI and models)
#   --pod-volume GB     /workspace size when there is no network volume (default 200)
#   --disk GB           container disk (default 40)
#   --image IMAGE       default runpod/pytorch:1.4.1-cu1281-torch291-ubuntu2404
#   --models "h3 wan"   model sets for setup-pod.sh (h3, wan, realism, all); default none
#   --setup-args "..."  extra arguments for setup-pod.sh (for example --update)
#   --max-hours N       hard runtime limit (default 4)
#   --keep              do not terminate the pod on exit (you pay until you run `down`)
#   --name NAME         pod name (default rfk-comfy-<date>)
#   --local-port N      local tunnel port (default 8188)
#   --no-setup          skip setup-pod.sh (pod and tunnel only)
#   --dry-run           print the create command and exit, spends nothing
#
# Environment: RUNPODCTL (path to runpodctl), RUNPOD_SSH_KEY (private key registered on the
# account, default ~/.ssh/id_ed25519_runpod), RUNPOD_SESSION_DIR (state and logs).
# The API key is read by runpodctl from its own config. This script never touches it.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${RUNPOD_SESSION_DIR:-$HOME/.cache/rfk-runpod}"
KEY="${RUNPOD_SSH_KEY:-$HOME/.ssh/id_ed25519_runpod}"
NAME_PREFIX="rfk-"
DEFAULT_IMAGE="runpod/pytorch:1.4.1-cu1281-torch291-ubuntu2404"
SSH_WAIT="${SSH_WAIT:-1200}"

log() { printf '[session %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '[session %s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

RUNPODCTL="${RUNPODCTL:-}"
if [[ -z $RUNPODCTL ]]; then RUNPODCTL="$(command -v runpodctl || command -v runpodctl.exe || true)"; fi
[[ -n $RUNPODCTL ]] || die "runpodctl not found. Put it on PATH or set RUNPODCTL."

PYTHON="${PYTHON:-}"
if [[ -z $PYTHON ]]; then
  for c in python3 python py; do
    if "$c" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then PYTHON="$c"; break; fi
  done
fi
[[ -n $PYTHON ]] || die "python 3 not found (used to read runpodctl's JSON)"

rp() { "$RUNPODCTL" "$@"; }

# first value of KEY anywhere in the JSON on stdin
jfind() {
  "$PYTHON" -c '
import json, sys
key = sys.argv[1]
def find(o):
    if isinstance(o, dict):
        if key in o and not isinstance(o[key], (dict, list)) and o[key] not in (None, ""):
            return o[key]
        for v in o.values():
            r = find(v)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find(v)
            if r is not None:
                return r
try:
    r = find(json.load(sys.stdin))
except Exception:
    r = None
print("" if r is None else r)
' "$1"
}

# ---------------------------------------------------------------------------
# terminate helpers
# ---------------------------------------------------------------------------

pod_exists() { rp pod list -a 2>/dev/null | "$PYTHON" -c '
import json, sys
pid = sys.argv[1]
try:
    pods = json.load(sys.stdin)
except Exception:
    sys.exit(2)
pods = pods if isinstance(pods, list) else pods.get("pods", [])
sys.exit(0 if any(p.get("id") == pid and p.get("desiredStatus") not in ("TERMINATED",) for p in pods) else 1)
' "$1"; }

terminate_pod() { # id
  local id=$1 i
  for i in 1 2 3 4 5; do
    rp pod delete "$id" >/dev/null 2>&1 || true
    sleep 3
    pod_exists "$id"; local rc=$?
    if [[ $rc -eq 1 ]]; then log "pod $id terminated"; return 0; fi
    log "terminate attempt $i for $id did not confirm (rc=$rc), retrying"
  done
  printf '\n!!! POD %s MAY STILL BE RUNNING AND BILLING !!!\n    run: %s pod delete %s\n    or check https://www.runpod.io/console/pods\n\n' "$id" "$RUNPODCTL" "$id" >&2
  return 1
}

# ---------------------------------------------------------------------------
# subcommands
# ---------------------------------------------------------------------------

cmd_volume() {
  local sub="${1:-}"; shift || true
  case "$sub" in
    create)
      local name="" size="" dc=""
      while (($#)); do case "$1" in
        --name) name=$2; shift ;; --size) size=$2; shift ;; --dc) dc=$2; shift ;;
        *) die "volume create: unknown option $1" ;; esac; shift; done
      [[ -n $name && -n $size && -n $dc ]] || die "usage: volume create --name N --size GB --dc DATACENTER (see: session.sh gpus)"
      log "creating network volume '$name', $size GB in $dc (about \$$("$PYTHON" -c "print(round($size*0.07,2))") per month at \$0.07/GB-month)"
      rp nv create --name "$name" --size "$size" --data-center-id "$dc"
      ;;
    list)
      rp nv list | "$PYTHON" -c '
import json, sys
v = json.load(sys.stdin)
v = v if isinstance(v, list) else v.get("networkVolumes", v.get("volumes", []))
if not v: print("no network volumes")
for x in v:
    size = x.get("size") or x.get("sizeInGb")
    print("%s  %s  %s GB  %s  (about $%.2f/month)" % (x.get("id"), x.get("name"), size, x.get("dataCenterId"), (size or 0) * 0.07))
'
      ;;
    delete)
      local id="${1:-}"; shift || true
      [[ -n $id ]] || die "usage: volume delete <id> --yes"
      [[ "${1:-}" == "--yes" ]] || die "deleting a volume destroys ComfyUI and every model on it. Add --yes to confirm."
      rp nv delete "$id"
      ;;
    *) die "usage: volume create|list|delete" ;;
  esac
}

cmd_gpus() {
  local dc=""
  while (($#)); do case "$1" in --dc) dc=$2; shift ;; *) die "gpus: unknown option $1" ;; esac; shift; done
  rp gpu list | "$PYTHON" -c '
import json, sys
dc = sys.argv[1]
rows = []
for g in json.load(sys.stdin):
    if not g.get("secureCloud"):
        continue
    stock = {a["dataCenterId"]: a.get("stockStatus") for a in g.get("dataCenterAvailability") or []}
    if dc and not stock.get(dc):
        continue
    where = ", ".join(f"{k}:{v}" for k, v in sorted(stock.items()) if v and v != "none")
    rows.append((g.get("securePricePerHr") or 0, g["gpuId"], g.get("memoryInGb"), where or "no stock"))
for price, gid, mem, where in sorted(rows):
    print(f"${price:<6} /h  {mem:>3} GB  {gid}   [{where}]")
' "$dc"
}

cmd_status() {
  rp pod list -a | "$PYTHON" -c '
import json, sys
pods = json.load(sys.stdin)
pods = pods if isinstance(pods, list) else pods.get("pods", [])
if not pods: print("no pods")
for p in pods:
    print(p.get("id"), p.get("name"), p.get("desiredStatus"), "$%s/h" % p.get("costPerHr"), p.get("gpuTypeId") or "")
'
}

cmd_down() {
  local id="${1:-}"
  if [[ -z $id && -f $STATE_DIR/last-pod ]]; then id="$(cat "$STATE_DIR/last-pod")"; fi
  [[ -n $id ]] || die "usage: down <pod id>"
  terminate_pod "$id"
}

cmd_reap() {
  local ids id
  ids="$(rp pod list -a | "$PYTHON" -c '
import json, sys
pods = json.load(sys.stdin)
pods = pods if isinstance(pods, list) else pods.get("pods", [])
for p in pods:
    if str(p.get("name", "")).startswith(sys.argv[1]) and p.get("desiredStatus") != "TERMINATED":
        print(p["id"])
' "$NAME_PREFIX")"
  [[ -n $ids ]] || { log "no ${NAME_PREFIX}* pods to remove"; return 0; }
  for id in $ids; do terminate_pod "$id"; done
}

# ---------------------------------------------------------------------------
# up
# ---------------------------------------------------------------------------

POD_ID="" TUNNEL_PID="" KEEP=0 CLEANED=0
SSH_IP="" SSH_PORT=""

ssh_opts() {
  printf '%s\n' -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    -o IdentitiesOnly=yes -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ConnectTimeout=10
}
pod_ssh() { # command...
  local opts=(); while IFS= read -r l; do opts+=("$l"); done < <(ssh_opts)
  ssh "${opts[@]}" -p "$SSH_PORT" "root@$SSH_IP" "$@"
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM HUP
  if ((CLEANED)); then exit "$rc"; fi
  CLEANED=1
  if [[ -n $TUNNEL_PID ]]; then kill "$TUNNEL_PID" 2>/dev/null || true; fi
  if [[ -n $POD_ID ]]; then
    if ((KEEP)); then
      log "pod $POD_ID KEPT and still billing. End it with: $0 down $POD_ID"
    else
      log "terminating pod $POD_ID"
      terminate_pod "$POD_ID" || rc=1
    fi
  fi
  exit "$rc"
}

cmd_up() {
  local gpu="${RUNPOD_GPU:-}" dc="" vol="" podvol=200 disk=40 image="$DEFAULT_IMAGE" models="" setup_args=""
  local hours=4 name="" lport=8188 setup=1 dry=0 gpu_count=1 cuda="12.8"
  while (($#)); do case "$1" in
    --gpu) gpu=$2; shift ;; --dc) dc=$2; shift ;; --volume) vol=$2; shift ;; --pod-volume) podvol=$2; shift ;;
    --disk) disk=$2; shift ;; --image) image=$2; shift ;; --models) models=$2; shift ;;
    --setup-args) setup_args=$2; shift ;; --max-hours) hours=$2; shift ;; --keep) KEEP=1 ;;
    --name) name=$2; shift ;; --local-port) lport=$2; shift ;; --no-setup) setup=0 ;;
    --gpu-count) gpu_count=$2; shift ;; --dry-run) dry=1 ;;
    *) die "up: unknown option $1" ;; esac; shift; done
  [[ -n $gpu ]] || die "up: --gpu is required (see: $0 gpus). Nothing was created."
  [[ -f $KEY ]] || die "SSH key $KEY not found. Set RUNPOD_SSH_KEY to the private key registered on your RunPod account."
  name="${name:-${NAME_PREFIX}comfy-$(date +%m%d-%H%M)}"
  [[ $name == "$NAME_PREFIX"* ]] || name="$NAME_PREFIX$name"

  if [[ -n $vol ]]; then
    local vdc; vdc="$(rp nv get "$vol" 2>/dev/null | jfind dataCenterId)"
    [[ -n $vdc ]] || die "could not read network volume $vol (run: $0 volume list)"
    if [[ -n $dc && $dc != "$vdc" ]]; then die "volume $vol lives in $vdc but --dc is $dc"; fi
    dc="$vdc"
    log "network volume $vol is in $dc, the pod is created there"
  fi

  local mins; mins="$("$PYTHON" -c "print(int(float('$hours') * 60))")"
  local until; until="$(date -u -d "+$mins minutes" +%Y-%m-%dT%H:%M:%SZ)"
  local args=(pod create --cloud-type SECURE --compute-type GPU --gpu-id "$gpu" --gpu-count "$gpu_count"
              --image "$image" --container-disk-in-gb "$disk" --name "$name" --ports 22/tcp
              --min-cuda-version "$cuda" --terminate-after "$until")
  if [[ -n $dc ]]; then args+=(--data-center-ids "$dc"); fi
  if [[ -n $vol ]]; then args+=(--network-volume-id "$vol"); else args+=(--volume-in-gb "$podvol" --volume-mount-path /workspace); fi

  local price
  price="$(rp gpu list 2>/dev/null | "$PYTHON" -c '
import json, sys
found = "?"
for g in json.load(sys.stdin):
    if g["gpuId"] == sys.argv[1]:
        found = g.get("securePricePerHr", "?")
print(found)
' "$gpu" 2>/dev/null || true)"
  if [[ $price == "?" || -z $price ]]; then die "gpu id '$gpu' is not in the Secure Cloud list. Run: $0 gpus"; fi
  log "plan: $gpu x$gpu_count, Secure Cloud${dc:+, $dc}, listed price \$${price:-?}/h, max runtime ${hours}h (RunPod also ends it at $until)"
  if ((dry)); then
    printf '%s' "$RUNPODCTL"; printf ' %q' "${args[@]}"; printf '\n'
    log "dry run, nothing created"
    return 0
  fi

  mkdir -p "$STATE_DIR"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM HUP

  # a free local port first, so a busy 8188 does not cost a pod
  if (exec 3<>"/dev/tcp/127.0.0.1/$lport") 2>/dev/null; then die "local port $lport is already in use (another ComfyUI or tunnel?). Use --local-port."; fi

  local out; out="$(rp "${args[@]}" 2>&1)" || { printf '%s\n' "$out" >&2; die "pod create failed. If it is stock, try another --gpu or see: $0 gpus --dc ${dc:-<dc>}"; }
  POD_ID="$(printf '%s' "$out" | jfind id)"
  [[ -n $POD_ID ]] || { printf '%s\n' "$out" >&2; die "could not read the pod id from runpodctl's answer. Check $0 status and end any pod with $0 reap."; }
  printf '%s' "$POD_ID" >"$STATE_DIR/last-pod"
  local cost; cost="$(printf '%s' "$out" | jfind costPerHr)"
  log "POD $POD_ID  cost \$${cost:-?}/h  (terminates automatically at $until)"

  # wait for ssh
  local t0=$SECONDS waited=0 info
  while :; do
    info="$(rp ssh info "$POD_ID" 2>/dev/null || true)"
    SSH_IP="$(printf '%s' "$info" | jfind ip)"; SSH_PORT="$(printf '%s' "$info" | jfind port)"
    if [[ -n $SSH_IP && -n $SSH_PORT ]] && pod_ssh true >/dev/null 2>&1; then break; fi
    local st; st="$(rp pod get "$POD_ID" 2>/dev/null | jfind desiredStatus)"
    if [[ $st == EXITED || $st == TERMINATED ]]; then die "pod $POD_ID went to $st before SSH came up"; fi
    ((SECONDS - t0 < SSH_WAIT)) || die "no SSH after ${SSH_WAIT}s (image pull can take a while on a cold host). Pod will be terminated."
    if (((SECONDS - t0) % 30 < 6)); then log "waiting for ssh (${waited}s, status ${st:-unknown}${SSH_PORT:+, port $SSH_PORT})"; fi
    sleep 6; waited=$((SECONDS - t0))
  done
  log "ssh ready: root@$SSH_IP -p $SSH_PORT (after $((SECONDS - t0))s)"

  local deadline=$((SECONDS + mins * 60 - (SECONDS - t0)))

  if ((setup)); then
    pod_ssh "cat > /root/setup-pod.sh" <"$SCRIPT_DIR/setup-pod.sh" || die "could not copy setup-pod.sh"
    local sets="$models $setup_args"
    log "running setup-pod.sh $sets (follow-up log: /workspace/setup.log on the pod)"
    pod_ssh "mkdir -p /workspace && : > /workspace/setup.log && (setsid nohup bash -c 'BASE=/workspace bash /root/setup-pod.sh $sets; echo \"[exit \$?]\"' >>/workspace/setup.log 2>&1 </dev/null &) ; sleep 1" || die "could not start setup-pod.sh"
    local off=1 chunk n code="" logf="$STATE_DIR/setup-$(date +%Y%m%d-%H%M%S).log"
    while [[ -z $code ]]; do
      if chunk="$(pod_ssh "tail -n +$off /workspace/setup.log" 2>/dev/null)"; then
        if [[ -n $chunk ]]; then
          printf '%s\n' "$chunk" | tee -a "$logf"
          n="$(printf '%s\n' "$chunk" | wc -l)"; off=$((off + n))
          code="$(printf '%s\n' "$chunk" | sed -n 's/^\[exit \([0-9]*\)\]$/\1/p' | tail -1)"
        fi
      fi
      ((SECONDS < deadline)) || die "max runtime reached during setup"
      [[ -n $code ]] || sleep 8
    done
    [[ $code == 0 ]] || die "setup-pod.sh failed (exit $code). Log: $logf. The pod will be terminated, models stay on the network volume."
  fi

  # tunnel
  local opts=(); while IFS= read -r l; do opts+=("$l"); done < <(ssh_opts)
  start_tunnel() {
    ssh -N -L "127.0.0.1:$lport:127.0.0.1:8188" "${opts[@]}" -o ExitOnForwardFailure=yes -p "$SSH_PORT" "root@$SSH_IP" &
    TUNNEL_PID=$!
  }
  start_tunnel
  local i
  for i in $(seq 1 20); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$lport/system_stats" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if ! curl -fsS --max-time 3 "http://127.0.0.1:$lport/system_stats" >/dev/null 2>&1; then
    log "WARNING: tunnel is up but ComfyUI is not answering yet (use --no-setup only if ComfyUI is already running on the pod)"
  fi

  cat <<EOF

  ComfyUI:  http://127.0.0.1:$lport   (SSH tunnel to pod $POD_ID)
  Pod cost: \$${cost:-?}/h, stops at $until at the latest
  Run:      python comfy_run.py jobs/example.json --server http://127.0.0.1:$lport
  Stop:     press Ctrl+C here, or run: $0 down $POD_ID
  SSH:      ssh -i $KEY -p $SSH_PORT root@$SSH_IP

EOF

  local last_check=$SECONDS
  while ((SECONDS < deadline)); do
    sleep 10
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      log "tunnel died, restarting"; start_tunnel
    fi
    if ((SECONDS - last_check >= 120)); then
      last_check=$SECONDS
      pod_exists "$POD_ID"; local rc=$?
      if [[ $rc -eq 1 ]]; then log "pod $POD_ID no longer exists (ended on RunPod's side), stopping"; POD_ID=""; return 0; fi
    fi
  done
  log "max runtime of ${hours}h reached"
}

# ---------------------------------------------------------------------------

case "${1:-}" in
  volume) shift; cmd_volume "$@" ;;
  gpus) shift; cmd_gpus "$@" ;;
  status) cmd_status ;;
  down) shift; cmd_down "$@" ;;
  reap) cmd_reap ;;
  up) shift; cmd_up "$@" ;;
  ""|-h|--help) sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//' ;;
  -*) cmd_up "$@" ;;
  *) die "unknown command '$1'. Try: $0 --help" ;;
esac
