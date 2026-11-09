"""Regroup app.css by screen instead of by the order things were added. python3 tools/regroup_css.py in.css out.css
Each top-level block (rule, @media, @keyframes, comment) is assigned to a section from its selectors; blocks keep their
relative order inside a section. A later refinement of a selector is never moved in front of the first rule for it:
it joins that rule's section instead, so the cascade comes out the same."""
import re, sys, collections

SECTIONS = ["base", "header", "setup", "trip", "stop", "storybook", "explore", "bookings", "today", "journal", "settings", "motion"]
TITLES = {
    "base": "foundations: colour tokens (light and dark), type, buttons, chips, fields, notes, utilities",
    "header": "the header: wordmark, which trip (and the trips menu), Travel mode switch, the tabs",
    "setup": "Setup: the five steps, travellers, cities and where to stay, route check",
    "trip": "My trip: day picker, the day's plan (slots, legs, free time, the clock), energy and rest days, jet lag, swap cards, sheets and undo",
    "stop": "a stop's details and the actions sheet",
    "storybook": "the storybook view",
    "explore": "Explore: the day's map (sketch or street map) and every idea for the city",
    "bookings": "Bookings: checklist, live prices, budget, add a booking",
    "today": "Today: the Travel-mode screen",
    "journal": "journal, recap, family hearts and comments",
    "settings": "Trip settings: sharing, calendar and PDF, booking sites, price watches, import a plan",
    "motion": "motion: keyframes and the reduced-motion overrides",
}
# selector fragments that decide a block's section (first match wins, checked in this order)
KEYS = [
    ("storybook", r"\.sp\b|\.sp-|\.story|\.painted|svg\.pt\b|\.ttop"),
    ("today", r"\.go\b|\.go-|\.gt-|\.ge-|\.gh-|\.gn-|\.tl-b|\.today\b|\.today-|\.now-l|\.goview"),
    ("journal", r"\.j-h|\.jgrid|\.journal|\.recap|\.rc\b|\.rc-|\.jp\b|\.jx\b|\.jnote|\.jadd|\.heart|\.fam\b"),
    ("bookings", r"\.chk|\.budget|\.bk\b|\.bk-|\.chip-a|\.wdrop|\.addbk|\.live|\.lv-|\.sites|\.bookview|\.book\b|\.gchev|\.exp\b|\.compact"),
    ("settings", r"\.settings|\.set-|\.tm-set|\.wlist|\.wl-b|\.import|\.qs-imp|\.share\b|\.code\b|\.ro-banner|\.ro-r"),
    ("explore", r"\.explore|\.explorer|\.map-wrap|\.maplibregl|\.vt-|svg\.map|\.map\b|\.ideas|\.idea\b|\.idea-|\.ex-h|\.ex-n|\.ex-f|\.dayflip|\.home\b|\.legend|\.zoom|\.skel-list|\.ideas-t|\.map-note"),
    ("header", r"\.top\b|\.brand|\.tabs|\.trip-sw|\.tripbar|\.trip-menu|\.trips\b|\.sync-st|\.tm-sw|\.tm-k|\.warnbtn|\.tag\b|\.lbl\b|#tripbar|\.ro\b|\.use\b"),
    ("setup", r"\.step\b|\.step-|\.trav\b|\.trav\.|\.stay-btn|\.stepper|\.lodge|\.browse|\.setup|\.sum\b|\.country-h|\.stop-a|\.pace|\.fld\b|\.age\b|\.rcheck|\.rtcheck|\.ri\b|\.qs\b|\.qs-|details\.step|\.lodges|\.stop\b|\.add\b|#addAdult|#addChild|#days"),
    ("stop", r"\.sd\b|\.sd-|\.sheet|\.sh-|\.rev\b|\.alt\b|\.links\b|\.meta\b|\.menu-btn|\.slim-a|\.lo-act|\.legcard|\.legopts|\.lo\b|\.lo-|\.bchip|\.sel\b"),
    ("trip", r"\.slot|\.slots|\.day-|\.daybar|\.dpill|\.days\b|\.dgroup|\.dg-|\.energy|\.bars|\.lv[1-4]|\.jetlag|\.fold-chev|\.transit|\.leg\b|\.free\b|\.when\b|\.num\b|\.nm\b|\.skel|\.scard|\.sl-|\.glance|\.g-day|\.gl-btn|\.dn-b|\.undo|#undohost|#lifthost|\.lifthint|\.travel-note|\.booked|\.skipped|\.tm\b|\.dayview|\.de-|\.st-btn|\.kid\b|\.thumb|\.credit|\.pic\b|\.sketch|\.sd-cap|\.sk-cap|\.vh\b|\.nw\b|\.ref\b|#nextbar|\.nb-|\.next"),
    ("motion", r"@keyframes|prefers-reduced-motion"),
]


def section_of(block, default):
    head = block.split("{", 1)[0]
    if block.startswith("@media") or block.startswith("@supports"):
        head = block   # the inner selectors decide
    if re.search(r"prefers-reduced-motion|@keyframes", block[:80]):
        return "motion"
    for sec, rx in KEYS:
        if re.search(rx, head):
            return sec
    return default


def split(css):
    blocks = []; i = 0; n = len(css)
    while i < n:
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2; blocks.append(("comment", css[i:j])); i = j; continue
        if css[i] in " \n\t":
            i += 1; continue
        j = i; depth = 0
        while j < n:
            c = css[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    j += 1; break
            j += 1
        blocks.append(("rule", css[i:j])); i = j
    return explode(blocks)


def explode(blocks):
    """an @media or @supports block with several rules becomes one block per rule, so each can go to its own section"""
    out = []
    for kind, text in blocks:
        m = re.match(r"(@(?:media|supports)[^{]*)\{(.*)\}\s*$", text, re.S)
        if kind != "rule" or not m:
            out.append((kind, text)); continue
        head, body = m.group(1).strip(), m.group(2)
        inner = [t for k, t in split_plain(body)]
        if len(inner) <= 1:
            out.append((kind, text)); continue
        for t in inner:
            out.append(("rule", head + "{" + t.strip() + "}"))
    return out


def split_plain(css):
    """top-level blocks without exploding (comments inside a media block stay with the next rule)"""
    blocks = []; i = 0; n = len(css); pending = ""
    while i < n:
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2; pending += css[i:j] + "\n"; i = j; continue
        if css[i] in " \n\t":
            i += 1; continue
        j = i; depth = 0
        while j < n:
            c = css[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    j += 1; break
            j += 1
        blocks.append(("rule", pending + css[i:j])); pending = ""; i = j
    return blocks


def selectors(block):
    """every selector list in the block, including inside @media"""
    out = []
    for m in re.finditer(r"([^{};]+)\{", block):
        s = m.group(1).strip()
        if s.startswith("@"):
            continue
        out.append(re.sub(r"\s+", " ", s))
    return out


def chrono_section(title):
    t = title.lower()
    if "route check" in t: return "setup"
    if "setup" in t: return "setup"
    if "trip bar" in t or "slim header" in t or "one switch" in t: return "header"
    if "settings" in t or "import" in t: return "settings"
    if t.startswith("trip") or "clock" in t or "tiring" in t or "jet lag" in t or "calmer" in t or "day picker" in t or "my trip" in t or "smoother" in t: return "trip"
    if "reviews" in t: return "stop"
    if "today" in t: return "today"
    if "bookings" in t or "prices" in t: return "bookings"
    if "journal" in t or "family" in t: return "journal"
    if "storybook" in t: return "storybook"
    if "explore" in t: return "explore"
    return "base"


def regroup(css):
    blocks = split(css)
    default = "base"; assigned = []
    for kind, text in blocks:
        if kind == "comment":
            m = re.match(r"/\* -+ (.*?) -+ \*/", text)
            if m:
                default = chrono_section(m.group(1)); continue   # old section headers go; new ones are written below
            if "Layout:" in text or "Look:" in text:
                continue
            assigned.append((default, kind, text)); continue
        assigned.append((section_of(text, default), kind, text))
    # a comment goes with the rule after it
    fixed = []
    for i, (sec, kind, text) in enumerate(assigned):
        if kind == "comment" and i + 1 < len(assigned):
            sec = assigned[i + 1][0]
        fixed.append([sec, kind, text])
    order = {s: i for i, s in enumerate(SECTIONS)}
    moved = []
    for _ in range(30):
        last = {}; changed = False
        for i, (sec, kind, text) in enumerate(fixed):
            if kind != "rule":
                continue
            for s in selectors(text):
                if s in last and order[last[s]] > order[sec]:
                    # a later rule for this selector would land in front of an earlier one: it joins the earlier one's section
                    moved.append((s, sec, last[s])); fixed[i][0] = last[s]; sec = last[s]; changed = True
                last[s] = sec
        if not changed:
            break
    else:
        raise SystemExit("could not settle the cascade")
    for s, a, b in moved:
        print("  moved a later rule for %r from %s to %s" % (s[:70], a, b))
    out = ["/* Waypoint's stylesheet, grouped by screen: foundations first, then each screen in the order a trip goes through them.\n"
           "   Look: gouache-on-paper. Charcoal ink, paper grain, hand-drawn outlines, scene colours (night, meadow, sunset, crystal), red pencil notes. */\n"]
    for sec in SECTIONS:
        items = [t for s, k, t in fixed if s == sec]
        if not items:
            continue
        out.append("\n/* ==================== %s ==================== */\n" % TITLES[sec])
        out.append("\n".join(items) + "\n")
    return "".join(out), collections.Counter(s for s, k, t in fixed if k == "rule")


if __name__ == "__main__":
    css = open(sys.argv[1]).read()
    out, counts = regroup(css)
    open(sys.argv[2], "w").write(out)
    print(dict(counts))
