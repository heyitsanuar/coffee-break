"""Derive labeled boards from untouched original PNGs; --check never writes files."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/verification/assets/us-036'
REFERENCE = 'docs/design/references/ep-06/'
RUNTIME = 'docs/verification/assets/us-036/'
SPECS = {
    'desktop': [REFERENCE+'ep06-fidelity-desktop.png', RUNTIME+'1100-production-100.png'],
    'compact': [REFERENCE+'ep06-fidelity-compact.png', RUNTIME+'760-production-100.png'],
    'compact-flow': [REFERENCE+'ep06-fidelity-compact-flow.png'],
    'expanded': [REFERENCE+'ep06-fidelity-expanded.png', RUNTIME+'1100-expanded-100-room.png', RUNTIME+'760-expanded-100-room.png'],
    'retained': [REFERENCE+'ep06-fidelity-retained.png', RUNTIME+'1100-recovery-retained-100.png'],
    'keyboard': [REFERENCE+'ep06-fidelity-keyboard.png', RUNTIME+'1100-normal-100-keyboard-forward.png', RUNTIME+'760-expanded-200-keyboard-forward.png'],
    'environment': ['docs/design/references/north-star/coffee-break-north-star-03.png', REFERENCE+'ep06-environment-study.png', RUNTIME+'1100-normal-100-room.png'],
}
TRANSLATIONS = {
    'desktop': 'Lightweight navigation; three canonical identities; truthful Runtime/Sample/Preview; native targets and intrinsic text growth.',
    'compact': 'Full fixed room; selector and precise inspection below the initial viewport; natural vertical flow, no fixed OS frame assumption.',
    'compact-flow': 'Ordered overlapping original viewport slices; sticky toolbar repeats; no pixels are stitched into a fictitious runtime screenshot.',
    'expanded': 'Same 640x360 room; availability band and instructions; lower selector/inspector; no fullscreen or camera zoom.',
    'retained': 'Retained exact lifecycle/activity/reason; paused operational loops; freshness separate from global availability.',
    'keyboard': 'Native traversal; cyan focus distinct from warm selection; all coordinates refer to the original PNG and measured DPR.',
    'environment': 'Authored 320x180 logical grid at 2x; canonical identities, monitor fields, mug/steam and foreground occlusion; conceptual detail is intentionally translated.',
}

def sha(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()


def render(name, paths):
    font = ImageFont.load_default(size=14)
    panels = []
    sources = []
    for index, path in enumerate(paths):
        with Image.open(ROOT/path) as original:
            original.load()
            image = original.convert('RGB')
            original_size = image.size
        width = min(760, image.width)
        height = round(image.height * width / image.width)
        displayed = image.resize((width, height), Image.Resampling.NEAREST)
        panel = Image.new('RGB', (780, height+106), '#08121c')
        draw = ImageDraw.Draw(panel)
        kind = 'DESIGN REFERENCE' if index == 0 or path.startswith(REFERENCE) else 'ORIGINAL RUNTIME CAPTURE'
        if name == 'environment' and index == 1:
            kind = 'DESIGN REFERENCE'
        draw.text((10, 10), kind, font=font, fill='#e8edf6')
        source_class = 'Approved design reference (not runtime evidence)' if kind == 'DESIGN REFERENCE' else next(c['sourceClass'] for c in json.loads((OUT/'capture-record.json').read_text())['captures'] if c['name'] == Path(path).stem)
        if source_class == 'supplemental production-component fixture':
            source_class += ' / Chromium automation'
        draw.text((10, 30), source_class, font=font, fill='#97dce5')
        draw.text((10, 52), Path(path).name, font=font, fill='#a4b5ca')
        draw.text((10, 74), f'Original {original_size}; display {width}x{height}; nearest-neighbor display only', font=font, fill='#a4b5ca')
        panel.paste(displayed, (10, 102))
        panels.append(panel)
        sources.append({'path': path, 'sha256': sha(path), 'dimensions': list(original_size),
                        'classification': kind, 'sourceClass': source_class, 'crop': None, 'displayDimensions': [width, height],
                        'displayScaling': [width/original_size[0], height/original_size[1]], 'resampling': 'nearest'})
    columns = 2
    rows = [panels[i:i+columns] for i in range(0, len(panels), columns)]
    board = Image.new('RGB', (1560, 110+sum(max(p.height for p in row) for row in rows)), '#08121c')
    draw = ImageDraw.Draw(board)
    draw.text((10, 10), 'DERIVED COMPARISON - US-036 - '+name, font=font, fill='#97dce5')
    # Short lines remain readable without changing any source image pixels.
    import textwrap
    draw.multiline_text((10, 34), '\n'.join(textwrap.wrap(TRANSLATIONS[name], 145)), font=font, fill='#e8edf6', spacing=4)
    y = 110
    for row in rows:
        for x, panel in enumerate(row):
            board.paste(panel, (x*780, y))
        y += max(p.height for p in row)
    return board, sources


def assemble(check):
    sessions = {name: json.loads((OUT/(name+'-record.json')).read_text()) for name in ['fixture', 'simulator', 'unavailable', 'recovery']}
    baseline = json.loads((OUT/'f1-baseline-record.json').read_text())
    failure = json.loads((OUT/'reflow-failure-record.json').read_text())
    captures = baseline['captures'] + failure['captures'] + [c for session in sessions.values() for c in session['captures']]
    ac = {}
    for number in range(1, 21):
        key = f'AC-{number:02}'
        filters = {1: lambda c: 'production' in c['name'] or '-room' in c['name'], 2: lambda c: '-room' in c['name'],
                   5: lambda c: c['name'].endswith('-room'), 6: lambda c: '-flow-' in c['name'],
                   7: lambda c: '-resize-' in c['name'] or '-inspection' in c['name'],
                   9: lambda c: '-state-' in c['name'], 10: lambda c: '-sol-' in c['name'],
                   11: lambda c: '-freshness-' in c['name'] or '-recovery-' in c['name'] or '-unavailable-' in c['name'],
                   12: lambda c: '-reduced-' in c['name'], 14: lambda c: '-keyboard-' in c['name'] or '-resize-' in c['name'],
                   15: lambda c: '-preview-' in c['name'] or '-harbor-' in c['name'],
                   16: lambda c: '-return-' in c['name'], 17: lambda c: '-reload' in c['name']}
        observations = {3:'sourceSha256/sessionRecords',4:'captures.outer/contentBounds/viewport/dpr/zoom',
                        7:'fixture.reflow/persistentControls/breakpoints',8:'fixture.semantic',9:'motion-record.json',
                        12:'fixture.motion',13:'fixture.semantic',14:'fixture.keyboard/resize/persistentControls/nativeObservations',
                        16:'fixture.continuity',17:'fixture capture-tool explicit shutdown/remount/pagehide assertions',
                        18:'report final validation',19:'review PENDING',20:'captures.sourceClass/sessionRecords/nativeObservations'}
        evidence = [RUNTIME+c['name']+'.png' for c in captures if number in filters and filters[number](c)]
        if number in observations:
            evidence.append('Observation: '+observations[number])
        if number in [1,2]:
            evidence.extend(RUNTIME+'comparison-'+n+'.png' for n in (['environment'] if number==2 else ['desktop','compact','compact-flow','expanded','retained','keyboard']))
        ac[key] = {'status': 'PENDING REVIEW' if number == 19 else 'DEVELOPER VERIFIED', 'evidence': evidence}
    result = {'baseline': sessions['fixture']['baseline'], 'tree': sessions['fixture']['tree'],
              'branch': sessions['fixture']['branch'], 'captures': captures,
              'sourceSha256': sessions['fixture']['sourceSha256'], 'sessionRecords': [n+'-record.json' for n in sessions],
              'observations': {n: r['observations'] for n, r in sessions.items()}, 'ac': ac,
              'review': {'designer': 'PENDING', 'technical': 'PENDING', 'productOwnerImplementation': 'PENDING', 'finalization': 'NOT AUTHORIZED'},
              'nativeObservations': sessions['fixture']['nativeObservations'], 'liveMotionRecord': 'motion-record.json',
              'historicalReuse': 'Baseline/reflow diagnostic captures retain their original source/tool identity; earlier story evidence is supporting history, not fresh observations.'}
    path = OUT/'capture-record.json'
    if check:
        assert result == json.loads(path.read_text())
    else:
        path.write_text(json.dumps(result, indent=2)+'\n')


def run(check=False):
    assemble(check)
    fixture = json.loads((OUT/'fixture-record.json').read_text())
    flow = next(f for f in fixture['observations']['flow'] if f['mode']=='normal' and f['percent']==100)
    specs = {**SPECS, 'compact-flow': [REFERENCE+'ep06-fidelity-compact-flow.png', *[RUNTIME+s['name']+'.png' for s in flow['slices']]]}
    boards = []
    for name, paths in specs.items():
        board, sources = render(name, paths)
        filename = 'comparison-'+name+'.png'
        if check:
            with Image.open(OUT/filename) as existing:
                existing.load()
                assert existing.size == board.size and existing.convert('RGB').tobytes() == board.tobytes(), filename
        else:
            board.save(OUT/filename)
        boards.append({'name': 'comparison-'+name, 'sha256': sha(RUNTIME+filename), 'dimensions': list(board.size),
                       'sources': sources, 'purpose': name+' integrated fidelity', 'acceptedTranslations': TRANSLATIONS[name],
                       'findings': 'Designer/independent review PENDING; F1 correction measured separately'})
    manifest = {'boards': boards, 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'runtime': {'python': sys.version, 'pillow': __import__('PIL').__version__}, 'originalsModified': False, 'boardProvenance': 'Derived presentation only; never an original runtime capture'}
    if check:
        assert manifest == json.loads((OUT/'comparison-record.json').read_text())
    else:
        (OUT/'comparison-record.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print('PASS: seven comparison boards '+('reconstructed in memory' if check else 'generated with recorded source/display provenance'))


if __name__ == '__main__':
    run('--check' in sys.argv)
