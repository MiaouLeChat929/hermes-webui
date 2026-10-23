"""Regression coverage for the 14px horizontal overflow of the collapsed workspace panel.

At >=901px the collapsed right panel stayed in the flex row with `width:0` plus
`transform:translateX(14px)`. A transform does not remove an element from flow,
so the panel kept a 14px visual footprint past the right edge of `.layout`, and
`document.documentElement.scrollWidth - clientWidth` measured 14 on a 1440px
viewport. The 1px collapsed panel is also worthless as a flex item: it cannot
absorb any of the difference, because `main` carries an explicit
`min-width:420px`.

Fix: take the collapsed panel out of flow entirely so no footprint remains.
The reopen affordance is unaffected: it is a sibling of the panel
(`#btnWorkspacePanelEdgeToggle`, before the `<aside>` in index.html) and keeps
its own `inline-flex` rule.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "static" / "style.css").read_text(encoding="utf-8")

CLOSED_RULE = (
    'html[data-workspace-panel="closed"] .rightpanel'
    "{width:0 !important;min-width:0 !important;opacity:0;"
    "transform:translateX(14px);border-left-color:transparent;pointer-events:none;}"
)


def _closed_rule() -> str:
    """Return the current closed-panel declaration, whatever it now says."""
    start = CSS.index('html[data-workspace-panel="closed"] .rightpanel{')
    end = CSS.index("}", start) + 1
    return CSS[start:end]


def test_collapsed_panel_is_out_of_flow():
    """A transform does not remove an element from flow, so the collapsed panel
    must be positioned absolutely to stop contributing to scrollWidth."""
    rule = _closed_rule()
    assert "position:absolute" in rule, (
        "collapsed .rightpanel must be position:absolute; a translateX alone "
        "keeps it in the flex row and reproduces the 14px overflow"
    )


def test_collapsed_panel_has_no_translate_offset():
    """translateX(14px) is literally the 14px of measured overflow."""
    rule = _closed_rule()
    assert "translateX(14px)" not in rule, (
        "the 14px translate is the overflow; with the panel out of flow it is "
        "both unnecessary and the exact cause"
    )
    assert "transform:none" in rule, "reset the transform so it cannot re-add a footprint"


def test_collapsed_panel_stays_zero_width_and_inert():
    """The panel must stay collapsed and non-interactive when closed."""
    rule = _closed_rule()
    assert "width:0" in rule
    assert "opacity:0" in rule
    assert "pointer-events:none" in rule


def _desktop_media_block_span() -> tuple[int, int]:
    """Return (start, end) of the @media(min-width:901px) block that holds the
    closed-panel rule.

    There are several `min-width:901px` blocks in this stylesheet, so the one to
    check is the LAST one that opens before the rule, not simply the last one in
    the file. Finding the wrong block makes this test report a false failure.
    """
    rule_index = CSS.index('html[data-workspace-panel="closed"] .rightpanel{')
    marker = "@media(min-width:901px)"
    start = CSS.rindex(marker, 0, rule_index)
    return start, start + len(marker)


def test_collapsed_rule_is_inside_the_desktop_media_query():
    """This only applies >=901px. Below that the panel is an off-canvas drawer
    handled by the max-width:900px block, and this rule must not touch it."""
    start, end = _desktop_media_block_span()
    rule_index = CSS.index('html[data-workspace-panel="closed"] .rightpanel{')
    assert rule_index > end, "closed rule must live in the >=901px block"


def test_reopen_affordance_is_unaffected():
    """The edge toggle is what makes a 0-width panel recoverable, so it must
    keep its own visible rule when the panel is closed."""
    assert (
        'html[data-workspace-panel="closed"] .workspace-panel-edge-toggle'
        "{display:inline-flex;opacity:1;pointer-events:auto;"
        "transform:translateY(-50%);}" in CSS
    )
    assert 'html[data-workspace-panel="open"] .workspace-panel-edge-toggle{display:none;}' in CSS