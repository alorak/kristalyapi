/* P1 offline bulk-study planning only. The current QE electronic API is
 * slab-specific (kz=0 paths; NSCF kz=1). This module NEVER submits a DFT job
 * or claims an accepted k-path, pseudopotential or converged physical result. */
import {materialCard} from './material-cards-core.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const targets={GaN:{Ga:1,N:1},AlN:{Al:1,N:1},SiC:{Si:1,C:1}};
function latticeVectors(cell){
 const [al,be,ga]=['alpha','beta','gamma'].map(k=>cell[k]*Math.PI/180);
 const ca=Math.cos(al),cb=Math.cos(be),cg=Math.cos(ga),sg=Math.sin(ga);
 const x=cell.c*cb,y=cell.c*(ca-cb*cg)/sg;
 const z2=cell.c**2-x*x-y*y;
 if(!finite(z2)||z2<=0)throw Error('Invalid three-dimensional lattice metric.');
 return [[cell.a,0,0],[cell.b*cg,cell.b*sg,0],[x,y,Math.sqrt(z2)]];
}
export function bulkStudyPreparation(structure,{material,kmesh=[8,8,8],smearing='fixed'}={}){
 if(!(material in targets))throw Error('Choose GaN, AlN or SiC.');
 const card=materialCard(structure);
 if(!Array.isArray(kmesh)||kmesh.length!==3||
   kmesh.some(k=>!Number.isInteger(k)||k<2||k>64))
  throw Error('A 3D k-mesh requires three integers in [2, 64].');
 if(!['fixed','needs-expert-review'].includes(smearing))
  throw Error('Unrecognized occupations plan.');
 const expected=targets[material],actual=card.composition;
 const elements=Object.keys(actual);
 const stoichiometric=elements.length===2&&Object.keys(expected).every(k=>k in actual)&&
  Math.abs(actual[Object.keys(expected)[0]]/actual[Object.keys(expected)[1]]-1)<1e-8;
 const basis=latticeVectors(card.cell);
 const warnings=[
  'This is a non-executable planning manifest. The current QE electronic server accepts slab-only kz=0 bands and kz=1 NSCF meshes.',
  'No 3D high-symmetry band path, pseudopotential hashes, occupations or convergence criteria have been validated.',
  'Material label does not prove polytype (e.g. 3C/4H/6H SiC), space group or experimentally stable phase.',
  'Electronic bandgap and RF/transport/thermal properties are NOT inferred from cell geometry.'
 ];
 if(card.partialOccupancy)warnings.push('Partial occupancies require an explicit physically valid supercell/disorder model.');
 if(!stoichiometric)warnings.push('Selected material and current P1 composition do not agree as a 1:1 binary.');
 return {schema:'kristalyapi.bulk-study-plan.v1',material,proposedMesh:kmesh,
  crystal:{name:card.name,formula:card.formula,cell:card.cell,siteCount:card.siteCount,
   symmetry:card.symmetry,latticeVectorsAngstrom:basis},
  checks:{stoichiometric,fullOccupancy:!card.partialOccupancy,meshThreeDimensional:true,
   existingApiSupports3DBulk:false,upfIdentityVerified:false,convergenceVerified:false},
  occupationPlan:smearing,executable:false,scientificallyAccepted:false,warnings,
  requiredNextSteps:['Independent structure/polytype reference and space-group validation',
   'Bulk-capable QE worker and server with unrestricted 3D k paths and NSCF mesh',
   'UPF identities and cutoffs; consistent reference cell and exchange-correlation functional',
   'k-grid/ecut/cell relaxation and (where appropriate) SOC/spin convergence with archived raw evidence',
   'Independent reference or experiment comparison and uncertainty statement']};
}
