# Changelog

## v0.5
- **Fixed the map-ejection bug.** Standing contact with the floor was treated as
  intersection by the collision resolver, which then "resolved" bodies out through
  the floor box's faces — the map edges. Collision now requires true penetration on
  all three axes and resolves through the nearest face. Verified by a 9-test
  headless physics suite (`tools/physcheck.js`).
- Jump velocity 8.0 → 8.6 for comfortable crate mounting.

## v0.4 — Impact Velocity
- Renamed to **Impact Velocity**.
- Replaced the ASCII pipeline with a PBR voxel-art renderer: MeshStandardMaterial,
  ACES filmic tone mapping, sRGB output, soft shadow-mapped moonlight, antialiasing.
- Cyberpunk night yard: neon-trimmed cargo pods, glowing wall signage, holo columns,
  emissive floor lanes, coloured point lights, procedural skyline and star field.
- Lighting/albedo pass verified against headless CPU raytraces (`tools/rendercheck.js`).
- AR/SMG reload flair: mag toss, one-hand fresh-mag flip, jam home.
- Music is menu-only: original dark synthwave loop (Am–F–Dm–E, filtered saws,
  gated snare). Matches are gunfire and announcer only.

## v0.3
- Full-colour rendering, skull-faced military enemies with glowing eyes,
  first-person hands with reload animations, higher ammo pools (30/250 class),
  ammo pickups from corpses (+15 enemy / +30 friendly), real Wilhelm scream with
  synth fallback, layered gunshot synthesis with convolution reverb,
  weapon redesigns: MP-X NOVA, MASADA AR, BARRETT .50, W-1887 with T2 flip-cock.

## v0.2
- Ink-on-paper ASCII renderer, 53-glyph ramp, team outline shader,
  Shipment-style map, articulated bot models, detailed viewmodels.

## v0.1
- Playable prototype: movement core (sprint/slide/dash/air-strafe/grapple/wall-run),
  four primaries + pistol + knife, killstreak ladder (Grapple, UAV, Gunslinger,
  Rain Hell, Sabre Surprise), ragdolls, gore, bots, TDM/FFA, chiptune-punk audio.
