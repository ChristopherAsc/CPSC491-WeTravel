#!/usr/bin/env python3
"""Verify the Requirements Traceability Matrix in 'QA standard.md'.

Runs in CI (see the `qa-check` job in .github/workflows/ci.yml) to make
sure the matrix can't silently drift out of sync with reality. For every
requirement row it checks that:

  - the Requirement ID, Test Type, Test ID, Test Location, and Status
    columns are all filled in (no leftover "TBD" placeholders)
  - the Test Type identifies the row as Automated and/or Manual
  - a Manual row's Test ID is a real case ID (MANUAL-<REQUIREMENT-ID>),
    not a placeholder
  - an Automated row's referenced test file(s) exist, and each named
    test function actually exists in one of those files - so a renamed
    or deleted test is caught immediately, instead of the matrix quietly
    pointing at a test that no longer exists

This is what lets a failed automated test be traced back to the
requirement/acceptance criterion it verifies: the matrix is guaranteed
to accurately list which test covers which requirement, and pytest
prints the matching Requirement ID when that test fails (see
backend/tests/conftest.py's pytest_runtest_makereport hook).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QA_STANDARD_PATH = REPO_ROOT / "QA standard.md"
MATRIX_HEADING = "## Requirements Traceability Matrix"

REQUIREMENT_ID_RE = re.compile(r"^[A-Z]+-\d+$")
TEST_FUNCTION_RE = re.compile(r"\btest_[A-Za-z0-9_]+\b")
FILE_PATH_RE = re.compile(r"\b[\w./-]+\.(?:py|tsx?|jsx?)\b")


class TraceabilityError(Exception):
    pass


def split_row(line: str) -> list[str]:
    cells = line.strip().strip("|").split("|")
    return [cell.strip() for cell in cells]


def is_separator_row(line: str) -> bool:
    stripped = line.strip()
    return bool(stripped) and set(stripped) <= set("|-: ")


def find_tables(markdown: str) -> list[list[dict[str, str]]]:
    """Return every markdown table found after MATRIX_HEADING, as rows of {header: cell}."""
    lines = markdown.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip() == MATRIX_HEADING)
    except StopIteration:
        raise TraceabilityError(f"Could not find '{MATRIX_HEADING}' in {QA_STANDARD_PATH.name}")

    tables: list[list[dict[str, str]]] = []
    i = start + 1
    while i < len(lines):
        line = lines[i]
        if (
            line.strip().startswith("|")
            and i + 1 < len(lines)
            and is_separator_row(lines[i + 1])
        ):
            headers = split_row(line)
            i += 2
            rows: list[dict[str, str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = split_row(lines[i])
                if len(cells) == len(headers):
                    rows.append(dict(zip(headers, cells)))
                i += 1
            tables.append(rows)
        else:
            i += 1
    return tables


def check_row(row: dict[str, str], errors: list[str]) -> None:
    req_id = row.get("Requirement ID", "")
    test_type = row.get("Test Type", "")
    test_id = row.get("Test ID", "")
    test_location = row.get("Test Location", "")
    status = row.get("Status", "")

    label = req_id or "<missing Requirement ID>"

    if not REQUIREMENT_ID_RE.match(req_id):
        errors.append(f"{label}: Requirement ID '{req_id}' doesn't match the <PREFIX>-<NUMBER> format")

    for column_name, value in (
        ("Test Type", test_type),
        ("Test ID", test_id),
        ("Test Location", test_location),
        ("Status", status),
    ):
        if not value or value.upper() == "TBD":
            errors.append(f"{label}: '{column_name}' is missing or still says TBD")

    if not test_type:
        return

    is_automated = "automated" in test_type.lower()
    is_manual = "manual" in test_type.lower()

    if not is_automated and not is_manual:
        errors.append(f"{label}: Test Type '{test_type}' must identify Automated and/or Manual validation")

    if is_manual and not re.search(r"\bMANUAL-[A-Z0-9-]+\b", test_id, re.IGNORECASE):
        errors.append(f"{label}: Manual row's Test ID must reference a MANUAL-<REQUIREMENT-ID> case, got '{test_id}'")

    if is_automated:
        test_functions = TEST_FUNCTION_RE.findall(test_id)
        file_paths = FILE_PATH_RE.findall(test_location)

        if not test_functions:
            errors.append(f"{label}: Automated row has no test_* function name(s) in its Test ID column")
        if not file_paths:
            errors.append(f"{label}: Automated row has no file path in its Test Location column")

        existing_file_contents = []
        for rel_path in file_paths:
            full_path = REPO_ROOT / rel_path
            if not full_path.is_file():
                errors.append(f"{label}: Test Location '{rel_path}' does not exist in the repository")
            else:
                existing_file_contents.append(full_path.read_text(encoding="utf-8"))

        combined_source = "\n".join(existing_file_contents)
        for func_name in test_functions:
            if f"def {func_name}(" not in combined_source:
                errors.append(
                    f"{label}: test function '{func_name}' was not found in {', '.join(file_paths) or '(no valid Test Location)'}"
                )


def main() -> int:
    if not QA_STANDARD_PATH.is_file():
        print(f"ERROR: '{QA_STANDARD_PATH.name}' not found at repo root", file=sys.stderr)
        return 1

    markdown = QA_STANDARD_PATH.read_text(encoding="utf-8")

    try:
        tables = find_tables(markdown)
    except TraceabilityError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not tables:
        print("ERROR: no requirement tables found under the traceability matrix heading", file=sys.stderr)
        return 1

    errors: list[str] = []
    row_count = 0
    for table in tables:
        for row in table:
            if "Requirement ID" not in row:
                continue
            row_count += 1
            check_row(row, errors)

    if row_count == 0:
        print("ERROR: no requirement rows found in the traceability matrix", file=sys.stderr)
        return 1

    if errors:
        print(f"Requirements traceability check FAILED ({len(errors)} issue(s) across {row_count} requirement(s)):\n")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(f"Requirements traceability check passed: {row_count} requirement(s) verified across {len(tables)} table(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
