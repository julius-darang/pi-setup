---
name: pandapower-analysis
description: Run preliminary balanced power-system studies with pandapower, including load flow, load profiles, and IEC 60909 three-phase short circuit.
---

# Pandapower Analysis

Run reproducible, preliminary power-system studies from a user-supplied pandapower network. V1 covers balanced AC load flow, load-profile time series, and IEC 60909 three-phase short circuit.

These are screening results, not certified design, protection, arc-flash, or safety studies. Never use them alone for energization, PPE, equipment ratings, protection settings, or other safety decisions. State assumptions, missing data, warnings, and the required qualified-engineer review.

## V1 boundary

Supported analyses:

- `loadflow` — balanced AC Newton–Raphson power flow through `pandapower.runpp`.
- `load_profile` — absolute P/Q load profiles applied through pandapower time-series controllers.
- `short_circuit` — balanced three-phase IEC 60909 calculation for both `max` and `min` cases.

V1 does not calculate arc flash, OPF, stability, contingencies, unbalanced power flow, phase-specific faults, protection coordination, or equipment pass/fail ratings. Reject unsupported analysis types instead of silently substituting another study.

## Prerequisites

Use a user-managed Python environment. Check imports before running:

```bash
python3 -c "import pandapower, pandas, yaml, matplotlib; print(pandapower.__version__)"
```

The runner requires Python 3, `pandapower`, `pandas`, `PyYAML`, and `matplotlib`. `numba` is optional but improves pandapower performance. Capture versions in the output metadata; do not install dependencies automatically.

## Runner

Use the focused runner for repeatable execution:

```bash
python3 scripts/run_study.py \
  --network /path/to/network.py \
  --study /path/to/study.yaml \
  --output /tmp/study-name
```

If `--output` is omitted, use `/tmp/<study-file-stem>`. Refuse to overwrite a non-empty output directory unless `--overwrite` is supplied. Keep generated artifacts outside the repository.

## Network input

The network file is user-supplied Python and is executed in the current environment. It must expose a pandapower network named `net`:

```python
import pandapower as pp

net = pp.create_empty_network()
# Build buses, sources, branches, loads, and generators.
```

Before a study:

- Verify that `net` is a `pandapowerNet`.
- Work on a deep copy; never mutate the source model.
- Use pandapower-native units and label them: MW, MVAr, kV, kA, ohms, seconds, and per unit.
- Restrict v1 to balanced networks and the element types supported by the selected pandapower calculation.
- Run preflight checks and fail on critical errors; report non-critical issues as warnings.

## Study manifest

Use one YAML manifest so future analyses can add new `analysis` values without changing the runner interface.

Minimum:

```yaml
analysis: loadflow
validation: preliminary
```

Load flow:

```yaml
analysis: loadflow
validation: preliminary

loadflow:
  algorithm: nr
  calculate_voltage_angles: auto
```

Load profile:

```yaml
analysis: load_profile
validation: preliminary

profile:
  path: profiles.csv
  timestamp_column: timestamp
```

Short circuit:

```yaml
analysis: short_circuit
validation: preliminary

short_circuit:
  fault: 3ph
  cases: [max, min]
```

Resolve relative paths relative to the study manifest. Reject unknown analysis types, malformed YAML, invalid options, and unsupported validation levels.

## Load flow

Use `pandapower.runpp` with `algorithm: nr` unless the manifest explicitly selects another supported option. Record the effective solver options and convergence status.

Export and summarize, when present:

- Bus voltage magnitude and angle.
- Line and transformer loading.
- External-grid power.
- Active and reactive losses.
- Convergence and diagnostics.
- Limit violations.

Use model-defined `min_vm_pu`, `max_vm_pu`, and loading limits first. If limits are absent, use only clearly labeled preliminary screening thresholds: 0.95–1.05 pu voltage and 100% loading. Do not describe these defaults as standards or design requirements.

## Load profile

The profile is a complete wide CSV of absolute values. Every in-service `net.load` index must have both columns for every row:

```csv
timestamp,load_0_p_mw,load_0_q_mvar,load_1_p_mw,load_1_q_mvar
00:00,1.2,0.4,0.8,0.2
01:00,1.0,0.3,0.7,0.2
```

Rules:

- `timestamp` is optional; without it, use row order as the time axis.
- Require both `p_mw` and `q_mvar`; do not infer power factor or carry forward omitted loads.
- Reject missing, duplicate, extra, non-numeric, or non-finite profile columns.
- Do not resample, interpolate, scale, or modify the source network.
- Use `DFData`, `ConstControl`, and `run_timeseries`; log voltage and branch-loading results with `OutputWriter`.
- Report failed time steps, extrema, and violations rather than hiding non-convergence.

## Short circuit

Use `pandapower.shortcircuit.calc_sc` according to IEC 60909:

- `fault: 3ph` only in v1.
- Run both `case: max` and `case: min` by default.
- Use a fresh network copy for each case.
- Validate the external-grid short-circuit parameters required by pandapower before running.
- Export bus short-circuit results, especially `ikss_ka`, and identify the highest-current buses. Set `branch_results: true` only when branch short-circuit tables are required.
- Treat fault currents as analysis results only; do not compare them to equipment ratings unless ratings and an approved study basis are explicitly provided.

## Validation levels

The manifest may name one of these levels:

- **`exploratory`** — load and shape checks; intended for debugging only.
- **`preliminary`** — v1 default: critical failures, diagnostics, assumptions, version capture, result artifacts, and labeled screening checks.
- **`engineering-review`** — future: traceable source data, complete equipment/operating cases, standards basis, independent checks, and qualified review.
- **`production`** — future: pinned environment, regression tests, controlled changes, independent validation, approved methods, and formal sign-off.

Do not claim a future level has been met until its checks are implemented and completed. Arc-flash work must later define a named calculation method, edition, working distance, clearing time, enclosure/electrode assumptions, and reporting/PPE basis; short-circuit output alone is not an arc-flash result.

Critical preflight failures include:

- Missing/invalid `net`, buses, or required source/slack.
- Duplicate indices, non-finite required values, or invalid references.
- Disconnected/unsupported model conditions that invalidate the selected study.
- Missing short-circuit source parameters.
- Incomplete or inconsistent load-profile matrices.
- Invalid durations, cases, fault types, or manifest paths.

Use pandapower diagnostics where available and preserve their findings in `diagnostics.json`.

## Outputs

Write one directory per study:

```text
/tmp/study-name/
├── metadata.json
├── diagnostics.json
├── summary.json
├── study.yaml
├── loadflow/                 # selected analysis only
│   ├── res_*.csv
│   ├── summary.json
│   └── plots/*.png
├── load_profile/
│   ├── *.csv
│   ├── summary.json
│   └── plots/*.png
└── short_circuit/
    ├── max/res_*.csv
    ├── min/res_*.csv
    ├── summary.json
    └── plots/*.png
```

Export relevant `res_*` tables as CSV, a concise JSON summary, diagnostics, effective configuration, assumptions, software versions, and static PNG plots. Use native units in column names or metadata.

At minimum, inspect representative results and plots for voltage, loading, time-series extrema, and short-circuit current. A successful solver call is not sufficient validation.

## Completion contract

A study is complete only when the source model is preserved, the selected analysis and assumptions are explicit, critical checks pass, results and warnings are exported, representative visual checks are performed, and no generated artifacts remain in the repository. State any missing data, skipped validation, and required engineering review.

## Future extensions

Add each future study as an explicit runner mode with its own input schema, validation requirements, result tables, plots, and safety statement. Do not broaden v1 defaults silently.
