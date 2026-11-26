# Spotter 3D motion recipe, version 1

See [the dumbbell squat sample](example-squat.json) for a complete recipe. The model is about 1.75 m tall. World coordinates are metres. +Y is up, +Z is forward, +X is the athlete's left in the neutral pose. Coordinates are world-space throughout, even when the model turns. Provide sampled frames from a specific movement, including both endpoints. The last frame should match the first for a seamless loop. Use a cycle of walking, pedalling or rowing for repeating cardio where the correct equipment is available.

| Field | Value |
| --- | --- |
| `version` | `1` |
| `durationMs` | 1200–6500. Choose a deliberate tempo for the movement. |
| `camera` | Optional `yaw` and `elevation` in degrees, `focus` as `[x,y,z]`, and `height` in metres. Frame the athlete and full equipment travel. |
| `equipment` | `none`, `mat`, `step`, `dumbbell`, `dumbbells`, `mat-dumbbells`, `cable`, `dual-cable`, `rope` `band` or `landmine`. The mat is centered near `[0,0,-0.30]` and the step top is 0.31 m at `z=0.51`. |
| `muscles` | Optional names from `lat`, `quad`, `glute`, `pec`, `core`, `shoulder`, `rearShoulder`, `forearm`, `triceps`. Use `l:` or `r:` for unilateral highlights. |
| `keyframes` | 3–65 keyframes. `at` increases from 0 to 1. Supply enough samples to control the path and contact timing. |

Each keyframe must include the `[x,y,z]` position of `hips`, `chest`, `neck`, `head`, and left/right joints `ls/rs` (shoulder), `le/re` (elbow), `lw/rw` (center of grasp), `lh/rh` (hip), `lk/rk` (knee), `la/ra` (ankle), `lt/rt` (toe). Keep segment lengths coherent and ensure anatomically credible joint angles. Shoulder width is typically 0.38 m, hip width 0.20 m, upper arm length 0.25 m, and each leg segment around 0.42 m. The grasp point is about 0.37 m from the elbow when extended. The renderer uses skeletal skinning and applies foot contact and elbow corrections.

Optional per-frame fields:

- `planted: {"l": 0, "r": 0}` identifies support surfaces by height. Omit a side while its foot is moving through the air.
- `lGrip` and `rGrip` specify the direction of a handle through the grasp. For dumbbells, set `dumbbells` to an array of `{center, axis}` objects in a stable order. Match the corresponding grasp and grip direction on every frame.
- `cables` uses `{anchor, end, grip}` objects. Anchors remain fixed. Match the end and grip to the athlete's hand. For a rope, provide two ends and one shared anchor.
- `band` uses a fixed `anchor` and a moving `end`, each an `[x,y,z]` coordinate. Place the end between the hands when both hold the loop.
- `landmine` uses `{pivot, end}` with a fixed pivot and an end that matches the athlete's grip through a consistent arc.
- `followZ` moves the camera along the forward axis for continuous locomotion. The actor and camera should advance by the same amount across one loop.
- `headDrop` provides a small correction in metres, for example when lying down.

If the movement needs apparatus outside the preset list, author and validate the correct apparatus in the renderer before describing the animation as finished. A provisional stand-in shows different mechanics.

The generated GIF is 384 × 216, uses about 10 frames per second, and stays within the Spotter 768 KiB limit. If you shorten a longer, still-correct loop, check the pacing again.
