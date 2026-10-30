/* Frozen evidence-backed reference requests; never start a calculation automatically. */
const templates=[
  {
    "id": "si-functional",
    "label": "Si · işlev sınaması",
    "acceptance": "functional-only",
    "scope": "Gerçek Docker/API işleyişi ve sonuç biçimleri denetlendi; sayısal/fiziksel yakınsama kabulü yok.",
    "request": {
      "schema": "kristalyapi.qe-electronic-job.v1",
      "profile_id": "si-pbe",
      "structure": {
        "periodic": true,
        "cell_angstrom": [
          [
            0.0,
            2.7155,
            2.7155
          ],
          [
            2.7155,
            0.0,
            2.7155
          ],
          [
            2.7155,
            2.7155,
            0.0
          ]
        ],
        "atoms": [
          {
            "element": "Si",
            "fractional": [
              0.0050041477,
              0.999995228,
              0.999995228
            ]
          },
          {
            "element": "Si",
            "fractional": [
              0.2549958523,
              0.250004772,
              0.250004772
            ]
          }
        ]
      },
      "parameters": {
        "calculation": "electronic",
        "functional": "PBE",
        "spin": "unpolarized",
        "ecutwfc_ry": 45,
        "ecutrho_ry": 360,
        "kpoints": [
          2,
          2,
          1
        ]
      },
      "electronic": {
        "nbnd": 8,
        "nscf_k": 2,
        "band_path": [
          {
            "label": "Gamma",
            "k": [
              0,
              0,
              0
            ],
            "segments": 3
          },
          {
            "label": "X",
            "k": [
              0.5,
              0,
              0
            ],
            "segments": 1
          }
        ],
        "dos": {
          "delta_e_ev": 0.01,
          "degauss_ry": 0.005,
          "energy_min_ev": -4,
          "energy_max_ev": 10
        }
      }
    },
    "request_path": "validation-results/qe-pause-resume-si-20261029-arm64/request.json",
    "request_sha256": "9b596a7cc3e9ffb17debb0879e05fe4b453f0ae507d7ee9a340ceedad7f2d4d5",
    "structure_hash": "75f7028a918ecf62e27d81d1b6c098ef3d334ed0052746e1fd9adf1c8c8754f3",
    "pseudopotentials": {
      "Si": {
        "file": "Si.UPF",
        "sha256": "669fb75395a9d26973b0ea1ce8223bbcb30d3396c5d48bf5e794d1243c52375a",
        "source": "https://pseudopotentials.quantum-espresso.org/upf_files/Si.pbe-n-rrkjus_psl.1.0.0.UPF",
        "license": "GPL-2.0-or-later",
        "functional": "PBE"
      }
    },
    "engine_version": "6.7MaX",
    "source_commit": "65f5d221df01e91e847d2b98ee8af63006d50046",
    "evidence_commit": "68f0975fbd0f5354bcc792dd7b960f4391e28dd0"
  },
  {
    "id": "mos2-d41",
    "label": "MoS₂ · D4.1 sonlu kabul",
    "acceptance": "finite-band-mesh",
    "scope": "Sabit D3 geometrisi/PBE/skaler/spinsiz protokolde bant sayısı ve NSCF örgüsü için sonlu kabul; DOS genişliği yalnız duyarlılık.",
    "request": {
      "profile_id": "mos2-pbe",
      "parameters": {
        "calculation": "electronic",
        "functional": "PBE",
        "spin": "unpolarized",
        "ecutwfc_ry": 120,
        "ecutrho_ry": 960,
        "kpoints": [
          16,
          16,
          1
        ]
      },
      "schema": "kristalyapi.qe-electronic-job.v1",
      "structure": {
        "periodic": true,
        "cell_angstrom": [
          [
            3.18,
            0.0,
            0.0
          ],
          [
            -1.59,
            2.753960784034515,
            0.0
          ],
          [
            0.0,
            0.0,
            24.0
          ]
        ],
        "atoms": [
          {
            "element": "Mo",
            "fractional": [
              0.0,
              0.0,
              0.5
            ]
          },
          {
            "element": "S",
            "fractional": [
              0.3333333333,
              0.6666666667,
              0.5652426103
            ]
          },
          {
            "element": "S",
            "fractional": [
              0.3333333333,
              0.6666666667,
              0.4347573897
            ]
          }
        ]
      },
      "electronic": {
        "nbnd": 40,
        "nscf_k": 24,
        "band_path": [
          {
            "label": "Gamma",
            "k": [
              0,
              0,
              0
            ],
            "segments": 20
          },
          {
            "label": "M",
            "k": [
              0.5,
              0,
              0
            ],
            "segments": 20
          },
          {
            "label": "K",
            "k": [
              0.3333333333333333,
              0.3333333333333333,
              0
            ],
            "segments": 20
          },
          {
            "label": "Gamma",
            "k": [
              0,
              0,
              0
            ],
            "segments": 1
          }
        ],
        "dos": {
          "delta_e_ev": 0.01,
          "degauss_ry": 0.01,
          "energy_min_ev": -8.0,
          "energy_max_ev": 6.0
        }
      }
    },
    "request_path": "validation-results/qe-mos2-d41-20261030-amd64/case-bundles/nbnd40-k24-s010/cases/nbnd40-k24-s010/request.json",
    "request_sha256": "191ef4d1daedb24d2e8e5590976026f45d9775db0baf9124bc45b9f50807c75e",
    "structure_hash": "daeab818c9cee40c63f1fbb58688c2ee3aac0d5ab13363147c07061e32f62063",
    "pseudopotentials": {
      "Mo": {
        "file": "Mo.UPF",
        "sha256": "0d7c57996e624698242e6428a34d5f13a1e52b4cddac2ce215be4dce429073dd",
        "source": "https://pseudopotentials.quantum-espresso.org/upf_files/Mo.pbe-spn-rrkjus_psl.1.0.0.UPF",
        "license": "GPL-2.0-or-later; https://github.com/dalcorso/pslibrary#license",
        "functional": "PBE"
      },
      "S": {
        "file": "S.UPF",
        "sha256": "90fb585e830674f2de7b4cbace28d5dd0c05ca1a919d1f92a59b54d6b95cbfc4",
        "source": "https://pseudopotentials.quantum-espresso.org/upf_files/S.pbe-n-rrkjus_psl.1.0.0.UPF",
        "license": "GPL-2.0-or-later; https://github.com/dalcorso/pslibrary#license",
        "functional": "PBE"
      }
    },
    "engine_version": "6.7MaX",
    "source_commit": "64530c73ae34112a1575c66002f3b1434037c2e5",
    "evidence_commit": "9015319a558a5c6ea72576ed6cbb4459880fe9c5"
  }
];
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const protocolTemplates=freeze(templates);
export function protocolById(id){const value=protocolTemplates.find(p=>p.id===id);if(!value)throw Error('Bilinmeyen hesap protokolü.');return value;}
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export function protocolRequestMatches(protocol,payload){
 if(!payload)return false;
 const normalized=raw=>{const value=structuredClone(raw);delete value.profile_id;return JSON.stringify(stable(value));};
 return normalized(protocol.request)===normalized(payload);
}
export function protocolPreflightMatches(protocol,payload,response){
 const expected=Object.fromEntries(Object.entries(protocol.pseudopotentials).map(([el,value])=>[el,value.sha256]));
 return protocolRequestMatches(protocol,payload)&&response?.valid===true&&response.structure_hash===protocol.structure_hash&&
  JSON.stringify(stable(response.upf_sha256))===JSON.stringify(stable(expected));
}
