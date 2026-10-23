# hermes-webui (operator-owned fork)

Operator-owned copy of [nesquena/hermes-webui](https://github.com/nesquena/hermes-webui),
served on this fleet at `https://ufelhermes.carp-algol.ts.net:8787/` by
`hermes-webui.service`.

## Why this repo exists

Upstream is not operator-owned, so fleet-specific fixes could not be committed
there. This repo replaces the clone's git history with a fresh one so the code
can be patched, tested and pushed like any other owned project.

The original history is preserved and recoverable: the upstream clone's `.git`
directory (10,793 commits, 343 MB) and a full tarball of the working tree are
kept outside the repo. See `NOTICE` for the exact backup paths.

## Licence

MIT, Copyright (c) 2025 Hermes Web UI Contributors. The original `LICENSE` is
kept verbatim; redistribution and modification are permitted. This is a copy,
not a claim of authorship: see `NOTICE` for provenance.

## Running the tests

The suite is large (1,689 test files). Two gotchas, both of which produce a
misleading result rather than a clear error:

```bash
# 1. The test-state dir must be OUTSIDE ~/.hermes, or conftest.py refuses to run.
export HERMES_WEBUI_TEST_STATE_DIR=/tmp/hermes-webui-test-state

# 2. Disable the libtmux pytest plugin: it is installed in the system python and
#    crashes collection at import time ("Marks cannot be applied to fixtures").
/usr/bin/python3 -m pytest tests/ -q -p no:libtmux
```

The system `/usr/bin/python3` has pytest; the bundled Hermes python does not.
Upstream CI shards the suite 5 ways with `pytest-shard`; that plugin is not
installed here, so run targeted subsets rather than the full suite when
iterating:

```bash
# Files that touch the right panel / workspace panel
/usr/bin/python3 -m pytest $(grep -rl "rightpanel\|workspace-panel" tests/*.py) -q -p no:libtmux
```

## Serving

```bash
systemctl --user restart hermes-webui.service   # port 8787, WorkingDirectory = this repo
```

## Upstream sync

Upstream is kept as a read-only remote for reference and for cherry-picking:

```bash
git remote add upstream https://github.com/nesquena/hermes-webui.git   # once
git fetch upstream
git log --oneline upstream/master | head              # inspect
git cherry-pick <sha>                                  # take one fix
git diff HEAD upstream/master -- static/style.css      # compare a file
```

This repo's history is unrelated to upstream's (fresh root commit), so a
`git merge upstream/master` would conflict on every file. Cherry-pick by SHA, or
diff-and-port a file by hand.