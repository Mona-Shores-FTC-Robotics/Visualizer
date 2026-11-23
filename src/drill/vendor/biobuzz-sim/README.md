# Vendored: ftc-biobuzz-sim's physics

These files are from [teddytennant/ftc-biobuzz-sim](https://github.com/teddytennant/ftc-biobuzz-sim)
(MIT, `LICENSE` and `NOTICE.md` here; live at <https://biobuzz.ncssmftc.org/sim/>), commit
`3c22f76b68fc494459ddce734fc6d3fd5dad3de1` (16 Nov 2026): `src/sim/{world,hive,config,drivetrain,rng}.ts`
and `cad/field-manifest.json`, with `public/field.glb` and `public/balls.gltf` in `public/drill/`.
Thanks to Carl Ryden and the students and mentors of NCSSM FTC teams 5064, 8569 and 22377.

The driver drill (`src/drill/`) changes them only where it says `Drill:`:

- `config.ts`: the field is 141.5 in across, our `FieldFrame.FIELD_SIZE_INCHES`.
- `hive.ts`: `held` keeps a CELL over its tipping weight on its stop through its dwell, so the TIP lag is
  the one our logs and films measured (`src/drill/presets.ts`).
- `world.ts`: `velDrive` drives a robot at a velocity the drill's TeleOp computes (our robot's measured
  speed, acceleration and turn rate) instead of the motor model; `flowerPullByPush: false` leaves FLOWER
  picks to the drill's Cross routine; the manifest import path.

Everything else (the field, the HIVE rocker and its calibration, the balls, the intake, scoring) is the
simulator's own. Update by copying the files again and re-applying the `Drill:` changes.
