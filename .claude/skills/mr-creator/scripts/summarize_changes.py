#!/usr/bin/env python3
import subprocess
import sys
from collections import defaultdict


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        sys.exit(result.returncode)
    return result.stdout


def main():
    status_lines = run(["git", "status", "--porcelain"]).splitlines()
    if not status_lines:
        print("No uncommitted changes.")
        return

    numstat = run(["git", "diff", "--numstat", "HEAD"]).splitlines()
    stats = {}
    for line in numstat:
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        added, removed, path = parts
        stats[path] = (added, removed)

    groups = defaultdict(list)
    for line in status_lines:
        code = line[:2]
        path = line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        directory = path.rsplit("/", 1)[0] if "/" in path else "(root)"
        added, removed = stats.get(path, ("?", "?"))
        groups[directory].append((code, path, added, removed))

    for directory in sorted(groups):
        print(f"\n{directory}/")
        for code, path, added, removed in sorted(groups[directory], key=lambda x: x[1]):
            print(f"  {code:<3} {path:<60} +{added} -{removed}")


if __name__ == "__main__":
    main()
