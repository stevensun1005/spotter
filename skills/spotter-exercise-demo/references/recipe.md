# Spotter 3D motion recipe, version 1

Use the bundled Spotter scene for each exercise. It renders a continuously skinned pale-grey athlete in dark workout clothing, realistic equipment and soft shadows against neutral light grey. Highlight the muscles that perform the movement. Choose an angle that clearly shows the apparatus and range of motion. Use a frame from the full animation for the cover.

See [the dumbbell squat sample](example-squat.json) for a complete recipe. The model is about 1.75 m tall. World coordinates are metres. +Y is up, +Z is forward, +X is the athlete's left in the neutral pose. Coordinates are world-space throughout, even when the model turns. Provide sampled frames from a specific movement, including both endpoints. The last frame should match the first for a seamless loop. Use a cycle of walking, pedalling or rowing for repeating cardio where the correct equipment is available.

| Field | Value |
| --- | --- |
| `version` | `1` |
| `durationMs` | 1200–6500. Choose a deliberate tempo for the movement. |
| `camera` | Optional `yaw` and `elevation` in degrees, `focus` as `[x,y,z]`, and `height` in metres. Frame the athlete and full equipment travel. |
| `equipment` | `none`, `mat`, `step`, `dumbbell`, `dumbbells`, `mat-dumbbells`, `cable`, `dual-cable`, `rope`, `band` or `landmine`. Additional presets include `bench`, `neutral-pull-up`, `band-ankle`, `cable-lat-bar` and `leg-curl`. `barbell` provides a plate-loaded barbell and `bench-barbell` adds the flat bench. `trap-bar` uses a hexagonal frame with handles 0.084 m above the loaded axis. `bench-dumbbell` and `bench-dumbbells` combine the flat bench with one or two dumbbells. `chest-bench-dumbbells` provides a chest support tilted 45 degrees with the two dumbbells. The flat bench surface is 0.46 m high at `x=0.10, z=0.98`. `pull-up` has a transverse overhand bar. The neutral pull-up grips face along Z at `x=±0.193, y=2.144, z=0.097`. The mat is centered near `[0,0,-0.30]` and the step top is 0.31 m at `z=0.51`. |
| `muscles` | Optional names from `lat`, `quad`, `glute`, `pec`, `core`, `shoulder`, `rearShoulder`, `forearm`, `biceps`, `triceps`, `trap`, `calf`, `hamstring`. Use `l:` or `r:` for unilateral highlights. |
| `keyframes` | 3–65 keyframes. `at` increases from 0 to 1. Supply enough samples to control the path and contact timing. |

Each keyframe must include the `[x,y,z]` position of `hips`, `chest`, `neck`, `head`, and left/right joints `ls/rs` (shoulder), `le/re` (elbow), `lw/rw` (center of grasp), `lh/rh` (hip), `lk/rk` (knee), `la/ra` (ankle), `lt/rt` (toe). Keep segment lengths coherent and ensure anatomically credible joint angles. Shoulder width is typically 0.38 m, hip width 0.20 m, upper arm length 0.25 m, and each leg segment around 0.42 m. The grasp point is about 0.37 m from the elbow when extended. The renderer uses skeletal skinning and applies foot contact and elbow corrections.

Optional per-frame fields:

- `planted: {"l": 0, "r": 0}` identifies support surfaces by height. Omit a side while its foot is moving through the air.
- `lGrip` and `rGrip` specify the direction of a handle through the grasp. For dumbbells, set `dumbbells` to an array of `{center, axis}` objects in a stable order. Match the corresponding grasp and grip direction on every frame.
- For an open planted hand, `lFingers` or `rFingers` points from wrist toward fingertips and the matching `lPalmSide` / `rPalmSide` sets the lateral direction across the palm. Use two perpendicular world directions. Omit the grip for that hand.
- `stretch-band`, `mat-stretch-band` and `high-stretch-band` use a continuous `bandPath` of 2–8 world positions. The high preset uses three knots and keeps the middle one fixed.
- `barbell` and `trap-bar` use a per-frame `barbell: {center, axis}`. Keep the athlete’s grips on the same axis.
- `cables` uses `{anchor, end, grip}` objects. Anchors remain fixed. Match the end and grip to the athlete's hand. For a rope, provide two ends and one shared anchor.
- `band` uses a fixed `anchor` and a moving `end`, each an `[x,y,z]` coordinate. Place the end between the hands when both hold the loop.
- `cable-lat-bar` uses a single `cables` entry with the bar center as its end. `leg-curl` uses a per-frame `roller` center.
- `landmine` uses `{pivot, end}` with a fixed pivot and an end that matches the athlete's grip through a consistent arc.
- Cardio presets include `rig-bike`, `rig-treadmill`, `rig-run-belt`, `rig-elliptical`, `rig-stepmill`, `rig-rower` and `rig-jump-rope`. Use `machineTravel` (0–12) to advance treadmill belts, stepmill treads and rope rotation, aligned with the actor's foot contacts.
- For carries, use `rig-single-carry`, `rig-kettles-carry`, `rig-trap-carry` or `rig-suitcase-bar`. The left hand holds the single carry variants. `rig-single-kettlebell` and `rig-goblet-plates` take a per-frame `bellCenter` and optional `bellTilt` in radians. Keep hands and bell movement in contact.
- `rig-pass-ball` and `rig-slam-ball` take a per-frame `ballCenter`. Include release and contact keyframes. `rig-contact-wall` places a wall in front of the actor.
- `followZ` moves the camera along the forward axis for continuous locomotion. The actor and camera should advance by the same amount across one loop.
- `headDrop` provides a small correction in metres, for example when lying down.
- `barbell-chest-support-row` provides a seatless incline pad for a supported barbell row. The shaft and plates should visibly clear the support throughout the pull.
- `calf-step-rail` and `calf-stair-rail` provide a support rail beside a step and a small stair station, respectively. Frame the full station and keep the forefoot on the edge and the designated hand on the rail.
- Cable attachments and bench supports have dedicated presets. For example, `cable-lat-wide`, `cable-lat-neutral` and `cable-lat-rope` add a lat-pulldown seat and thigh support with their respective grips. `cable-row-wide`, `cable-row-v` and `cable-row-rope` add a seated row station with the matching attachment. `cable-flat-bench-short` adds a flat bench and short straight bar, while `cable-mat-short` uses a floor mat and short straight bar. Keep grips on the selected attachment and the pulley fixed.
- `dumbbell` and `dumbbells` can be paired with approved supports such as `incline-bench`, `decline-bench`, `preacher-bench`, `stability-ball` or `step`. Use a matching preset such as `preacher-bench-dumbbells`. The load count and support must match the movement.
- `ez-barbell`, `barbell-rack`, and Smith presets such as `smith-standing`, `smith-flat` and `smith-incline` take `barbell: {center, axis}`. Keep the bar on the guides when using a Smith preset. Sled presets such as `sled-press`, `sled-hack` and `sled-horizontal` use `machineTravel` for the carriage.
- `kettlebells`, `kettlebell-left` and their `mat-` and `seat-` variants take a stable `kettlebells` array of `{grip, handle, down}`. The last two values are non-parallel directions for the handle axis and the bell body.
- `battle-ropes`, `climb-rope` and `stretch-rope` use `ropeTracks`, an array of equal-length paths with 2–30 world points per path. Battle ropes take two paths and other rope presets take one. For hanging ropes keep the suspension point fixed.
- `stability-ball-hug` and `stability-ball-chest-stretch` use a fixed support ball at `ballCenter` and a smaller held ball at `secondaryBallCenter`.

If the movement needs apparatus outside the preset list, author and validate the correct apparatus in the renderer before describing the animation as finished. A provisional stand-in shows different mechanics.

The generated GIF is 384 × 216, uses about 10 frames per second, and stays within the Spotter 768 KiB limit. If you shorten a longer, still-correct loop, check the pacing again.
