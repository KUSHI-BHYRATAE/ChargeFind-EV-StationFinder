---
name: ChargeFind runtime paths
description: Replit API-server working-directory differences that affect the Python service launcher.
---

The ChargeFind API server can start with its working directory set to either the `artifacts/api-server` package or the workspace root. Python API paths must be resolved from a detected API package root, not by assuming one working directory.

**Why:** Production requests previously failed because a package-relative path was resolved from the workspace root, pointing to `/home/.pythonlibs` instead of the workspace interpreter.

**How to apply:** When changing ChargeFind Python startup paths, verify both package-directory and workspace-root launch contexts; derive the interpreter location from the detected `artifacts/api-server` root.