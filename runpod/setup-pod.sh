#!/usr/bin/env bash
# setup-pod.sh: runs ON the RunPod pod. Installs ComfyUI, downloads model sets,
# starts ComfyUI on 127.0.0.1:8188 and waits until it answers.
#
#   bash setup-pod.sh [options] [set ...]
#
# Sets:    h3  wan  realism  all
# Options: --update          move an existing ComfyUI checkout to the latest release tag
#          --restart         stop a running ComfyUI and start it again
#          --no-start        install and download only
#          --check           report which model files are present, change nothing
#          --stop            stop ComfyUI and exit
#          --print-manifest  print the model manifest and exit
#
# Environment: BASE (default /workspace), COMFY_PORT (8188), COMFY_REF (a tag or
# branch to pin instead of "latest release"), COMFY_ARGS (extra main.py flags),
# MAX_PARALLEL (downloads at once, default 6), COMFY_WAIT (seconds, default 600),
# HF_TOKEN (optional, only if Hugging Face rate limits you).
#
# Everything lives under $BASE so a network volume mounted there keeps the
# install and the models between pods (ComfyUI at $BASE/ComfyUI). It uses the
# image's python when CUDA torch is importable, and a venv only otherwise
# (USE_VENV=1 forces the venv). Re-running is safe: files that
# already exist with the right size are skipped.

set -euo pipefail

BASE="${BASE:-/workspace}"
PORT="${COMFY_PORT:-8188}"
COMFY_DIR="$BASE/ComfyUI"
MODELS="$COMFY_DIR/models"
VENV="$BASE/venv"
LOG="$BASE/comfy.log"
WORK="$BASE/.setup"
MAX_PARALLEL="${MAX_PARALLEL:-6}"
COMFY_WAIT="${COMFY_WAIT:-600}"
COMFY_ARGS="${COMFY_ARGS:-}"
COMFY_REPO="https://github.com/comfyanonymous/ComfyUI.git"

log() { printf '[setup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '[setup %s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }
gb() { awk -v b="$1" 'BEGIN { printf "%.1f", b / 1073741824 }'; }

# set|repo|path in repo|ComfyUI models folder|size in bytes (fallback, the live size wins)
manifest() {
  cat <<'MANIFEST'
h3|Comfy-Org/MiniMax-H3|diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors|diffusion_models|20958205608
h3|Comfy-Org/MiniMax-H3|text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors|text_encoders|27141342152
h3|Comfy-Org/MiniMax-H3|vae/minimax_h3_video_vae_fp16.safetensors|vae|5207808496
h3|Comfy-Org/MiniMax-H3|vae/minimax_h3_audio_vae_fp32.safetensors|vae|605254808
h3|lightx2v/Minimax-h3-Turbo|minimax_h3_ref2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors|loras|1956193000
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/diffusion_models/wan2.2_s2v_14B_fp8_scaled.safetensors|diffusion_models|16394832474
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors|diffusion_models|14294742832
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors|diffusion_models|14294742832
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors|text_encoders|6735906897
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/vae/wan_2.1_vae.safetensors|vae|253815318
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/audio_encoders/wav2vec2_large_english_fp16.safetensors|audio_encoders|630997322
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors|loras|1226977424
wan|Comfy-Org/Wan_2.2_ComfyUI_Repackaged|split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors|loras|1226977424
realism|fal/MiniMax-H3-Realism-People-LoRA|h3-realism-people-t2v-i2v-r2v.safetensors|loras|131229656
MANIFEST
}

# ---- arguments --------------------------------------------------------------
SETS=()
DO_UPDATE=0 DO_RESTART=0 DO_START=1 DO_CHECK=0 DO_STOP=0
while (($#)); do
  case "$1" in
    h3|wan|realism) SETS+=("$1") ;;
    all) SETS+=(h3 wan realism) ;;
    --update) DO_UPDATE=1 ;;
    --restart) DO_RESTART=1 ;;
    --no-start) DO_START=0 ;;
    --check) DO_CHECK=1 ;;
    --stop) DO_STOP=1 ;;
    --print-manifest) manifest; exit 0 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1 (sets are h3, wan, realism, all)" ;;
  esac
  shift
done

comfy_up() { curl -fsS --max-time 3 "http://127.0.0.1:$PORT/system_stats" >/dev/null 2>&1; }

stop_comfy() {
  pkill -f "main.py --listen 127.0.0.1 --port $PORT" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do comfy_up || return 0; sleep 1; done
  pkill -9 -f "main.py --listen 127.0.0.1 --port $PORT" 2>/dev/null || true
}

if ((DO_STOP)); then stop_comfy; log "ComfyUI stopped"; exit 0; fi

# manifest rows of the requested sets, one per line, without duplicates
selected_rows() {
  local s
  for s in ${SETS[@]+"${SETS[@]}"}; do
    manifest | awk -F'|' -v s="$s" '$1 == s'
  done | awk '!seen[$0]++'
  return 0
}

hf_headers=()
if [[ -n "${HF_TOKEN:-}" ]]; then hf_headers=(-H "Authorization: Bearer $HF_TOKEN"); fi

# Size of a file on the Hub (x-linked-size is set on the first redirect of LFS and Xet files).
remote_size() { # repo path
  curl -sSI --max-time 20 ${hf_headers[@]+"${hf_headers[@]}"} "https://huggingface.co/$1/resolve/main/$2" 2>/dev/null \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "x-linked-size" { print $2; exit }'
  return 0
}

file_size() { stat -c %s "$1" 2>/dev/null || echo 0; }

# ---- --check: report only --------------------------------------------------
if ((DO_CHECK)); then
  rows="$(selected_rows)"
  if [[ -z $rows ]]; then rows="$(manifest)"; fi
  missing=0
  while IFS='|' read -r _set repo path folder fallback; do
    name="$(basename "$path")"; dest="$MODELS/$folder/$name"
    want="$(remote_size "$repo" "$path")"; want="${want:-$fallback}"
    have="$(file_size "$dest")"
    if [[ $have == "$want" ]]; then printf 'ok       %-16s %s\n' "$folder" "$name"
    else printf 'MISSING  %-16s %s (have %s of %s bytes)\n' "$folder" "$name" "$have" "$want"; missing=1; fi
  done <<<"$rows"
  if comfy_up; then log "ComfyUI is answering on :$PORT"; else log "ComfyUI is not running"; fi
  exit $missing
fi

# ---- environment -------------------------------------------------------------
mkdir -p "$BASE" "$WORK/logs" "$WORK/stage"
: >"$WORK/done.txt"
export HF_HOME="$BASE/.hf-home"          # keep caches on the volume, not the small container disk
export HF_HUB_DISABLE_PROGRESS_BARS=1
export HF_XET_HIGH_PERFORMANCE=1
export PIP_CACHE_DIR="$BASE/.pip-cache"
export PIP_DISABLE_PIP_VERSION_CHECK=1

log "base=$BASE sets=${SETS[*]:-none}"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader | sed 's/^/[setup] gpu: /'
else
  log "WARNING: nvidia-smi not found, this pod has no GPU"
fi

command -v git >/dev/null || die "git is missing"
command -v curl >/dev/null || die "curl is missing"
command -v python3 >/dev/null || die "python3 is missing"

# ---- python: the image's own interpreter when it has CUDA torch, else a venv ---
# A venv inside $BASE (with the image's packages visible) is only the fallback.
PYV="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
if [[ "${USE_VENV:-0}" != 1 ]] && python3 -c 'import torch,sys; sys.exit(0 if torch.version.cuda else 1)' 2>/dev/null; then
  PY="$(command -v python3)"
  PYBIN="$(dirname "$PY")"
  MODE=system
  PIP=("$PY" -m pip install -q)
  if "$PY" -m pip install --help 2>/dev/null | grep -q -- --break-system-packages; then PIP+=(--break-system-packages); fi
  log "using the image's python ($PY, $PYV) with its CUDA torch"
else
  MODE=venv
  if [[ -x $VENV/bin/python ]] && [[ "$(cat "$VENV/.pyver" 2>/dev/null)" == "$PYV" ]] && "$VENV/bin/python" -c 'import sys' 2>/dev/null; then
    log "venv ok ($VENV, python $PYV)"
  else
    log "creating venv at $VENV (python $PYV)"
    rm -rf "$VENV"
    if ! python3 -m venv --system-site-packages "$VENV" 2>/dev/null; then
      log "python3-venv missing, installing it"
      (apt-get update -qq && apt-get install -y -qq python3-venv) >/dev/null 2>&1 || die "could not install python3-venv"
      rm -rf "$VENV"
      python3 -m venv --system-site-packages "$VENV" || die "venv creation failed"
    fi
    echo "$PYV" >"$VENV/.pyver"
  fi
  PY="$VENV/bin/python"; PYBIN="$VENV/bin"
  PIP=("$PY" -m pip install -q)
  if ! "$PY" -c 'import torch' 2>/dev/null; then
    log "torch is not visible from the image, installing the cu128 build"
    "${PIP[@]}" torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 || die "torch install failed"
  fi
fi
TORCH_V="$("$PY" -c 'import torch; print(torch.__version__)')"
log "torch $TORCH_V (python mode: $MODE)"

if ! "$PY" -c 'import huggingface_hub' 2>/dev/null || [[ ! -x $PYBIN/hf ]]; then
  log "installing huggingface_hub"
  "${PIP[@]}" -U huggingface_hub || die "huggingface_hub install failed"
fi
if "$PY" -c 'import hf_transfer' 2>/dev/null || "${PIP[@]}" hf_transfer 2>/dev/null; then
  export HF_HUB_ENABLE_HF_TRANSFER=1
fi
HF="$PYBIN/hf"
[[ -x $HF ]] || HF="$(command -v hf || true)"
[[ -n $HF && -x $HF ]] || die "the hf CLI is missing (huggingface_hub too old?)"

# ---- ComfyUI checkout (before the downloads, which write into its models/) --
latest_tag() {
  local t
  t="$(curl -fsS --max-time 15 https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest 2>/dev/null \
        | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1 || true)"
  if [[ -z $t ]]; then
    t="$(git ls-remote --tags --refs "$COMFY_REPO" 'v[0-9]*' | sed 's#.*refs/tags/##' | sort -V | tail -1)"
  fi
  echo "$t"
}

if [[ -d $COMFY_DIR/.git ]]; then
  CUR="$(git -C "$COMFY_DIR" describe --tags --always 2>/dev/null || echo unknown)"
  if { [[ -n "${COMFY_REF:-}" && $CUR != "${COMFY_REF:-}" ]]; } || ((DO_UPDATE)); then
    REF="${COMFY_REF:-$(latest_tag)}"
    [[ -n $REF ]] || die "could not work out the latest ComfyUI tag"
    log "ComfyUI $CUR -> $REF"
    git -C "$COMFY_DIR" fetch -q --depth 1 origin "refs/tags/$REF:refs/tags/$REF" 2>/dev/null \
      || git -C "$COMFY_DIR" fetch -q --depth 1 origin "$REF" || die "could not fetch $REF"
    git -C "$COMFY_DIR" checkout -q -f "$REF"
    DO_RESTART=1
  else
    log "ComfyUI present ($CUR), keeping it (use --update for the latest release)"
  fi
else
  REF="${COMFY_REF:-$(latest_tag)}"
  [[ -n $REF ]] || die "could not work out the latest ComfyUI tag"
  log "cloning ComfyUI $REF"
  rm -rf "$COMFY_DIR.partial"
  git clone -q --depth 1 --branch "$REF" "$COMFY_REPO" "$COMFY_DIR.partial" || die "git clone failed"
  if [[ -d $COMFY_DIR/models ]]; then          # models left by an interrupted earlier run
    cp -an "$COMFY_DIR/models/." "$COMFY_DIR.partial/models/" 2>/dev/null || true
  fi
  rm -rf "$COMFY_DIR"
  mv "$COMFY_DIR.partial" "$COMFY_DIR"
fi
COMFY_V="$(git -C "$COMFY_DIR" describe --tags --always 2>/dev/null || echo unknown)"
mkdir -p "$MODELS"

# ---- model downloads (background while pip installs the requirements) -------
DL_PIDS=() DL_NAMES=()
DL_TOTAL=0
download_one() { # repo path folder size
  local repo=$1 path=$2 folder=$3 size=$4 name stage dest got try
  name="$(basename "$path")"; dest="$MODELS/$folder/$name"; stage="$WORK/stage/$repo"
  mkdir -p "$MODELS/$folder" "$stage"
  for try in 1 2 3; do
    if "$HF" download "$repo" "$path" --local-dir "$stage" >>"$WORK/logs/$name.log" 2>&1; then
      got="$(file_size "$stage/$path")"
      if [[ -z $size || $got == "$size" ]]; then
        mv -f "$stage/$path" "$dest"
        echo "$got" >>"$WORK/done.txt"
        return 0
      fi
      echo "attempt $try: size mismatch, got $got, want $size" >>"$WORK/logs/$name.log"
    fi
    sleep 5
  done
  return 1
}

start_downloads() {
  local rows row _set repo path folder fallback name dest want avail need=0 plan=()
  rows="$(selected_rows)"
  if [[ -z $rows ]]; then log "no model sets requested, skipping downloads"; return 0; fi
  while IFS='|' read -r _set repo path folder fallback; do
    name="$(basename "$path")"; dest="$MODELS/$folder/$name"
    want="$(remote_size "$repo" "$path")"; want="${want:-$fallback}"
    if [[ -f $dest && $(file_size "$dest") == "$want" ]]; then
      log "have   $folder/$name ($(gb "$want") GB)"
    else
      plan+=("$repo|$path|$folder|$want")
      need=$((need + want))
      log "need   $folder/$name ($(gb "$want") GB)"
    fi
  done <<<"$rows"
  if ((${#plan[@]} == 0)); then log "all model files already present"; return 0; fi

  avail="$(df -B1 --output=avail "$BASE" | tail -1 | tr -d ' ')"
  log "downloading $(gb "$need") GB, $(gb "$avail") GB free on $BASE"
  if ((avail < need + 8 * 1073741824)); then
    die "not enough free space on $BASE: need $(gb $((need + 8 * 1073741824))) GB incl. an 8 GB margin, have $(gb "$avail") GB. Use a bigger network volume."
  fi
  DL_TOTAL=$need
  for row in "${plan[@]}"; do
    while (($(jobs -rp | wc -l) >= MAX_PARALLEL)); do sleep 1; done
    IFS='|' read -r repo path folder want <<<"$row"
    download_one "$repo" "$path" "$folder" "$want" &
    DL_PIDS+=($!); DL_NAMES+=("$folder/$(basename "$path")")
  done
}
start_downloads

# ---- ComfyUI requirements (runs while the models download) -------------------
STAMP="py=$PYV torch=$TORCH_V req=$(sha1sum "$COMFY_DIR/requirements.txt" | cut -c1-12)"
if [[ "$(cat "$WORK/stamp" 2>/dev/null)" == "$STAMP" ]]; then
  log "ComfyUI requirements already installed"
else
  log "installing ComfyUI requirements"
  "${PIP[@]}" -r "$COMFY_DIR/requirements.txt" || die "pip install -r requirements.txt failed"
  echo "$STAMP" >"$WORK/stamp"
fi
log "ComfyUI $COMFY_V installed"

# ---- wait for the downloads ---------------------------------------------------
wait_downloads() {
  local i pid running last=0 bytes failed=()
  if ((${#DL_PIDS[@]} == 0)); then return 0; fi
  while :; do
    running=0
    for pid in "${DL_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then running=$((running + 1)); fi
    done
    ((running)) || break
    if ((SECONDS - last >= 15)); then
      last=$SECONDS
      bytes=$(( $(awk '{ s += $1 } END { print s + 0 }' "$WORK/done.txt") + $(du -sb "$WORK/stage" 2>/dev/null | cut -f1) ))
      log "downloads: $running running, $(gb "$bytes") of $(gb "$DL_TOTAL") GB"
    fi
    sleep 2
  done
  for i in "${!DL_PIDS[@]}"; do
    if ! wait "${DL_PIDS[$i]}"; then failed+=("${DL_NAMES[$i]}"); fi
  done
  if ((${#failed[@]})); then
    for i in "${failed[@]}"; do
      log "FAILED $i, last log lines:"
      tail -n 5 "$WORK/logs/$(basename "$i").log" 2>/dev/null | sed 's/^/    /' || true
    done
    die "${#failed[@]} download(s) failed: ${failed[*]}. Fix the cause and run this script again, finished files are kept."
  fi
  log "downloads finished"
}
wait_downloads

if ((!DO_START)); then log "done (--no-start)"; exit 0; fi

# ---- start ComfyUI ------------------------------------------------------------
if ((DO_RESTART)); then stop_comfy; fi
if comfy_up; then
  log "ComfyUI already answering on :$PORT"
else
  log "starting ComfyUI on 127.0.0.1:$PORT (log: $LOG)"
  cd "$COMFY_DIR"
  # COMFY_ARGS is split on purpose
  # shellcheck disable=SC2086
  PYTHONUNBUFFERED=1 setsid nohup "$PY" main.py --listen 127.0.0.1 --port "$PORT" $COMFY_ARGS >"$LOG" 2>&1 </dev/null &
  COMFY_PID=$!
  echo "$COMFY_PID" >"$BASE/comfy.pid"
  waited=0
  until comfy_up; do
    if ! kill -0 "$COMFY_PID" 2>/dev/null; then
      tail -n 40 "$LOG" | sed 's/^/    /'
      die "ComfyUI exited during start, see $LOG"
    fi
    if ((waited >= COMFY_WAIT)); then
      tail -n 40 "$LOG" | sed 's/^/    /'
      die "ComfyUI did not answer within ${COMFY_WAIT}s, see $LOG"
    fi
    sleep 3; waited=$((waited + 3))
    if ((waited % 30 == 0)); then log "waiting for ComfyUI (${waited}s)"; fi
  done
fi

log "READY ComfyUI $COMFY_V on 127.0.0.1:$PORT (base $BASE)"
curl -fsS "http://127.0.0.1:$PORT/system_stats" \
  | "$PY" -c 'import json,sys; d=json.load(sys.stdin); [print("[setup] device:", x["name"], round(x["vram_total"]/2**30, 1), "GB vram") for x in d.get("devices", [])]' || true
