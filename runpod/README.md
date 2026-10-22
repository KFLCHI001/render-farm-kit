# runpod

Run ComfyUI video models (MiniMax H3, Wan 2.2) on a RunPod GPU pod from a PC without a GPU. The pod is rented only while you work, and it is always terminated afterwards.

| File | Runs on | Does |
| --- | --- | --- |
| `session.sh` | PC (Git Bash) | creates a Secure Cloud pod, runs `setup-pod.sh` on it, opens the SSH tunnel to port 8188, terminates the pod on exit |
| `setup-pod.sh` | the pod | installs ComfyUI, downloads the model sets, starts ComfyUI on 127.0.0.1:8188 |
| `comfy_run.py` | PC | takes a workflow template and a job file, converts it to API format, uploads inputs, queues it, downloads the results |
| `templates/` | | official workflow templates, unmodified (see `SOURCES.md`) |
| `jobs/` | | example job files |
| `tests/` | PC | offline tests for the converter |

Needs `runpodctl` (2.x, API key configured with `runpodctl doctor`), an SSH key registered on the RunPod account, Python 3 with `requests` and `websocket-client`.

## Quick start

```bash
export RUNPOD_SSH_KEY=~/.ssh/<your runpod key>           # private key registered on the account
runpod/session.sh volume create --name comfy --size 150 --dc EU-RO-1
runpod/session.sh gpus --dc EU-RO-1                       # pick a GPU that has stock
runpod/session.sh up --gpu "NVIDIA H100 80GB HBM3" --volume <volume id> --models "h3 wan"
```

`up` prints the pod id and the hourly price, waits for SSH, runs the setup (the first run downloads about 110 GB, later runs skip every file that is already there), opens the tunnel and stays in the foreground. Leave it running, and use another shell:

```bash
python runpod/comfy_run.py runpod/jobs/example.json --dry-run     # check the conversion, queues nothing
python runpod/comfy_run.py runpod/jobs/example.json               # run it, results land in ./comfy-out/<job name>/
```

Ctrl+C in the `up` shell terminates the pod. Other ways it ends: `--max-hours` (default 4), any error, `session.sh down`, `session.sh reap`. The same limit is also set on RunPod's side with `--terminate-after`, so a killed shell cannot leave a pod running past it. `--keep` skips the termination and leaves you paying until you run `down`. `--dry-run` prints the create command and spends nothing.

Model sets (`--models`, or `setup-pod.sh` arguments): `h3` (about 56 GB), `wan` (about 55 GB), `realism` (the H3 realism LoRA, 0.13 GB), `all`. The files and folders are listed in `setup-pod.sh --print-manifest`. ComfyUI sits at `/workspace/ComfyUI`, models in `/workspace/ComfyUI/models/...`, so a network volume mounted at `/workspace` keeps all of it between pods. `setup-pod.sh` uses the image's Python when it has CUDA torch and only falls back to a venv under `/workspace/venv` when it does not. `setup-pod.sh --check h3` reports which files are present.

## Jobs

A job file names a template and lists overrides. Paths are relative to the job file.

```json
{
  "name": "h3-r2v-example",
  "template": "../templates/video_minimax_h3_r2v.json",
  "set": { "seed": 1234 },
  "nodes": [
    { "node": "Input Text (Prompt)", "values": { "value": "..." } },
    { "node": "137", "file": "refs/character.png" },
    { "node": "LoraLoaderModelOnly", "values": { "lora_name": "...", "strength_model": 1.0 } },
    { "node": "LoraLoaderModelOnly", "bypass": true }
  ]
}
```

- `set` applies a widget name to every node that has it: `seed` (also `noise_seed`), `steps`, `width`, `height`, `length`, `cfg`, any other widget name, and `prompt` or `negative_prompt` (found by node type or by "positive" or "negative" in the title). A value of `"random"` picks a random seed. An input that was linked in the template becomes a constant.
- `nodes` entries pick a node by id (`"137"`, or `"129:93"` inside a subgraph), by title, or by node type, with `"nth"` to choose among several. `values` sets widgets by name. `file` uploads a local image or audio file and sets the `image`/`audio` widget. `bypass` passes the node's input through (that is how a LoRA is switched off), `mute` removes it.
- A subgraph instance (the single box in the Wan I2V and H3 T2V templates) is addressed by its title or id, and `values` takes its promoted input names or labels, for example `prompt`, `duration`, `noise_seed`, `enable_turbo_mode`.
- Seeds stay at the template's value unless you set them, so the same job gives the same video.

`--list-nodes` prints every node id, title and widget, which is how you find what to target. `--object-info FILE` converts offline. `--save-object-info FILE` snapshots the server's node list. Before queuing, the converted workflow is checked against `/object_info` (required inputs, types, ranges, model file names), so a wrong file name fails in a second, not after the models load.

The converter handles subgraphs, bypassed and muted nodes, Reroute and PrimitiveNode. It stops with an error on anything else it cannot map, such as custom nodes the server lacks.

`jobs/smoke.json` needs no model: it uploads a small image, inverts it and downloads the result. Run it first on a fresh pod to check the tunnel, upload, queue and download in seconds.

## Tests

```bash
python -m unittest discover -s runpod/tests -v
```

The tests convert every template with a saved `/object_info` (`tests/object_info.fixture.json`, regenerate with `tests/make_fixture.py`), and check that the example jobs only use model names that `setup-pod.sh` downloads. They do not run a model. `tests/mock_server.py` is a stand-in HTTP server for trying the upload, queue and download path without ComfyUI (the websocket path needs a real server).

## Costs

- A pod costs its hourly price while it exists, from creation until termination, including the minutes spent pulling the image and downloading models. `up` prints the price. Use `session.sh gpus` for the current list.
- Terminate, do not stop. A stopped pod still bills for its disk. `session.sh` always terminates.
- A network volume costs about $0.07 per GB-month (RunPod lists it at $0.07 below 1 TB), whether or not a pod uses it: 150 GB is about $10.50 a month. It is what lets the 110 GB of models survive between pods, so the second session starts in minutes instead of a long download.
- Pods that mount a network volume run in Secure Cloud only, in the same data centre as the volume, and only on GPUs that data centre stocks. Pick the data centre for its GPU stock before creating the volume (`session.sh gpus --dc <id>`).
- Without a volume, `up --pod-volume 200` gives `/workspace` a local disk instead. It is billed with the pod and disappears with it.
- Delete a volume you no longer need: `session.sh volume delete <id> --yes`. This destroys the models on it.
