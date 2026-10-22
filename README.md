# render-farm-kit

Render long Remotion videos without a render machine. The `render` workflow splits a composition into frame chunks, renders them in parallel on standard GitHub-hosted runners, and joins the result. On a public repository those runners cost nothing.

Work in progress. Planned next: a one-command RunPod runner for GPU renders and ComfyUI video generation (MiniMax H3, Wan 2.2), with the same chunk-and-join flow.

## Use

1. Fork or copy this repo and put your Remotion project in a folder (see `examples/bible-stories`).
2. Optional: add a repository secret `RENDER_KEY`. Every video is then encrypted with it before upload, so artifacts on a public repo stay private. Decrypt with:

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in joined.mp4.enc -out joined.mp4 -pass env:RENDER_KEY
   ```

3. Run it:

   ```bash
   gh workflow run render -f composition=WhoStoppedShorts -f frames=0-5039 -f chunks=20
   ```

Each job writes a `timing-NN.txt` with seconds and frames per second, so you can size the chunk count before a full render.

## Limits worth knowing

- Standard runners have 4 CPUs and no GPU, so Chrome draws with software GL (`--gl=swangle`). Heavy SVG filters are slow there, so split into more chunks.
- A job stops after 6 hours, and at most 20 jobs run at once on the free plan.
- Artifacts here are kept for 3 days.

## Example

`examples/bible-stories` holds three 1080x1920 compositions: a cut-paper parable (`WhoStoppedShorts`, `WhoStopped`) and an ink-on-parchment story (`AsHeDidBefore`). Fixed-seed SVG noise is baked to PNG in `public/noise` by `scripts/bake-noise.mjs`. Scripture text is from the World English Bible, Catholic Edition (public domain). Audio is not included.

## Licence

MIT. Remotion has its own licence, free for individuals and small teams: see remotion.dev/license.
