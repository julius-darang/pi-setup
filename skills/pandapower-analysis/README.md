# Pandapower Analysis

`pandapower-analysis` runs reproducible **preliminary** power-system studies from a user-provided pandapower network.

It is for screening, education, and study automation—not certified design, protection, arc-flash, PPE, equipment-rating, or energization decisions. A qualified engineer must review results used in practice.

## V1 scope

| Analysis | Method | Main results |
|---|---|---|
| `loadflow` | Balanced AC Newton–Raphson via `pandapower.runpp` | Voltages, branch loading, grid power, losses, violations |
| `load_profile` | Absolute P/Q time series with pandapower controllers | Time-step results, extrema, failures, plots |
| `short_circuit` | IEC 60909 balanced three-phase faults | Max/min bus `ikss_ka`, highest-current buses, plots |

Not implemented: arc flash, OPF, stability, contingency, unbalanced studies, protection coordination, and equipment pass/fail decisions.

## Requirements

Use a user-managed Python environment:

```bash
python3 -m pip install pandapower pandas PyYAML matplotlib
```

The runner checks imports but does not install dependencies. `numba` is optional and improves pandapower performance.

## Quick start

The network file must expose a pandapower object named `net`:

```python
# network.py
import pandapower as pp

net = pp.create_empty_network()
# Build buses, sources, branches, loads, and generators.
```

Run a study with:

```bash
python3 scripts/run_study.py \
  --network examples/simple_network.py \
  --study examples/loadflow.yaml \
  --output /tmp/pandapower-loadflow
```

The runner validates the model and manifest, works on a copy of `net`, and writes results outside the repository. Use `--overwrite` only when intentionally replacing an existing output directory.

## Study manifest

Every study selects an analysis and validation level:

```yaml
analysis: loadflow
validation: preliminary
```

V1 supports `loadflow`, `load_profile`, and `short_circuit`, with `exploratory` and `preliminary` validation levels. Future validation levels are rejected until their checks are implemented.

Paths in the manifest, including profile paths, are resolved relative to the manifest file.

## Sample scenarios

| Scenario | Manifest/input | Question answered |
|---|---|---|
| Normal operating point | `examples/loadflow.yaml` | Does the base network converge? |
| Peak-load screening | A network variant with higher `net.load.p_mw`/`q_mvar` plus `loadflow.yaml` | Do peak loads cause low voltage or overloads? |
| Daily/hourly profile | `examples/load_profile.yaml` + `examples/profile.csv` | Which time steps have the worst voltage or loading? |
| Profile envelope | Same load-profile study | What are the overall voltage/loading extrema? |
| Maximum/minimum fault study | `examples/short_circuit.yaml` | What are the IEC 60909 three-phase fault currents? |
| Maximum-case-only fault study | `short_circuit.cases: [max]` | What is the maximum fault-current envelope when minimum data is unavailable? |
| Branch short-circuit results | `short_circuit.branch_results: true` | Which branches contribute to the fault current? |
| Model diagnostics | Any supported study | Why might the model be incomplete or fail to converge? |

### Load flow

```bash
python3 scripts/run_study.py \
  --network examples/simple_network.py \
  --study examples/loadflow.yaml \
  --output /tmp/scenario-loadflow
```

Inspect `loadflow/res_bus.csv`, `loadflow/res_line.csv`, `loadflow/summary.json`, and `loadflow/plots/`.

Model-defined limits are used first. If absent, `0.95–1.05 pu` voltage and `100%` loading are reported only as preliminary screening thresholds.

### Load profile

The CSV must contain absolute P/Q values for every in-service load:

```csv
timestamp,load_0_p_mw,load_0_q_mvar
00:00,16.0,4.0
01:00,20.0,5.0
02:00,24.0,6.0
```

Run:

```bash
python3 scripts/run_study.py \
  --network examples/simple_network.py \
  --study examples/load_profile.yaml \
  --output /tmp/scenario-profile
```

Inspect `load_profile/violations.csv`, `load_profile/summary.json`, result CSVs, and plots. The runner does not infer power factor, resample, interpolate, or carry forward omitted loads.

### Short circuit

The default manifest runs both cases:

```yaml
analysis: short_circuit
validation: preliminary

short_circuit:
  fault: 3ph
  cases: [max, min]
```

Run:

```bash
python3 scripts/run_study.py \
  --network examples/simple_network.py \
  --study examples/short_circuit.yaml \
  --output /tmp/scenario-short-circuit
```

Inspect `short_circuit/max/res_bus_sc.csv`, `short_circuit/min/res_bus_sc.csv`, `short_circuit/summary.json`, and plots. Fault currents are not equipment-rating conclusions without equipment data and an approved study basis.

## Validation and outputs

Critical preflight issues stop the study. Checks include missing sources, invalid bus references, duplicate indices, non-finite values, missing short-circuit parameters, and incomplete profile matrices. Other findings are saved in `diagnostics.json`.

Each run writes:

```text
/tmp/<study>/
├── metadata.json
├── diagnostics.json
├── summary.json
├── study.yaml
└── <analysis>/
    ├── result CSV files
    ├── summary.json
    └── plots/*.png
```

Metadata records the network summary, native-unit convention, software versions, assumptions, and preliminary-study disclaimer.

## Future extensions

Future modes must add their own input schema, validation checks, result tables, plots, and safety statement:

- **Arc flash:** calculation method, working distance, clearing time, enclosure/electrode assumptions, and PPE/reporting basis.
- **OPF:** objectives, generator costs, limits, and controllability assumptions.
- **Contingency:** outage sets and ranking criteria.
- **Stability:** dynamic models, events, controls, and time-domain settings.
