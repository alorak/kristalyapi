#!/usr/bin/env python3
"""Package 7.5: combine scientific and visual outcomes without hiding uncertainty."""
import argparse
import json
from pathlib import Path

def combine(scientific,visual):
    counts=scientific.get('counts',{})
    unexpected=scientific.get('gate',{}).get('unexpected',[])
    missing=[key for key in ('pass','fail','inconclusive','error') if counts.get(key,0)<0]
    if missing:
        raise ValueError('Negative result counts')
    if sum(counts.values())!=scientific.get('count'):
        raise ValueError('Scientific fixture count mismatch')
    return {
        'scientific':{'counts':{k:counts.get(k,0) for k in ('pass','fail','inconclusive','error')},
                      'unexpected':unexpected,
                      'status':'fail' if unexpected or counts.get('fail',0) or counts.get('error',0) else
                               'inconclusive' if counts.get('inconclusive',0) else 'pass'},
        'visual':{'status':visual.get('status') if isinstance(visual,dict) and visual.get('status') in ('pass','fail','inconclusive','not_run') else
                     'inconclusive' if visual is not None else 'not_run',
                  'metrics':visual},
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--scientific',required=True)
    parser.add_argument('--visual')
    parser.add_argument('--out',required=True)
    args=parser.parse_args()
    scientific=json.loads(Path(args.scientific).read_text())
    visual=json.loads(Path(args.visual).read_text()) if args.visual and Path(args.visual).is_file() else None
    report=combine(scientific,visual)
    Path(args.out).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return 1 if report['scientific']['status']=='fail' or report['visual']['status']=='fail' else 0

if __name__=='__main__':
    raise SystemExit(main())
