#!/usr/bin/env python3
"""Run reproducible preliminary pandapower studies.

V1 supports balanced AC load flow, absolute P/Q load profiles, and IEC 60909
three-phase short circuit. Dependencies are intentionally imported at runtime
so --help remains available in environments that do not have pandapower.
"""
from __future__ import annotations

import argparse
import copy
import importlib.metadata
import importlib.util
import json
import math
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Iterable


SUPPORTED_ANALYSES = {"loadflow", "load_profile", "short_circuit"}
SUPPORTED_VALIDATION = {"exploratory", "preliminary"}
FUTURE_VALIDATION = {"engineering-review", "production"}


class StudyError(RuntimeError):
    """A user-correctable study or model error."""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a preliminary pandapower study from a Python network and YAML manifest."
    )
    parser.add_argument("--network", required=True, type=Path, help="Python file exposing net")
    parser.add_argument("--study", required=True, type=Path, help="YAML study manifest")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory; defaults to /tmp/<study-file-stem>",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Clear an existing non-empty output directory before running",
    )
    return parser.parse_args(argv)


def load_dependencies() -> SimpleNamespace:
    """Import optional runtime dependencies with one actionable error."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
        import pandas as pd
        import pandapower as pp
        import yaml
        from pandapower.auxiliary import pandapowerNet
        from pandapower.control import ConstControl
        from pandapower.diagnostic.diagnostic_helpers import diagnostic
        from pandapower.shortcircuit import calc_sc
        from pandapower.timeseries import OutputWriter, run_timeseries
        from pandapower.timeseries.data_sources.frame_data import DFData
    except ImportError as exc:
        raise StudyError(
            "Missing Python dependency. Install pandapower, pandas, PyYAML, "
            "and matplotlib in the user-managed environment."
        ) from exc

    return SimpleNamespace(
        matplotlib=matplotlib,
        plt=plt,
        np=np,
        pd=pd,
        pp=pp,
        yaml=yaml,
        pandapowerNet=pandapowerNet,
        ConstControl=ConstControl,
        diagnostic=diagnostic,
        calc_sc=calc_sc,
        OutputWriter=OutputWriter,
        run_timeseries=run_timeseries,
        DFData=DFData,
    )


def jsonable(value: Any, deps: SimpleNamespace) -> Any:
    """Convert common pandas/numpy values to JSON-safe values."""
    np = deps.np
    pd = deps.pd

    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    if isinstance(value, (np.integer, np.floating)):
        return jsonable(value.item(), deps)
    if isinstance(value, np.ndarray):
        return [jsonable(item, deps) for item in value.tolist()]
    if isinstance(value, (pd.Timestamp, pd.Timedelta)):
        return value.isoformat()
    if isinstance(value, pd.Index):
        return [jsonable(item, deps) for item in value.tolist()]
    if isinstance(value, pd.Series):
        return {str(key): jsonable(item, deps) for key, item in value.items()}
    if isinstance(value, pd.DataFrame):
        return {
            str(key): {str(index): jsonable(item, deps) for index, item in series.items()}
            for key, series in value.to_dict().items()
        }
    if isinstance(value, dict):
        return {str(key): jsonable(item, deps) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(item, deps) for item in value]
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return str(value)


def write_json(path: Path, value: Any, deps: SimpleNamespace) -> None:
    path.write_text(
        json.dumps(jsonable(value, deps), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def load_manifest(path: Path, deps: SimpleNamespace) -> dict[str, Any]:
    if not path.is_file():
        raise StudyError(f"Study manifest not found: {path}")
    try:
        with path.open("r", encoding="utf-8") as handle:
            config = deps.yaml.safe_load(handle) or {}
    except Exception as exc:
        raise StudyError(f"Could not parse YAML study manifest: {path}") from exc
    if not isinstance(config, dict):
        raise StudyError("Study manifest must contain a YAML mapping")

    analysis = config.get("analysis")
    if analysis not in SUPPORTED_ANALYSES:
        supported = ", ".join(sorted(SUPPORTED_ANALYSES))
        raise StudyError(f"Unsupported analysis {analysis!r}; v1 supports: {supported}")

    validation = config.get("validation", "preliminary")
    if validation in FUTURE_VALIDATION:
        raise StudyError(
            f"Validation level {validation!r} is a documented future level, not implemented in v1"
        )
    if validation not in SUPPORTED_VALIDATION:
        raise StudyError(f"Unsupported validation level: {validation!r}")

    return config


def prepare_output(path: Path, overwrite: bool) -> None:
    if path.exists() and not path.is_dir():
        raise StudyError(f"Output path is not a directory: {path}")
    if path.exists() and any(path.iterdir()):
        if not overwrite:
            raise StudyError(
                f"Output directory is non-empty: {path}; use --overwrite to replace it"
            )
        for child in path.iterdir():
            if child.is_dir() and not child.is_symlink():
                shutil.rmtree(child)
            else:
                child.unlink()
    path.mkdir(parents=True, exist_ok=True)


def load_network(path: Path, deps: SimpleNamespace) -> Any:
    path = path.resolve()
    if not path.is_file() or path.suffix.lower() != ".py":
        raise StudyError(f"Network input must be an existing Python file: {path}")

    module_name = f"_pandapower_study_{abs(hash(path))}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise StudyError(f"Could not load network Python file: {path}")

    sys.path.insert(0, str(path.parent))
    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as exc:
        raise StudyError(f"Network Python file failed while executing: {path}") from exc
    finally:
        try:
            sys.path.remove(str(path.parent))
        except ValueError:
            pass

    net = getattr(module, "net", None)
    if not isinstance(net, deps.pandapowerNet):
        raise StudyError(f"Network file must expose a pandapowerNet named 'net': {path}")
    return net


def dataframe_tables(net: Any, deps: SimpleNamespace) -> Iterable[tuple[str, Any]]:
    for name, value in net.items():
        if isinstance(value, deps.pd.DataFrame):
            yield name, value


def active_rows(table: Any, deps: SimpleNamespace) -> Any:
    if "in_service" not in table.columns:
        return table
    return table[table["in_service"].fillna(False).astype(bool)]


def require_columns(
    net: Any,
    table_name: str,
    columns: Iterable[str],
    errors: list[str],
) -> None:
    table = net.get(table_name)
    if table is None:
        errors.append(f"Missing pandapower table: {table_name}")
        return
    missing = [column for column in columns if column not in table.columns]
    if missing:
        errors.append(f"{table_name} is missing required columns: {', '.join(missing)}")


def check_finite_columns(
    net: Any,
    table_name: str,
    columns: Iterable[str],
    errors: list[str],
    deps: SimpleNamespace,
) -> None:
    table = net.get(table_name)
    if table is None:
        return
    for column in columns:
        if column not in table.columns:
            continue
        values = deps.pd.to_numeric(table[column], errors="coerce")
        if values.isna().any() or not deps.np.isfinite(values.to_numpy(dtype=float)).all():
            errors.append(f"{table_name}.{column} contains missing or non-finite values")


def check_bus_references(net: Any, errors: list[str], deps: SimpleNamespace) -> None:
    if "bus" not in net:
        return
    buses = set(net.bus.index.tolist())
    references = {
        "load": ["bus"],
        "sgen": ["bus"],
        "gen": ["bus"],
        "ext_grid": ["bus"],
        "line": ["from_bus", "to_bus"],
        "trafo": ["hv_bus", "lv_bus"],
        "trafo3w": ["hv_bus", "mv_bus", "lv_bus"],
        "shunt": ["bus"],
    }
    for table_name, columns in references.items():
        table = net.get(table_name)
        if table is None:
            continue
        for column in columns:
            if column not in table.columns:
                continue
            referenced = set(table[column].dropna().tolist())
            missing = sorted(referenced - buses, key=str)
            if missing:
                errors.append(f"{table_name}.{column} references unknown buses: {missing}")


def run_diagnostics(net: Any, deps: SimpleNamespace) -> tuple[Any, list[str]]:
    warnings: list[str] = []
    try:
        result = deps.diagnostic(
            copy.deepcopy(net),
            report_style=None,
            warnings_only=True,
            return_result_dict=True,
        )
    except Exception as exc:
        warnings.append(f"Pandapower diagnostics could not complete: {exc}")
        result = {}
    return result or {}, warnings


def preflight(
    net: Any,
    analysis: str,
    deps: SimpleNamespace,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if "bus" not in net or len(net.bus) == 0:
        errors.append("Network must contain at least one bus")
    else:
        require_columns(net, "bus", ["vn_kv"], errors)
        check_finite_columns(net, "bus", ["vn_kv"], errors, deps)

    for table_name, columns in {
        "load": ["bus", "p_mw", "q_mvar"],
        "sgen": ["bus", "p_mw", "q_mvar"],
        "gen": ["bus", "p_mw", "vm_pu"],
        "ext_grid": ["bus", "vm_pu"],
        "line": ["from_bus", "to_bus", "length_km"],
        "trafo": ["hv_bus", "lv_bus", "sn_mva"],
    }.items():
        if table_name in net and len(net[table_name]):
            require_columns(net, table_name, columns, errors)

    check_finite_columns(net, "load", ["p_mw", "q_mvar"], errors, deps)
    check_finite_columns(net, "ext_grid", ["vm_pu"], errors, deps)
    check_finite_columns(net, "line", ["length_km"], errors, deps)
    check_bus_references(net, errors, deps)

    ext_grid = net.get("ext_grid")
    active_ext_grid = active_rows(ext_grid, deps) if ext_grid is not None else deps.pd.DataFrame()
    gen = net.get("gen")
    active_slack_gen = deps.pd.DataFrame()
    if gen is not None and len(gen) and "slack" in gen.columns:
        active_slack_gen = active_rows(gen[gen["slack"].fillna(False).astype(bool)], deps)
    if analysis == "short_circuit":
        if len(active_ext_grid) == 0:
            errors.append("Short-circuit analysis requires at least one in-service ext_grid")
    elif len(active_ext_grid) == 0 and len(active_slack_gen) == 0:
        errors.append("Load flow requires an in-service ext_grid or slack generator")

    for table_name, table in dataframe_tables(net, deps):
        if table.index.duplicated().any():
            errors.append(f"{table_name} contains duplicate indices")

    diagnostic_results, diagnostic_warnings = run_diagnostics(net, deps)
    warnings.extend(diagnostic_warnings)
    if diagnostic_results:
        warnings.append("Pandapower diagnostics reported findings; see diagnostics.json")

    if analysis == "short_circuit":
        short_circuit = (config or {}).get("short_circuit", {}) or {}
        cases = short_circuit.get("cases", ["max", "min"])
        if isinstance(cases, str):
            cases = [cases]
        cases = cases if isinstance(cases, list) else ["max", "min"]
        required_sc: list[str] = []
        if "max" in cases:
            required_sc.extend(("s_sc_max_mva", "rx_max"))
        if "min" in cases:
            required_sc.extend(("s_sc_min_mva", "rx_min"))
        require_columns(net, "ext_grid", required_sc, errors)
        check_finite_columns(net, "ext_grid", required_sc, errors, deps)
        if "line" in net and len(net.line) and "endtemp_degree" not in net.line.columns:
            warnings.append("line.endtemp_degree is absent; verify short-circuit line-temperature assumptions")

    return {
        "errors": errors,
        "warnings": warnings,
        "pandapower": diagnostic_results,
    }


def export_result_tables(net: Any, directory: Path, deps: SimpleNamespace) -> list[str]:
    directory.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for name, table in dataframe_tables(net, deps):
        if not name.startswith("res_") or table.empty:
            continue
        path = directory / f"{name}.csv"
        table.to_csv(path, index=True)
        written.append(path.name)
    return written


def safe_name(value: Any) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", str(value)).strip("_") or "result"


def write_plot(fig: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    fig.clf()


def plot_static_results(net: Any, output_dir: Path, deps: SimpleNamespace) -> None:
    plots = output_dir / "plots"
    plots.mkdir(parents=True, exist_ok=True)

    if "res_bus" in net and len(net.res_bus) and "vm_pu" in net.res_bus:
        fig, ax = deps.plt.subplots(figsize=(10, 4))
        values = net.res_bus["vm_pu"]
        ax.plot([str(index) for index in values.index], values.to_numpy(), marker="o")
        ax.axhline(1.05, color="tab:red", linestyle="--", linewidth=0.8)
        ax.axhline(0.95, color="tab:red", linestyle="--", linewidth=0.8)
        ax.set_title("Bus voltage magnitude")
        ax.set_xlabel("Bus index")
        ax.set_ylabel("Voltage (pu)")
        ax.tick_params(axis="x", rotation=60)
        write_plot(fig, plots / "bus_voltage.png")
        deps.plt.close(fig)

    for table_name, title, filename in (
        ("res_line", "Line loading", "line_loading.png"),
        ("res_trafo", "Transformer loading", "transformer_loading.png"),
    ):
        table = net.get(table_name)
        if table is None or table.empty or "loading_percent" not in table:
            continue
        fig, ax = deps.plt.subplots(figsize=(10, 4))
        values = table["loading_percent"]
        ax.bar([str(index) for index in values.index], values.to_numpy())
        ax.axhline(100, color="tab:red", linestyle="--", linewidth=0.8)
        ax.set_title(title)
        ax.set_xlabel("Element index")
        ax.set_ylabel("Loading (%)")
        ax.tick_params(axis="x", rotation=60)
        write_plot(fig, plots / filename)
        deps.plt.close(fig)


def series_limit(table: Any, column: str, default: float, deps: SimpleNamespace) -> tuple[Any, str]:
    if column in table.columns:
        values = deps.pd.to_numeric(table[column], errors="coerce")
        if values.notna().any():
            source = "model" if values.notna().all() else "mixed"
            return values.fillna(default), source
    return deps.pd.Series(default, index=table.index, dtype=float), "screening"


def static_violations(net: Any, deps: SimpleNamespace) -> dict[str, Any]:
    violations: dict[str, Any] = {}
    bus = net.get("bus")
    res_bus = net.get("res_bus")
    if bus is not None and res_bus is not None and "vm_pu" in res_bus:
        minimum, min_source = series_limit(bus, "min_vm_pu", 0.95, deps)
        maximum, max_source = series_limit(bus, "max_vm_pu", 1.05, deps)
        vm = res_bus["vm_pu"]
        low = vm[vm < minimum.reindex(vm.index)]
        high = vm[vm > maximum.reindex(vm.index)]
        violations["bus_voltage"] = {
            "min_limit_source": min_source,
            "max_limit_source": max_source,
            "low_buses": low.index.tolist(),
            "high_buses": high.index.tolist(),
        }

    for table_name, result_name in (("line", "res_line"), ("trafo", "res_trafo")):
        table = net.get(table_name)
        result = net.get(result_name)
        if table is None or result is None or "loading_percent" not in result:
            continue
        limits, source = series_limit(table, "max_loading_percent", 100.0, deps)
        loading = result["loading_percent"]
        over = loading[loading > limits.reindex(loading.index)]
        violations[table_name + "_loading"] = {
            "limit_source": source,
            "overloaded_elements": over.index.tolist(),
        }
    return violations


def total_losses(net: Any, deps: SimpleNamespace) -> dict[str, float]:
    losses: dict[str, float] = {}
    for table_name in ("res_line", "res_trafo", "res_trafo3w", "res_impedance"):
        table = net.get(table_name)
        if table is None or table.empty:
            continue
        for column in ("pl_mw", "ql_mvar"):
            if column in table:
                value = deps.pd.to_numeric(table[column], errors="coerce").sum()
                losses[column] = losses.get(column, 0.0) + float(value)
    return losses


def run_loadflow(net: Any, options: dict[str, Any], output_dir: Path, deps: SimpleNamespace) -> dict[str, Any]:
    allowed = {
        "algorithm",
        "calculate_voltage_angles",
        "init",
        "max_iteration",
        "tolerance_mva",
        "enforce_p_lims",
        "enforce_q_lims",
        "check_connectivity",
        "voltage_depend_loads",
        "distributed_slack",
    }
    unknown = sorted(set(options) - allowed)
    if unknown:
        raise StudyError(f"Unsupported loadflow options: {', '.join(unknown)}")
    run_options = dict(options)
    run_options.setdefault("algorithm", "nr")
    try:
        deps.pp.runpp(net, **run_options)
    except Exception as exc:
        raise StudyError(f"Load flow did not converge: {exc}") from exc
    if not bool(getattr(net, "converged", True)):
        raise StudyError("Load flow returned without convergence")

    result_dir = output_dir / "loadflow"
    tables = export_result_tables(net, result_dir, deps)
    plot_static_results(net, result_dir, deps)
    summary = {
        "analysis": "loadflow",
        "converged": True,
        "options": run_options,
        "result_tables": tables,
        "losses": total_losses(net, deps),
        "violations": static_violations(net, deps),
    }
    write_json(result_dir / "summary.json", summary, deps)
    return summary


def profile_columns(net: Any, profile: Any, deps: SimpleNamespace) -> tuple[list[Any], Any, Any, Any]:
    if "load" not in net or len(active_rows(net.load, deps)) == 0:
        raise StudyError("Load profile analysis requires at least one in-service load")
    loads = active_rows(net.load, deps)
    indices = list(loads.index)
    timestamp_column = "timestamp" if "timestamp" in profile.columns else None
    if timestamp_column:
        try:
            timestamps = deps.pd.to_datetime(profile[timestamp_column], errors="raise", format="mixed")
        except (TypeError, ValueError):
            timestamps = deps.pd.to_datetime(profile[timestamp_column], errors="raise")
        if timestamps.duplicated().any():
            raise StudyError("Load profile timestamp values must be unique")
    else:
        timestamps = deps.pd.Series(range(len(profile)), name="time_step")

    expected: list[str] = []
    p_data: dict[Any, Any] = {}
    q_data: dict[Any, Any] = {}
    for index in indices:
        p_column = f"load_{index}_p_mw"
        q_column = f"load_{index}_q_mvar"
        expected.extend((p_column, q_column))
        if p_column not in profile.columns or q_column not in profile.columns:
            raise StudyError(f"Profile must contain {p_column!r} and {q_column!r}")
        p_data[index] = deps.pd.to_numeric(profile[p_column], errors="coerce")
        q_data[index] = deps.pd.to_numeric(profile[q_column], errors="coerce")

    extras = set(profile.columns) - set(expected) - ({timestamp_column} if timestamp_column else set())
    if extras:
        raise StudyError(f"Profile contains unsupported columns: {sorted(extras)}")
    if not expected or len(profile) == 0:
        raise StudyError("Load profile must contain at least one complete time step")
    for kind, data in (("p_mw", p_data), ("q_mvar", q_data)):
        for index, values in data.items():
            if values.isna().any() or not deps.np.isfinite(values.to_numpy(dtype=float)).all():
                raise StudyError(f"Profile contains missing or non-finite values for load {index} {kind}")

    p_df = deps.pd.DataFrame(p_data)
    q_df = deps.pd.DataFrame(q_data)
    return indices, p_df, q_df, timestamps


def find_output_frame(output: dict[str, Any], name: str, deps: SimpleNamespace) -> Any | None:
    expected = name.lower()
    for key, value in output.items():
        if isinstance(key, tuple):
            normalized = ".".join(str(part) for part in key).lower()
        else:
            normalized = str(key).lower()
        if normalized == expected and isinstance(value, deps.pd.DataFrame):
            return value
    return None


def profile_metrics(net: Any, output: dict[str, Any], deps: SimpleNamespace) -> Any:
    frames = [value for value in output.values() if isinstance(value, deps.pd.DataFrame)]
    if not frames:
        return deps.pd.DataFrame()
    index = frames[0].index
    metrics = deps.pd.DataFrame(index=index)

    vm = find_output_frame(output, "res_bus.vm_pu", deps)
    if vm is not None and not vm.empty:
        metrics["min_vm_pu"] = vm.min(axis=1)
        metrics["max_vm_pu"] = vm.max(axis=1)
        bus_limits = net.get("bus")
        if bus_limits is not None:
            minimum, _ = series_limit(bus_limits, "min_vm_pu", 0.95, deps)
            maximum, _ = series_limit(bus_limits, "max_vm_pu", 1.05, deps)
            minimum = minimum.reindex(vm.columns)
            maximum = maximum.reindex(vm.columns)
            metrics["voltage_violation"] = vm.lt(minimum, axis="columns").any(axis=1) | vm.gt(maximum, axis="columns").any(axis=1)

    line = find_output_frame(output, "res_line.loading_percent", deps)
    if line is not None and not line.empty:
        metrics["max_line_loading_percent"] = line.max(axis=1)
        limits, _ = series_limit(net.get("line", deps.pd.DataFrame()), "max_loading_percent", 100.0, deps)
        metrics["line_loading_violation"] = line.gt(limits.reindex(line.columns), axis="columns").any(axis=1)

    trafo = find_output_frame(output, "res_trafo.loading_percent", deps)
    if trafo is not None and not trafo.empty:
        metrics["max_trafo_loading_percent"] = trafo.max(axis=1)
        limits, _ = series_limit(net.get("trafo", deps.pd.DataFrame()), "max_loading_percent", 100.0, deps)
        metrics["trafo_loading_violation"] = trafo.gt(limits.reindex(trafo.columns), axis="columns").any(axis=1)

    parameters = find_output_frame(output, "Parameters", deps)
    if parameters is not None:
        for column in ("powerflow_failed", "controller_unstable"):
            if column in parameters:
                metrics[column] = parameters[column].fillna(False).astype(bool)
    return metrics


def plot_profile(output: dict[str, Any], output_dir: Path, deps: SimpleNamespace) -> None:
    plots = output_dir / "plots"
    plots.mkdir(parents=True, exist_ok=True)
    vm = find_output_frame(output, "res_bus.vm_pu", deps)
    if vm is not None and not vm.empty:
        fig, ax = deps.plt.subplots(figsize=(10, 4))
        ax.plot(vm.index, vm.min(axis=1), label="minimum")
        ax.plot(vm.index, vm.max(axis=1), label="maximum")
        ax.axhline(1.05, color="tab:red", linestyle="--", linewidth=0.8)
        ax.axhline(0.95, color="tab:red", linestyle="--", linewidth=0.8)
        ax.set_title("Load-profile bus voltage envelope")
        ax.set_xlabel("Time step")
        ax.set_ylabel("Voltage (pu)")
        ax.legend()
        write_plot(fig, plots / "bus_voltage_envelope.png")
        deps.plt.close(fig)

    loading = find_output_frame(output, "res_line.loading_percent", deps)
    if loading is not None and not loading.empty:
        fig, ax = deps.plt.subplots(figsize=(10, 4))
        ax.plot(loading.index, loading.max(axis=1), label="maximum line loading")
        ax.axhline(100, color="tab:red", linestyle="--", linewidth=0.8)
        ax.set_title("Load-profile line loading")
        ax.set_xlabel("Time step")
        ax.set_ylabel("Loading (%)")
        ax.legend()
        write_plot(fig, plots / "line_loading.png")
        deps.plt.close(fig)


def run_load_profile(net: Any, options: dict[str, Any], study_path: Path, output_dir: Path, deps: SimpleNamespace) -> dict[str, Any]:
    if set(options) - {"path", "timestamp_column"}:
        unknown = sorted(set(options) - {"path", "timestamp_column"})
        raise StudyError(f"Unsupported load-profile options: {', '.join(unknown)}")
    profile_path = Path(options.get("path", ""))
    if not profile_path.is_absolute():
        profile_path = (study_path.parent / profile_path).resolve()
    if not profile_path.is_file():
        raise StudyError(f"Load profile CSV not found: {profile_path}")
    try:
        profile = deps.pd.read_csv(profile_path)
    except Exception as exc:
        raise StudyError(f"Could not read load profile CSV: {profile_path}") from exc

    timestamp_name = options.get("timestamp_column", "timestamp")
    if timestamp_name and timestamp_name != "timestamp":
        if timestamp_name not in profile.columns:
            raise StudyError(f"Configured timestamp column is missing: {timestamp_name}")
        profile = profile.rename(columns={timestamp_name: "timestamp"})
    indices, p_df, q_df, timestamps = profile_columns(net, profile, deps)

    result_dir = output_dir / "load_profile"
    raw_dir = result_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    p_source = deps.DFData(p_df)
    q_source = deps.DFData(q_df)
    deps.ConstControl(
        net,
        element="load",
        variable="p_mw",
        element_index=indices,
        data_source=p_source,
        profile_name=indices,
    )
    deps.ConstControl(
        net,
        element="load",
        variable="q_mvar",
        element_index=indices,
        data_source=q_source,
        profile_name=indices,
    )

    time_steps = list(range(len(profile)))
    writer = deps.OutputWriter(
        net,
        time_steps=time_steps,
        output_path=str(raw_dir),
        output_file_type=".csv",
    )
    writer.log_variable("res_bus", "vm_pu")
    writer.log_variable("res_bus", "va_degree")
    if "line" in net and len(net.line):
        writer.log_variable("res_line", "loading_percent")
    if "trafo" in net and len(net.trafo):
        writer.log_variable("res_trafo", "loading_percent")

    try:
        deps.run_timeseries(
            net,
            time_steps=time_steps,
            continue_on_divergence=True,
            verbose=False,
        )
    except Exception as exc:
        raise StudyError(f"Load-profile simulation failed: {exc}") from exc

    output = getattr(writer, "output", {}) or {}
    for name, frame in output.items():
        if isinstance(frame, deps.pd.DataFrame):
            frame.to_csv(result_dir / f"{safe_name(name)}.csv", index=True)
    if output and raw_dir.exists():
        shutil.rmtree(raw_dir)
    timestamps.to_csv(result_dir / "time_axis.csv", index=False, header=True)

    parameters = find_output_frame(output, "Parameters", deps)
    failed_steps: list[Any] = []
    if parameters is not None:
        for column in ("powerflow_failed", "controller_unstable"):
            if column in parameters:
                failed_steps.extend(parameters.index[parameters[column].fillna(False).astype(bool)].tolist())
    failed_steps = sorted(set(failed_steps), key=str)
    metrics = profile_metrics(net, output, deps)
    if not metrics.empty:
        metrics.to_csv(result_dir / "violations.csv", index=True)
    plot_profile(output, result_dir, deps)

    violation_columns = [column for column in metrics.columns if column.endswith("violation")]
    violation_steps = metrics.index[metrics[violation_columns].any(axis=1)].tolist() if violation_columns else []
    extrema = {}
    for column in ("min_vm_pu", "max_vm_pu", "max_line_loading_percent", "max_trafo_loading_percent"):
        if column in metrics:
            extrema[column] = {
                "minimum": float(metrics[column].min()),
                "maximum": float(metrics[column].max()),
            }
    summary = {
        "analysis": "load_profile",
        "time_steps": len(profile),
        "load_indices": indices,
        "profile_path": str(profile_path),
        "failed_time_steps": failed_steps,
        "violation_time_steps": violation_steps,
        "extrema": extrema,
        "result_keys": [str(key) for key in output],
    }
    if failed_steps:
        summary["warning"] = "One or more time steps did not converge or became unstable"
    write_json(result_dir / "summary.json", summary, deps)
    return summary


def short_circuit_summary(net: Any, case: str, deps: SimpleNamespace) -> dict[str, Any]:
    result = net.get("res_bus_sc")
    if result is None or result.empty or "ikss_ka" not in result:
        return {"case": case, "warning": "No res_bus_sc.ikss_ka results were produced"}
    currents = deps.pd.to_numeric(result["ikss_ka"], errors="coerce").dropna()
    if currents.empty:
        return {"case": case, "warning": "res_bus_sc.ikss_ka contains no finite values"}
    highest = currents.sort_values(ascending=False).head(10)
    return {
        "case": case,
        "max_ikss_ka": float(currents.max()),
        "max_ikss_bus": highest.index[0],
        "top_buses": [
            {"bus": index, "ikss_ka": float(value)} for index, value in highest.items()
        ],
    }


def plot_short_circuit(net: Any, case: str, output_dir: Path, deps: SimpleNamespace) -> None:
    result = net.get("res_bus_sc")
    if result is None or result.empty or "ikss_ka" not in result:
        return
    values = deps.pd.to_numeric(result["ikss_ka"], errors="coerce").dropna().sort_values(ascending=False).head(10)
    if values.empty:
        return
    fig, ax = deps.plt.subplots(figsize=(10, 4))
    ax.bar([str(index) for index in values.index], values.to_numpy())
    ax.set_title(f"Highest three-phase short-circuit currents ({case})")
    ax.set_xlabel("Bus index")
    ax.set_ylabel("Initial short-circuit current (kA)")
    ax.tick_params(axis="x", rotation=60)
    write_plot(fig, output_dir / "plots" / f"{case}_ikss.png")
    deps.plt.close(fig)


def run_short_circuit(net: Any, options: dict[str, Any], output_dir: Path, deps: SimpleNamespace) -> dict[str, Any]:
    allowed = {"fault", "cases", "lv_tol_percent", "r_fault_ohm", "x_fault_ohm", "branch_results"}
    unknown = sorted(set(options) - allowed)
    if unknown:
        raise StudyError(f"Unsupported short-circuit options: {', '.join(unknown)}")
    fault = options.get("fault", "3ph")
    if fault != "3ph":
        raise StudyError("V1 short-circuit analysis supports only fault: 3ph")
    cases = options.get("cases", ["max", "min"])
    if isinstance(cases, str):
        cases = [cases]
    if not isinstance(cases, list) or not cases or any(case not in {"max", "min"} for case in cases):
        raise StudyError("short_circuit.cases must be a non-empty list containing max and/or min")
    if len(set(cases)) != len(cases):
        raise StudyError("short_circuit.cases must not contain duplicates")

    result_root = output_dir / "short_circuit"
    summaries: list[dict[str, Any]] = []
    for case in cases:
        work = copy.deepcopy(net)
        kwargs: dict[str, Any] = {
            "fault": "3ph",
            "case": case,
            "branch_results": bool(options.get("branch_results", False)),
        }
        for key in ("lv_tol_percent", "r_fault_ohm", "x_fault_ohm"):
            if key in options:
                kwargs[key] = options[key]
        try:
            deps.calc_sc(work, **kwargs)
        except Exception as exc:
            raise StudyError(f"IEC 60909 short-circuit case {case!r} failed: {exc}") from exc
        case_dir = result_root / case
        export_result_tables(work, case_dir, deps)
        plot_short_circuit(work, case, result_root, deps)
        summaries.append(short_circuit_summary(work, case, deps))

    summary = {
        "analysis": "short_circuit",
        "fault": "3ph",
        "cases": summaries,
        "options": options,
    }
    write_json(result_root / "summary.json", summary, deps)
    return summary


def package_versions(deps: SimpleNamespace) -> dict[str, str]:
    versions: dict[str, str] = {}
    for package in ("pandapower", "pandas", "numpy", "PyYAML", "matplotlib"):
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            versions[package] = "unknown"
    versions["python"] = sys.version.split()[0]
    return versions


def network_summary(net: Any, deps: SimpleNamespace) -> dict[str, Any]:
    counts: dict[str, int] = {}
    in_service: dict[str, int] = {}
    for name, table in dataframe_tables(net, deps):
        counts[name] = len(table)
        if "in_service" in table.columns:
            in_service[name] = int(table["in_service"].fillna(False).astype(bool).sum())
    return {"element_counts": counts, "in_service_counts": in_service}


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    deps = load_dependencies()
    study_path = args.study.resolve()
    network_path = args.network.resolve()
    config = load_manifest(study_path, deps)
    output_dir = (args.output or Path("/tmp") / study_path.stem).resolve()
    prepare_output(output_dir, args.overwrite)

    shutil.copy2(study_path, output_dir / "study.yaml")
    net = load_network(network_path, deps)
    analysis = config["analysis"]
    diagnostics = preflight(net, analysis, deps, config)
    write_json(output_dir / "diagnostics.json", diagnostics, deps)
    if diagnostics["errors"]:
        raise StudyError(
            "Critical preflight checks failed:\n- " + "\n- ".join(diagnostics["errors"])
        )

    metadata = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "analysis": analysis,
        "validation": config.get("validation", "preliminary"),
        "network_path": str(network_path),
        "study_path": str(study_path),
        "versions": package_versions(deps),
        "network": network_summary(net, deps),
        "units": "pandapower native units",
        "safety": "Preliminary screening output; qualified engineering review required.",
    }
    write_json(output_dir / "metadata.json", metadata, deps)

    work = copy.deepcopy(net)
    if analysis == "loadflow":
        summary = run_loadflow(work, config.get("loadflow", {}) or {}, output_dir, deps)
    elif analysis == "load_profile":
        summary = run_load_profile(work, config.get("profile", {}) or {}, study_path, output_dir, deps)
    elif analysis == "short_circuit":
        summary = run_short_circuit(work, config.get("short_circuit", {}) or {}, output_dir, deps)
    else:  # guarded by load_manifest; retained as a defensive check
        raise StudyError(f"Unsupported analysis: {analysis}")

    summary["diagnostic_warnings"] = diagnostics["warnings"]
    write_json(output_dir / "summary.json", summary, deps)
    print(f"Study complete: {output_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except StudyError as exc:
        print(f"study error: {exc}", file=sys.stderr)
        raise SystemExit(2)
