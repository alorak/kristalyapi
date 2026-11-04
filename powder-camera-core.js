/* Debye–Scherrer film geometry derived from the active XRD powder groups.
 * This module does not generate synthetic peaks or replace the crystallographic
 * structure-factor engine in crystal-app.js. Arc positions are idealized. */
export const CAMERA_RADIATION = Object.freeze({
  Cu:{alpha:1.5418,beta:1.39217,filter:'Ni'},
  Co:{alpha:1.7902,beta:1.62073,filter:'Fe'},
  Mo:{alpha:0.7107,beta:0.63225,filter:'Zr'},
  Cr:{alpha:2.2909,beta:2.08479,filter:'V'},
  Fe:{alpha:1.9373,beta:1.75654,filter:'Mn'}
});
export const CAMERA_DIAMETERS=Object.freeze([57.3,114.6]);

export function cameraArcDistance(twoThetaDeg,diameterMm){
  if(!Number.isFinite(twoThetaDeg)||twoThetaDeg<=0||twoThetaDeg>=180||
    !Number.isFinite(diameterMm)||diameterMm<=0)throw new RangeError('Invalid camera angle or diameter');
  return diameterMm*Math.PI*twoThetaDeg/360;
}
export function cameraFromPattern(pattern,diameterMm){
  if(!pattern||!Array.isArray(pattern.groups)||!CAMERA_DIAMETERS.includes(diameterMm))
    throw new TypeError('Expected powder pattern groups and supported camera diameter');
  return pattern.groups.filter(g=>Number.isFinite(g.angle)&&g.angle>0&&g.angle<180&&
    Number.isFinite(g.d)&&g.d>0&&Number.isFinite(g.relative)&&g.relative>0)
   .map(g=>{
    const arcMm=cameraArcDistance(g.angle,diameterMm);
    return {
      hkl:Array.isArray(g.hkl)?g.hkl.slice(0,3):[],
      twoThetaDeg:g.angle,d:g.d,arcMm,
      positionsMm:[-arcMm,arcMm],
      relative:g.relative,
      members:g.members||1
    };
   }).sort((a,b)=>a.twoThetaDeg-b.twoThetaDeg);
}
export function cameraFilmScale(diameterMm){
  if(!CAMERA_DIAMETERS.includes(diameterMm))throw new RangeError('Unsupported camera diameter');
  return {radiusMm:diameterMm/2,mmPerDegree:diameterMm*Math.PI/360,halfFilmMm:diameterMm*Math.PI/2};
}
export function cameraReflectionLabel(hkl){
  if(!Array.isArray(hkl)||hkl.length!==3||!hkl.every(Number.isInteger))return '(?)';
  return '('+hkl.map(String).join(' ')+')';
}
