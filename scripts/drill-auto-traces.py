#!/usr/bin/env python3
"""
Builds the driver drill's Full Match Autos: for each of our generated Autos on biobuzz master
(TeamCode/autos/*.pp), the typical run the "Simulate Auto" workflow published on biobuzz's
sim-results branch (<auto>/latest.json and latest-typical.wpilog, from the Java AutoSim), as a
compact JSON the drill plays for AUTO and hands TeleOp over from.

  python3 -I scripts/drill-auto-traces.py [AUTO ...]      (default: every Auto on master)

Writes public/drill/autos/<auto>.json and public/drill/autos/index.json. Standard library only;
it fetches from GitHub (raw.githubusercontent.com, and a sparse clone for the list of Autos).

What a file carries, read from the AutoSim log (the same log AdvantageScope opens):
  - frames, 10 Hz from the AUTO's start ("AUTO starts") to the TeleOp's (38 s): the robot's pose
    (/Odometry/PedroInches/X, Y, HeadingDeg: Pedro's frame, inches from the red audience corner),
    the pieces it holds (/Sim/Robot/Held), and each HIVE's tilt (/Sim/Hive/<A>/AngleDeg, positive
    with the rear CELL up, as the drill's simulator has it) and TIPs (/Sim/Hive/<A>/Tips);
  - handoff, at 38 s: that pose and lane, each HIVE's raised CELL, TIPs and pieces in its raised
    CELL (/Sim/Hive/<A>/RaisedCellPieces), and every game piece on the field
    (/Sim/GamePieces/Pollen, RedNectar, BlueNectar: struct Pose3d[], metres in AdvantageScope's
    Center/Rotated frame, biobuzz logging/AdvantageScopeFrame: x = -(y_pedro - c), y = x_pedro - c;
    so the simulator's X = y, Z = x, height = z);
  - the run's own summary from latest.json (seed, design, commit, AUTO TIPs, when each TIP came).
"""
import json
import os
import struct
import subprocess
import sys
import tempfile
import urllib.request

RAW = 'https://raw.githubusercontent.com/Mona-Shores-FTC-Robotics/biobuzz'
REPO = 'https://github.com/Mona-Shores-FTC-Robotics/biobuzz.git'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'drill', 'autos')
HZ = 10
AUTO_S, TRANSITION_S = 30.0, 8.0


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def master_autos():
    """The Auto names on biobuzz master: TeamCode/autos/*.pp, by a sparse, blob-less clone."""
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', REPO, d], check=True)
        subprocess.run(['git', '-C', d, 'sparse-checkout', 'set', 'TeamCode/autos'], check=True)
        commit = subprocess.run(['git', '-C', d, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True).stdout.strip()
        names = sorted(f[:-3] for f in os.listdir(os.path.join(d, 'TeamCode', 'autos')) if f.endswith('.pp'))
    return names, commit


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


def build(auto):
    meta = json.loads(fetch(f'{RAW}/sim-results/{auto}/latest.json'))
    log = read_log(fetch(f'{RAW}/sim-results/{auto}/latest-typical.wpilog'))
    start = next(t for t, v in log['/Events'] if str(v) == 'AUTO starts')
    seed = meta.get('typicalSeed')
    row = next((r for r in meta.get('runs', []) if r.get('seed') == seed), {})
    px, py, ph = (log[k] for k in ('/Odometry/PedroInches/X', '/Odometry/PedroInches/Y', '/Odometry/PedroInches/HeadingDeg'))
    held = log.get('/Sim/Robot/Held', [])

    def hive(a, t):
        angle = at(log.get(f'/Sim/Hive/{a}/AngleDeg', []), t)
        tips = int(num(at(log.get(f'/Sim/Hive/{a}/Tips', []), t, 0)))
        # Before its first swing a HIVE has no angle logged: it is at its starting stop (red: audience up, blue: rear).
        if angle is None:
            angle = -30.0 if a == 'Red' else 30.0
        return round(num(angle), 1), tips

    frames = []
    for k in range(int((AUTO_S + TRANSITION_S) * HZ) + 1):
        t = start + k / HZ
        r, b = hive('Red', t), hive('Blue', t)
        frames.append([round(k / HZ, 1), round(num(at(px, t)), 2), round(num(at(py, t)), 2), round(num(at(ph, t)), 1),
                       int(num(at(held, t, 0))), r[0], r[1], b[0], b[1]])
    t = start + AUTO_S + TRANSITION_S

    def pieces(key):
        return [[round(y, 3), round(z, 3), round(x, 3)] for x, y, z in (at(log.get(key, []), t) or [])]

    def hive_state(a):
        angle, tips = hive(a, t)
        return {'up': 'rear' if angle > 0 else 'audience', 'tips': tips,
                'raisedCellPieces': int(num(at(log.get(f'/Sim/Hive/{a}/RaisedCellPieces', []), t, 0)))}

    last = frames[-1]
    return {
        'auto': auto,
        'source': f'biobuzz sim-results/{auto}: latest.json and latest-typical.wpilog (Java AutoSim, "Simulate Auto")',
        'design': meta.get('design'),
        'calibration': meta.get('calibration'),
        'alliance': meta.get('alliance'),
        'seed': seed,
        'commit': meta.get('commit'),
        'branch': meta.get('branch'),
        'finishedAt': meta.get('finishedAt'),
        'runUrl': meta.get('runUrl'),
        'autoTips': row.get('autoTips'),
        'tipsAt': row.get('tipsAt'),
        'launched': row.get('launched'),
        'scored': row.get('scored'),
        'columns': ['t', 'x', 'y', 'headingDeg', 'held', 'redAngleDeg', 'redTips', 'blueAngleDeg', 'blueTips'],
        'frames': frames,
        'handoff': {
            'pose': {'x': last[1], 'y': last[2], 'headingDeg': last[3]},
            'held': last[4],
            'hives': {'red': hive_state('Red'), 'blue': hive_state('Blue')},
            'pieces': {'pollen': pieces('/Sim/GamePieces/Pollen'), 'nectarRed': pieces('/Sim/GamePieces/RedNectar'),
                       'nectarBlue': pieces('/Sim/GamePieces/BlueNectar')},
        },
    }


def main(argv):
    names, commit = master_autos()
    wanted = argv[1:] or names
    os.makedirs(OUT, exist_ok=True)
    index = []
    for auto in wanted:
        try:
            tr = build(auto)
        except Exception as e:  # an Auto with no published run is listed as missing, not fatal
            print(f'{auto}: skipped ({e})', file=sys.stderr)
            continue
        with open(os.path.join(OUT, f'{auto}.json'), 'w') as f:
            json.dump(tr, f, separators=(',', ':'))
            f.write('\n')
        index.append({k: tr[k] for k in ('auto', 'alliance', 'design', 'seed', 'autoTips', 'finishedAt', 'commit')})
        print(f'{auto}: {tr["autoTips"]} AUTO TIPs, hand-off lane {tr["handoff"]["held"]}, '
              f'{len(tr["handoff"]["pieces"]["pollen"])} POLLEN (field and human players), design "{tr["design"]}", run {tr["finishedAt"]}')
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump({'source': f'biobuzz master {commit[:7]} (TeamCode/autos) and its sim-results branch',
                   'autos': index}, f, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv)
