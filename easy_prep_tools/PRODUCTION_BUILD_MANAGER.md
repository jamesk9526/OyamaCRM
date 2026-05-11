# OyamaCRM Production Build Manager GUI

This tool provides a professional workflow for preparing production bundles from the repository.

## Script

- `easy_prep_tools/production_build_manager_gui.py`

## What It Does

- Generates a production env file to a configurable file path.
- Supports standard env fields and custom key/value fields.
- Saves and loads reusable JSON profiles.
- Provides a guided four-step wizard (Paths -> Environment -> Bundle Content -> Run).
- Runs configurable build commands:
  - `pnpm install --frozen-lockfile` (optional)
  - `pnpm db:generate` (optional)
  - `pnpm build` (optional)
  - `pnpm build:server` (optional)
- Stages selected directories/files and creates a timestamped zip in a configurable output folder.
- Keeps env generation separate from the zip by default.

## Run

From repo root:

```bash
python easy_prep_tools/production_build_manager_gui.py
```

## Typical Workflow

1. Step 1 (Paths): Set output zip folder, env output file path, and build command toggles.
2. Step 2 (Environment): Edit standard env values and add custom env keys.
3. Step 3 (Bundle Content): Configure include directories and include files.
4. Step 4 (Run): Click **Generate Env Only** or **Run Build + Package Zip**.
5. Save profile for reuse.

## Notes

- Profile is saved to `easy_prep_tools/.production_build_profile.json` by default.
- The zip intentionally excludes `.env.production` unless **Include .env.production inside zip bundle** is checked.
- Build command failures stop the pipeline and show the error in the log tab.
