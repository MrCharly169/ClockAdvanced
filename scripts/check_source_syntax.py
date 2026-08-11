#!/usr/bin/env python3
"""Validate shipped Python, JavaScript, JSON, and TOML syntax."""

from __future__ import annotations

import json
import os
from pathlib import Path
import py_compile
import subprocess
import sys
import tempfile
import tomllib

ROOT = Path(__file__).parents[1]
SOURCE_ROOTS = {".github", "custom_components", "scripts", "tests"}
NODE_EXECUTABLE = os.environ.get("CLOCK_ADVANCED_NODE", "node")


def repository_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(
        ROOT / relative
        for relative in result.stdout.splitlines()
        if relative and relative.replace("\\", "/").split("/", 1)[0] in SOURCE_ROOTS
    )


def main() -> int:
    files = repository_files()
    with tempfile.TemporaryDirectory(prefix="clock-advanced-syntax-") as temp:
        target_root = Path(temp)
        for path in (item for item in files if item.suffix == ".py"):
            target = target_root / path.relative_to(ROOT).with_suffix(".pyc")
            target.parent.mkdir(parents=True, exist_ok=True)
            py_compile.compile(str(path), cfile=str(target), doraise=True)
    for path in (item for item in files if item.suffix == ".json"):
        json.loads(path.read_text(encoding="utf-8"))
    for path in (item for item in files if item.suffix == ".toml"):
        tomllib.loads(path.read_text(encoding="utf-8"))
    for path in (item for item in files if item.suffix in {".js", ".mjs", ".cjs"}):
        subprocess.run(
            [NODE_EXECUTABLE, "--check", str(path.relative_to(ROOT))],
            cwd=ROOT,
            check=True,
        )
    print(f"Source syntax valid: {len(files)} repository files inspected")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Source syntax validation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
