import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('V15 visual evidence audit: source pins, PNG metrics and fail-closed proof handling',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_vesta_15_visual.py','-v'],
  {encoding:'utf8',timeout:45000});
 assert.equal(result.status,0,
  'V15 Python visual evidence unit tests failed:\n'+result.stdout+'\n'+result.stderr);
 assert.match(result.stderr,/Ran 11 tests/);
 const capture=spawnSync('python3',['-m','unittest','discover','-s','tests','-p','test_vesta_15_capture.py','-v'],
  {encoding:'utf8',timeout:45000});
 assert.equal(capture.status,0,
  'V15.1 operator capture tests failed:\\n'+capture.stdout+'\\n'+capture.stderr);
 assert.match(capture.stderr,/Ran 7 tests/);
});
