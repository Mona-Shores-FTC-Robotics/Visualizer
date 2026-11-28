#!/usr/bin/env python3
"""
Builds the driver drill's Full Match Autos: for each Auto on biobuzz master's Autonomous menu
(TeamCode/autos/*.pp), a run of MASTER's version of it from the "Simulate Auto" workflow's
sim-results branch (the Java AutoSim), as a compact JSON the drill plays for AUTO and hands TeleOp
over from. The Pages workflow runs it on every build (every half hour), so a new run shows up in
the drill with no human step.

  python3 -I scripts/drill-auto-traces.py [--out DIR] [AUTO ...]   (default: every Auto on master,
  into public/drill/autos)

Which run (`choose`): a run is of master's Auto when its commit's TeamCode/autos/<auto>.pp is the
same file (git blob) as master's: so a run from a branch whose .pp was later changed is skipped, and
a fast-lane run (auto/<name>, whose .pp master then took unchanged) counts. Among those, the
best-case scenario ("scenario": "best", every shot lands) with no forced failure, and its typical
seed. An Auto of a pair (TeamCode/autos/pairs.json) plays its pair run, the other half as the
partner (the R half's run carries both robots; the L half of RightUnderHive has no run of its own,
so it is read from the R half's, following the partner robot). R-Solo plays alone. An Auto whose
master version has no run yet keeps its newest run, marked stale with the master change since.

Standard library only; it fetches biobuzz with git (a blob-less clone; blobs come as read).

What a file carries, read from the AutoSim log (the same log AdvantageScope opens):
  - frames, 10 Hz from the AUTO's start ("AUTO starts") to the TeleOp's (38 s): the robot's pose
    (/Odometry/PedroInches/X, Y, HeadingDeg, or /Odometry/PartnerPedroInches/* for the partner:
    Pedro's frame, inches from the red audience corner), the pieces it holds (of
    /Sim/GamePieces/Held/*, those nearest it) and how many are NECTAR, each HIVE's tilt
    (/Sim/Hive/<A>/AngleDeg, positive with the rear CELL up, as the drill's simulator has it) and
    TIPs (/Sim/Hive/<A>/Tips), and its FLOWER stick;
  - partnerFrames, the same for the partner robot of a pair run (x, y, heading, held, NECTAR, stick);
  - pieceFrames: every piece on the field each frame (the human player's NECTAR roll among them);
  - handoff, at 38 s: that pose and lane, each HIVE's raised CELL, TIPs and pieces in its raised
    CELL (/Sim/Hive/<A>/RaisedCellPieces), and every game piece on the field
    (/Sim/GamePieces/Pollen, RedNectar, BlueNectar: struct Pose3d[], metres in AdvantageScope's
    Center/Rotated frame, biobuzz logging/AdvantageScopeFrame: x = -(y_pedro - c), y = x_pedro - c;
    so the simulator's X = y, Z = x, height = z);
  - the run's summary (seed, design, commit, AUTO TIPs, when each TIP came) and what it was matched
    against on master (master's commit that last changed the .pp, and whether the run is of it).
"""
import json
import os
import struct
import subprocess
import sys
import tempfile

REPO = 'https://github.com/Mona-Shores-FTC-Robotics/biobuzz.git'
WEB = 'https://github.com/Mona-Shores-FTC-Robotics/biobuzz'
AUTOS = 'TeamCode/autos'
RESULTS = 'sim-results'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'drill', 'autos')
HZ = 10
AUTO_S, TRANSITION_S = 30.0, 8.0
C_M = 72 * 0.0254  # the field's centre, metres from the red audience corner


class Biobuzz:
    """A bare, blob-less clone of biobuzz: master, every branch, sim-results."""

    def __init__(self, d):
        self.d = d
        subprocess.run(['git', 'clone', '-q', '--bare', '--filter=blob:none', REPO, d], check=True)
        subprocess.run(['git', '-C', d, 'fetch', '-q', 'origin',
                        '+refs/heads/*:refs/heads/*'], check=True)
        self._fetched = set()

    def git(self, *args, binary=False, check=True):
        r = subprocess.run(['git', '-C', self.d, *args], capture_output=True, check=False)
        if check and r.returncode:
            raise RuntimeError(f'git {" ".join(args)}: {r.stderr.decode(errors="replace").strip()}')
        return r.stdout if binary else r.stdout.decode(errors='replace').strip()

    def show(self, ref, path):
        return self.git('show', f'{ref}:{path}', binary=True)

    def ls(self, ref, path):
        out = self.git('ls-tree', '--name-only', f'{ref}', f'{path}/', check=False)
        return [p.rsplit('/', 1)[-1] for p in out.split('\n') if p]

    def blob(self, commit, path):
        """The git blob of `path` at `commit` (fetching the commit if no branch has it), or None."""
        for attempt in (0, 1):
            r = self.git('rev-parse', '-q', '--verify', f'{commit}:{path}', check=False)
            if r:
                return r
            if attempt or commit in self._fetched:
                return None
            self._fetched.add(commit)
            self.git('fetch', '-q', 'origin', commit, check=False)
        return None


def read_log(b):
    """{name: [(seconds, value)]} from a WPILib DataLog; Pose3d[] as [(x, y, z)], other structs skipped."""
    if b[:6] != b'WPILOG':
        raise ValueError('not a .wpilog')
    i = 12 + struct.unpack_from('<I', b, 8)[0]
    entries, data = {}, {}
    while i < len(b):
        h = b[i]; i += 1
        il, sl, tl = (h & 3) + 1, ((h >> 2) & 3) + 1, ((h >> 4) & 7) + 1
        eid = int.from_bytes(b[i:i + il], 'little'); i += il
        size = int.from_bytes(b[i:i + sl], 'little'); i += sl
        ts = int.from_bytes(b[i:i + tl], 'little'); i += tl
        p = b[i:i + size]; i += size
        if eid == 0:
            if p and p[0] == 0:
                e = struct.unpack_from('<I', p, 1)[0]; o = 5
                n = struct.unpack_from('<I', p, o)[0]; o += 4
                name = p[o:o + n].decode(errors='replace'); o += n
                n = struct.unpack_from('<I', p, o)[0]; o += 4
                entries[e] = (name, p[o:o + n].decode(errors='replace'))
                data.setdefault(name, [])
            continue
        if eid not in entries:
            continue
        name, typ = entries[eid]
        try:
            if typ == 'double': v = struct.unpack('<d', p)[0]
            elif typ == 'int64': v = struct.unpack('<q', p)[0]
            elif typ == 'boolean': v = bool(p[0])
            elif typ in ('string', 'json'): v = p.decode(errors='replace')
            elif typ == 'struct:Pose3d[]': v = [struct.unpack_from('<3d', p, 56 * k) for k in range(len(p) // 56)]
            else: continue
        except (struct.error, IndexError):
            continue
        data[name].append((ts / 1e6, v))
    return data


def at(series, t, default=None):
    """The last value at or before t."""
    v = default
    for ts, x in series:
        if ts > t:
            break
        v = x
    return v


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def display_name(auto):
    """r-right-under-hive → R-RightUnderHive, as the Driver Station's Autonomous menu has it."""
    side, *rest = auto.split('-')
    return f'{side.upper()}-' + ''.join(w.capitalize() for w in rest)


# ---------------------------------------------------------------------------------------------------
# Which run


def partner_of(auto, pairs):
    """The other half of `auto`'s pair (pairs.json), or None (R-Solo runs alone)."""
    for p in pairs:
        files = [f[:-3] for f in p.get('files', [])]
        if auto in files and len(files) == 2:
            return files[1 - files.index(auto)]
    return None


def candidates(bb, auto, partner):
    """
    Every published run that could stand for `auto`: (folder on sim-results, root result, entry,
    whose robot is ours: 'auto' or 'partner'). Its own runs (alone, and each pair entry with its
    partner), and the partner Auto's pair runs with `auto` as the partner.
    """
    out = []

    def scan(owner, ours):
        for commit in bb.ls(RESULTS, owner):
            if len(commit) != 40:
                continue
            try:
                root = json.loads(bb.show(RESULTS, f'{owner}/{commit}/result.json'))
            except (RuntimeError, ValueError):
                continue
            for e in root.get('entries') or [{'name': 'alone', 'folder': ''}]:
                src = (e.get('partnerSource') or '')[:-3] or None
                if ours == 'auto' and src not in (None, partner):
                    continue  # a stand-in partner, not our pair
                if ours == 'partner' and src != auto:
                    continue
                out.append({'owner': owner, 'commit': commit, 'root': root, 'entry': e, 'ours': ours})

    scan(auto, 'auto')
    if partner:
        scan(partner, 'partner')
    return out


def choose(bb, auto, partner, master_blobs):
    """The run the drill plays for `auto`, with `fresh` (master's .pp) and the ranking it won by."""
    best = None
    for c in candidates(bb, auto, partner):
        e, root = c['entry'], c['root']
        commit = c['commit']
        c['fresh'] = bb.blob(commit, f'{AUTOS}/{auto}.pp') == master_blobs[auto]
        c['partnerFresh'] = bool(partner) and e.get('partnerSource') and \
            bb.blob(commit, f'{AUTOS}/{partner}.pp') == master_blobs.get(partner)
        is_pair = bool(partner) and (e.get('partnerSource') or '')[:-3] == (partner if c['ours'] == 'auto' else auto)
        forced = bool(e.get('fails') or e.get('oursFails')) or (is_pair and not e.get('name', '').startswith('pair'))
        scenario = root.get('scenario') or (root.get('request') or {}).get('scenario')
        c['scenario'] = scenario
        c['pair'] = is_pair
        # The run of master's Auto first; then, for a pair, with master's partner; the best case,
        # no forced failure; the pair run over the Auto alone; our own folder; the newest.
        key = (c['fresh'], bool(c['partnerFresh']) if partner else True, scenario == 'best', not forced,
               is_pair if partner else not e.get('folder'), c['ours'] == 'auto', root.get('finishedAt') or '')
        if best is None or key > best[0]:
            best = (key, c)
    return best[1] if best else None


# ---------------------------------------------------------------------------------------------------
# The trace


def build(bb, auto, partner, chosen, master_change):
    root, e, owner, commit = chosen['root'], chosen['entry'], chosen['owner'], chosen['commit']
    folder = '/'.join(x for x in (owner, commit, e.get('folder')) if x)
    res = root if not e.get('folder') else json.loads(bb.show(RESULTS, f'{folder}/result.json'))
    seed = res.get('typicalSeed') if res.get('typicalSeed') is not None else e.get('typicalSeed')
    logs = res.get('logs') or e.get('logs') or {}
    log_name = logs.get(str(seed))
    if not log_name:
        raise RuntimeError(f'{folder}: no log for typical seed {seed}')
    log = read_log(bb.show(RESULTS, f'{folder}/{log_name}'))
    start = next(t for t, v in log['/Events'] if str(v) == 'AUTO starts')
    row = next((r for r in res.get('runs', []) if r.get('seed') == seed), {}) or \
        next((r for r in e.get('rows', []) if r.get('seed') == seed), {})

    mine, theirs = ('', 'Partner') if chosen['ours'] == 'auto' else ('Partner', '')

    def robot_keys(who):
        pre = f'/Odometry/{who}PedroInches'
        return ([log.get(f'{pre}/{k}', []) for k in ('X', 'Y', 'HeadingDeg')],
                log.get(f'/{who}/Internals/FlowerStickDeg' if who else '/Internals/FlowerStickDeg', []))

    ours_pose, ours_stick = robot_keys(mine)
    other_pose, other_stick = robot_keys(theirs)
    has_other = bool(other_pose[0])
    held_keys = {'pollen': '/Sim/GamePieces/Held/Pollen', 'red': '/Sim/GamePieces/Held/RedNectar',
                 'blue': '/Sim/GamePieces/Held/BlueNectar'}
    has_held = any(log.get(k) for k in held_keys.values())

    def as_xy(pose):  # Pedro inches → AdvantageScope Center/Rotated metres
        return -(pose[1] * 0.0254 - C_M), pose[0] * 0.0254 - C_M

    def held_at(t, a, b):
        """(held, NECTAR held) for robots at Pedro poses a (ours) and b (the other, or None)."""
        if not has_held:
            return int(num(at(log.get('/Sim/Robot/Held', []), t, 0))), 0
        pa = as_xy(a)
        pb = as_xy(b) if b else None
        n = nectar = 0
        for kind, key in held_keys.items():
            for x, y, _ in at(log.get(key, []), t) or []:
                da = (x - pa[0]) ** 2 + (y - pa[1]) ** 2
                if pb is None or da <= (x - pb[0]) ** 2 + (y - pb[1]) ** 2:
                    n += 1
                    nectar += kind != 'pollen'
        return n, nectar

    def hive(a, t):
        angle = at(log.get(f'/Sim/Hive/{a}/AngleDeg', []), t)
        tips = int(num(at(log.get(f'/Sim/Hive/{a}/Tips', []), t, 0)))
        # Before its first swing a HIVE has no angle logged: it is at its starting stop (red: audience up, blue: rear).
        if angle is None:
            angle = -30.0 if a == 'Red' else 30.0
        return round(num(angle), 1), tips

    def pose_at(keys, t):
        return [round(num(at(s, t)), 2) for s in keys[:2]] + [round(num(at(keys[2], t)), 1)]

    frames, partner_frames = [], []
    # Every game piece on the field each frame (not those in a robot: its lane is `held`), so the
    # replay shows the volleys fly, the human player's NECTAR roll and the CELLs fill: centimetres
    # in the simulator's frame (X, height, Z), flattened, one list per frame and kind.
    piece_keys = {'pollen': '/Sim/GamePieces/Pollen', 'nectarRed': '/Sim/GamePieces/RedNectar',
                  'nectarBlue': '/Sim/GamePieces/BlueNectar'}
    piece_frames = {k: [] for k in piece_keys}
    for k in range(int((AUTO_S + TRANSITION_S) * HZ) + 1):
        t = start + k / HZ
        r, b = hive('Red', t), hive('Blue', t)
        a = pose_at(ours_pose, t)
        o = pose_at(other_pose, t) if has_other else None
        held, nectar = held_at(t, a, o)
        frames.append([round(k / HZ, 1), *a, held, r[0], r[1], b[0], b[1],
                       round(num(at(ours_stick, t, 0)), 1), nectar])
        if o:
            oh, on = held_at(t, o, a)
            partner_frames.append([*o, oh, on, round(num(at(other_stick, t, 0)), 1)])
        for name, key in piece_keys.items():
            piece_frames[name].append([round(v * 100) for x, y, z in (at(log.get(key, []), t) or []) for v in (y, z, x)])
    t = start + AUTO_S + TRANSITION_S

    def pieces(key):
        return [[round(y, 3), round(z, 3), round(x, 3)] for x, y, z in (at(log.get(key, []), t) or [])]

    def hive_state(a):
        angle, tips = hive(a, t)
        return {'up': 'rear' if angle > 0 else 'audience', 'tips': tips,
                'raisedCellPieces': int(num(at(log.get(f'/Sim/Hive/{a}/RaisedCellPieces', []), t, 0)))}

    last = frames[-1]
    partner_name = (e.get('partnerSource') or '')[:-3] or None if chosen['ours'] == 'auto' else owner
    return {
        'auto': auto,
        'name': display_name(auto),
        'source': f'biobuzz sim-results/{folder}/{log_name} (Java AutoSim, "Simulate Auto")'
                  + (', following the partner robot' if chosen['ours'] == 'partner' else ''),
        'design': res.get('design') or root.get('design'),
        'calibration': root.get('calibration'),
        'alliance': root.get('alliance'),
        'seed': seed,
        'scenario': chosen['scenario'],
        'entry': e.get('name'),
        'partnerAuto': partner_name,
        'commit': commit,
        'branch': root.get('branch'),
        'finishedAt': root.get('finishedAt'),
        'runUrl': root.get('runUrl'),
        'logsUrl': f'{WEB}/tree/{RESULTS}/{folder}',
        'master': {
            'fresh': bool(chosen['fresh']),
            'partnerFresh': bool(chosen['partnerFresh']) if partner_name else None,
            'commit': master_change['commit'],
            'date': master_change['date'],
            'subject': master_change['subject'],
        },
        'autoTips': row.get('autoTips'),
        'tipsAt': row.get('tipsAt'),
        'launched': row.get('launched'),
        'scored': row.get('scored'),
        'columns': ['t', 'x', 'y', 'headingDeg', 'held', 'redAngleDeg', 'redTips', 'blueAngleDeg', 'blueTips',
                    'stickDeg', 'heldNectar'],
        'frames': frames,
        **({'partnerColumns': ['x', 'y', 'headingDeg', 'held', 'heldNectar', 'stickDeg'],
            'partnerFrames': partner_frames} if partner_frames else {}),
        'pieceFrames': piece_frames,
        'handoff': {
            'pose': {'x': last[1], 'y': last[2], 'headingDeg': last[3]},
            'held': last[4],
            'heldNectar': last[10],
            'hives': {'red': hive_state('Red'), 'blue': hive_state('Blue')},
            'pieces': {'pollen': pieces('/Sim/GamePieces/Pollen'), 'nectarRed': pieces('/Sim/GamePieces/RedNectar'),
                       'nectarBlue': pieces('/Sim/GamePieces/BlueNectar')},
        },
    }


INDEX_KEYS = ('auto', 'name', 'alliance', 'design', 'seed', 'scenario', 'entry', 'partnerAuto', 'autoTips', 'tipsAt',
              'finishedAt', 'commit', 'branch', 'runUrl', 'logsUrl', 'master')


def main(argv):
    args = argv[1:]
    out = OUT
    if '--out' in args:
        i = args.index('--out')
        out = args[i + 1]
        del args[i:i + 2]
    os.makedirs(out, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        bb = Biobuzz(os.path.join(d, 'biobuzz.git'))
        master = bb.git('rev-parse', 'master')
        names = sorted(f[:-3] for f in bb.ls('master', AUTOS) if f.endswith('.pp'))
        pairs = json.loads(bb.show('master', f'{AUTOS}/pairs.json')).get('pairs', [])
        master_blobs = {n: bb.blob('master', f'{AUTOS}/{n}.pp') for n in names}
        try:
            with open(os.path.join(out, 'index.json')) as f:
                before = {a['auto']: a for a in json.load(f).get('autos', [])}
        except (OSError, ValueError):
            before = {}
        index = []
        for auto in args or names:
            partner = partner_of(auto, pairs)
            c, s, subject = bb.git('log', '-1', '--format=%H%x00%cI%x00%s', 'master', '--',
                                   f'{AUTOS}/{auto}.pp').split('\x00')
            change = {'commit': c, 'date': s, 'subject': subject}
            try:
                chosen = choose(bb, auto, partner, master_blobs)
                if not chosen:
                    raise RuntimeError('no published run')
                tr = build(bb, auto, partner, chosen, change)
            except Exception as e:  # keep what was there: an Auto that fails to build is not dropped
                print(f'{auto}: skipped ({e})', file=sys.stderr)
                if auto in before and os.path.exists(os.path.join(out, f'{auto}.json')):
                    index.append(before[auto])
                continue
            with open(os.path.join(out, f'{auto}.json'), 'w') as f:
                json.dump(tr, f, separators=(',', ':'))
                f.write('\n')
            index.append({k: tr[k] for k in INDEX_KEYS})
            m = tr['master']
            print(f'{auto}: {"master" if m["fresh"] else "STALE (master changed " + m["date"][:10] + ")"}'
                  f'{"" if m["partnerFresh"] in (None, True) else ", partner not master"}; '
                  f'{tr["entry"]!r} scenario {tr["scenario"]}, seed {tr["seed"]}, {tr["autoTips"]} AUTO TIPs at '
                  f'{tr["tipsAt"]}; run {tr["finishedAt"]} on {tr["branch"]} ({tr["commit"][:7]})')
    with open(os.path.join(out, 'index.json'), 'w') as f:
        json.dump({'source': f'biobuzz master {master[:7]} ({AUTOS}) and its {RESULTS} branch',
                   'master': master, 'autos': index}, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv)
