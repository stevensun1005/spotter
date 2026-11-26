---
name: spotter-exercise-demo
description: Render original Spotter 3D exercise demonstrations for an exact movement requested by the account owner. Use after checking the Spotter exercise library when a training plan, program, or template needs an animation for a new personal exercise.
---

# Spotter exercise demonstrations

1. Use `read_spotter_planning_context` with the active `profileRef` to check the exercise and its exact equipment, grip, and side. Call `get_spotter_exercise_demo_skill` using the verified name and, if found, catalogue ID. The same requests are documented by the connection's OpenAPI schema.
2. For `reuse_catalogue`, use the returned catalogue ID in the plan. Spotter displays the corresponding catalogue media. For a separate preview when no approved clip is registered, render an exact recipe locally without attaching it as a private replacement. For `reuse_personal`, use the returned personal name. For `render_personal`, read [the recipe reference](references/recipe.md), then author one complete repetition matching the requested movement. Use the bundled assets and the actual range of motion. The example demonstrates the format.
3. Render and examine the start, turnaround, and return. Use `node scripts/render.mjs recipe.json demo.gif` or open `renderer.html` in a WebGL2-capable desktop browser and select the recipe. Check both grip and load placement, contact surfaces, left/right, continuous movement, and framing before submitting. If you cannot verify equipment or movement, ask for the missing details and continue preparing the plan.
4. For a personal exercise, use `manage_spotter_exercise_demo` with `action: "save"`, `profileRef`, the exact exercise name, raw `gifBase64`, and `confirmed: true` when the user explicitly requested saving that demo. Use the same connection and the `exercise-demos:write` scope. Reuse the same exercise name in the plan. For catalogue exercises that have current media, keep the catalogue ID. A local render can be previewed separately.
5. Report the demos that were reused or saved and any that still need a verified recipe. The renderer uses only local JSON. Keep account credentials, private records, and personal images out of the recipe.

The CLI requires Node.js 22 or newer and Chrome or Chromium. In the unpacked archive, run `npm install --omit=dev` once for the CLI. Set `SPOTTER_DEMO_CHROME` or pass a third argument with the full path to the browser executable. The HTML is self-contained and can be opened directly without installing packages.
