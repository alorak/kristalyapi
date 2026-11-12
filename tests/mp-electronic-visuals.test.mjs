import test from 'node:test';
import assert from 'node:assert/strict';
import {mpVisibleEnergyWindow,mpCumulativeDos,mpVisibleDensityMax} from '../mp-electronic-visuals.js';
const sample={band:{efermi:4,spins:{up:[[1,3,4,5,7]]}},
 dos:{efermi:4,energy:[1,2,3,4,5],spins:{up:[0,1,2,1,0]}}};
test('MP shared viewport uses separate Fermi zeros and contains E_F=0',()=>{
 assert.deepEqual(mpVisibleEnergyWindow(sample,'near'),[-3,3]);
 assert.deepEqual(mpVisibleEnergyWindow(sample,'standard'),[-6,6]);
 const [min,max]=mpVisibleEnergyWindow(sample,'full');
 assert.ok(min< -3&&max>3);
 assert.ok(min<0&&max>0);
 assert.throws(()=>mpVisibleEnergyWindow(sample,'bad'),/viewport/);
});
test('cumulative DOS trapezoid integral is nondecreasing with actual sample spacings',()=>{
 const integral=mpCumulativeDos([0,1,3,4],[1,2,2,1]);
 assert.deepEqual(integral,[0,1.5,5.5,7]);
 assert.ok(integral.every((v,i)=>i===0||v>=integral[i-1]));
 assert.throws(()=>mpCumulativeDos([0,0],[1,2]),/geçersiz/);
 assert.throws(()=>mpCumulativeDos([0,1],[1,-1]),/geçersiz/);
});
test('DOS horizontal scale uses visible density only; no fake nonzero DOS peak',()=>{
 const x=[-20,-2,0,2,20],y=[900,0,4,8,999];
 assert.equal(mpVisibleDensityMax(x,y,[-3,3]),8*1.07);
 assert.equal(mpVisibleDensityMax(x,[0,0,0,0,0],[-3,3]),1);
});
