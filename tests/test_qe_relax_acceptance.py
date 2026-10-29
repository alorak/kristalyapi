"""D3 acceptance rejection tests; all generated values here are synthetic."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"tools"),str(ROOT/"server")]
import qe_relax_acceptance as d3
import qe_mos2_acceptance as mos2
from job_core import make_pw_input
from relax_core import make_relax_input,checked_relaxation,checked_scf


class RelaxAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.plan=d3.load_plan()
        p=mos2.load_plan('d22c');self.initial=mos2.make_request(p,p['cases'][2])
        self.original_result={'energy_ry':-10.0}
        self.request=d3.make_relax_request(self.plan,self.initial)
        self.final=copy.deepcopy(self.initial['structure']);self.final['atoms'][1]['fractional'][2]+=.0001
        self.upf={el:{'file':el+'.UPF','sha256':meta['reviewed_sha256']} for el,meta in self.plan['pseudopotentials'].items()}
        self.relax_dir=self.root/'cases/relax-scf';self.relax_dir.mkdir(parents=True)
        self.high_dir=self.root/'cases/high-cutoff-scf';self.high_dir.mkdir()
        self.final_request=copy.deepcopy(self.initial);self.final_request['structure']=self.final
        self.high_request=copy.deepcopy(self.final_request);self.high_request['parameters'].update(self.plan['final_check'])
        text=self.output(-10.01,True)
        (self.relax_dir/'relax.in').write_text(make_relax_input(self.request,self.upf))
        (self.relax_dir/'relax.out').write_text(text);(self.relax_dir/'relax.stderr').write_text('')
        (self.relax_dir/'structure.in').write_text(make_pw_input(self.final_request,self.upf))
        (self.relax_dir/'structure.out').write_text(self.output(-10.01));(self.relax_dir/'structure.stderr').write_text('')
        _,r=checked_relaxation(self.request,text,0)
        s=checked_scf(self.output(-10.01),0,{**self.request,'structure':self.final})
        result=self.result(self.request,'1'*32,-10.01)
        result.update(schema='kristalyapi.qe-relax-scf-result.v1',geometry_converged=True,
            initial_structure=self.initial['structure'],final_structure=self.final,
            final_structure_hash=mos2.structure_hash(self.final),stages={'relax':r,'scf':{**s,'structure_hash':mos2.structure_hash(self.final)}},
            artifact_sha256={n:d3.sha((self.relax_dir/n).read_bytes()) for n in ['relax.in','relax.out','relax.stderr','structure.in','structure.out','structure.stderr']},
            input_sha256=d3.sha((self.relax_dir/'structure.in').read_bytes()),output_sha256=d3.sha((self.relax_dir/'structure.out').read_bytes()))
        self.save(self.relax_dir,self.request,result)
        (self.high_dir/'structure.in').write_text(make_pw_input(self.high_request,self.upf))
        (self.high_dir/'structure.out').write_text(self.output(-10.01005))
        high=self.result(self.high_request,'2'*32,-10.01005)
        high.update(input_sha256=d3.sha((self.high_dir/'structure.in').read_bytes()),output_sha256=d3.sha((self.high_dir/'structure.out').read_bytes()))
        self.save(self.high_dir,self.high_request,high)

    def output(self,energy,relax=False):
        text='Program PWSCF v.6.7MaX\nnumber of electrons = 26.0\n'
        if relax:text+=f'! total energy = {energy+.0000005:.8f} Ry\n'
        text+=f'convergence has been achieved in 5 iterations\n! total energy = {energy:.8f} Ry\nestimated scf accuracy < 1.0e-9 Ry\n'
        text+='Forces acting on atoms (cartesian axes, Ry/au):\n'
        text+='atom 1 type 1 force = 0 0 0\natom 2 type 2 force = 0 0 0\natom 3 type 2 force = 0 0 0\n'
        text+='The non-local contrib. to forces\natom 1 type 1 force = 3 3 3\nTotal force = 0\n'
        if relax:
            text+='bfgs converged in 2 scf cycles and 1 bfgs steps\nBegin final coordinates\nATOMIC_POSITIONS (crystal)\n'
            text+='\n'.join(a['element']+' '+' '.join(str(x) for x in a['fractional']) for a in self.final['atoms'])
            text+='\nEnd final coordinates\n'
        return text+'JOB DONE.\n'

    def result(self,request,jid,energy):
        return {'job_id':jid,'structure_hash':mos2.structure_hash(request['structure']),
                'engine':'quantum-espresso','engine_version':'6.7MaX','scf_converged':True,'job_done':True,
                'energy_ry':energy,'energy_ev':energy*d3.RY_TO_EV,'pseudopotentials':self.upf}

    def save(self,path,request,result):
        digest=result['structure_hash'];jid=result['job_id']
        trace={'validation':{'valid':True,'structure_hash':digest},
               'submitted':{'status':'queued','job_id':jid,'structure_hash':digest},
               'terminal':{'status':'completed','job_id':jid,'structure_hash':digest},
               'staged_upf_sha256':{el:m['sha256'] for el,m in self.upf.items()}}
        for name,value in [('request.json',request),('result.json',result),('api.json',trace)]:
            (path/name).write_text(json.dumps(value))

    def derive(self):return d3.derive(self.root,self.plan,self.initial,self.original_result)

    def test_complete_raw_evidence_passes_without_counting_force_contributions(self):
        result=self.derive()
        self.assertTrue(all(g['passed'] for g in result['gates']))
        self.assertEqual(result['final_scf']['max_force_component_ry_bohr'],0)
        self.assertAlmostEqual(result['displacements_angstrom'][1],.0024)

    def test_raw_high_cutoff_force_failure_cannot_pass(self):
        p=self.high_dir/'structure.out';p.write_text(p.read_text().replace('atom 2 type 2 force = 0 0 0','atom 2 type 2 force = 0 0 0.001'))
        r=json.loads((self.high_dir/'result.json').read_text());r['output_sha256']=d3.sha(p.read_bytes());(self.high_dir/'result.json').write_text(json.dumps(r))
        result=self.derive();self.assertFalse(next(g for g in result['gates'] if g['axis']=='high_cutoff_force')['passed'])

    def test_api_force_or_raw_hash_tampering_is_rejected(self):
        p=self.relax_dir/'result.json';r=json.loads(p.read_text());r['stages']['scf']['forces_ry_bohr'][0][2]=.00001;p.write_text(json.dumps(r))
        with self.assertRaisesRegex(ValueError,'atomic forces'):self.derive()
        r['stages']['scf']['forces_ry_bohr'][0][2]=0;p.write_text(json.dumps(r))
        (self.relax_dir/'relax.out').write_text((self.relax_dir/'relax.out').read_text()+'changed\n')
        with self.assertRaisesRegex(ValueError,'artifact hash'):self.derive()

    def test_failed_reference_prevents_runtime_creation_and_job_submission(self):
        with patch.object(d3,'reference',side_effect=ValueError('reference gate failed')),patch.object(d3,'Runtime') as runtime:
            with self.assertRaisesRegex(ValueError,'reference gate failed'):d3.run(self.root/'not-created')
            runtime.assert_not_called()
        self.assertFalse((self.root/'not-created').exists())

    def test_incomplete_geometry_or_wrong_kmesh_is_rejected(self):
        p=self.relax_dir/'relax.out';p.write_text(p.read_text().replace('End final coordinates','incomplete'))
        with self.assertRaisesRegex(ValueError,'geometry'):self.derive()
        self.assertFalse(d3.same_structure(self.final,{**self.final,'cell_angstrom':self.final['cell_angstrom'][:2]}))


if __name__=='__main__':unittest.main()
