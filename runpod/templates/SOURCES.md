# Template sources

Unmodified UI-format workflows from [Comfy-Org/workflow_templates](https://github.com/Comfy-Org/workflow_templates), commit `447747bf37b7e2f6d5fab3f15288e03bf889b82f` (2026-10-21). Downloaded from `raw.githubusercontent.com/Comfy-Org/workflow_templates/<commit>/templates/<file>`.

| File | Source | Use |
| --- | --- | --- |
| `video_minimax_h3_r2v.json` | https://github.com/Comfy-Org/workflow_templates/blob/447747bf37b7e2f6d5fab3f15288e03bf889b82f/templates/video_minimax_h3_r2v.json | MiniMax H3 reference to video, with audio (needs `h3` models) |
| `video_minimax_h3_t2v.json` | https://github.com/Comfy-Org/workflow_templates/blob/447747bf37b7e2f6d5fab3f15288e03bf889b82f/templates/video_minimax_h3_t2v.json | MiniMax H3 text to video. Its default diffusion model is `minimax_h3_fl2va_*`, which `setup-pod.sh` does not download. Point it at the `ref2va` model in the job, or fetch the `fl2va` file yourself |
| `video_wan2_2_14B_s2v.json` | https://github.com/Comfy-Org/workflow_templates/blob/447747bf37b7e2f6d5fab3f15288e03bf889b82f/templates/video_wan2_2_14B_s2v.json | Wan 2.2 sound to video (needs `wan` models). Its 4-step LoRA is the T2V `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise`, which is not in the `wan` set. `jobs/wan-s2v.example.json` bypasses it and runs 20 steps |
| `video_wan2_2_14B_i2v.json` | https://github.com/Comfy-Org/workflow_templates/blob/447747bf37b7e2f6d5fab3f15288e03bf889b82f/templates/video_wan2_2_14B_i2v.json | Wan 2.2 14B image to video. The 4-step LightX2V LoRA variant is a switch inside the same template (`enable_turbo_mode`) |

The models these templates name by default are not always the ones `setup-pod.sh` downloads (for example int8 or nvfp4 variants in the H3 templates). Jobs override the file names, see `jobs/`.

To update: download the same paths from a newer commit, replace the files, change the commit above, and run the converter tests (`python -m unittest discover -s runpod/tests`).
