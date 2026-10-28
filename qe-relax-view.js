/* D3: validated, view-only initial/final structures at one shared 3D scale. */
const HASH=/^[a-f0-9]{64}$/;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const cart=(f,cell)=>[0,1,2].map(j=>f.reduce((sum,x,i)=>sum+x*cell[i][j],0));

function structure(value){
 if(!value||value.periodic!==true||!Array.isArray(value.cell_angstrom)||value.cell_angstrom.length!==3||
  value.cell_angstrom.some(row=>!Array.isArray(row)||row.length!==3||row.some(x=>!finite(x)||Math.abs(x)>200)))
  throw Error('Relaksasyon hücresi geçersiz.');
 const [a,b,c]=value.cell_angstrom;
 const volume=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
 if(Math.abs(volume)<1||!Array.isArray(value.atoms)||!value.atoms.length||value.atoms.length>64)
  throw Error('Relaksasyon atom sayısı veya hücre hacmi geçersiz.');
 const atoms=value.atoms.map(atom=>{
  if(!atom||!/^(H|C|N|O|Si|S|Mo)$/.test(atom.element)||!Array.isArray(atom.fractional)||
   atom.fractional.length!==3||atom.fractional.some(x=>!finite(x)||x<0||x>=1))
   throw Error('Relaksasyon atom koordinatları geçersiz.');
  return {element:atom.element,fractional:[...atom.fractional]};
 });
 return {periodic:true,cell_angstrom:value.cell_angstrom.map(row=>[...row]),atoms};
}

export function parseRelaxationResult(data,expectedSourceHash){
 if(!data||data.schema!=='kristalyapi.qe-relax-scf-result.v1'||!HASH.test(expectedSourceHash)||
  data.structure_hash!==expectedSourceHash||!HASH.test(data.final_structure_hash)||
  data.engine!=='quantum-espresso'||data.scf_converged!==true||data.geometry_converged!==true||data.job_done!==true)
  throw Error('Relaksasyon sonucu kaynak yapıyla veya yakınsama kaydıyla uyuşmuyor.');
 const before=structure(data.initial_structure),after=structure(data.final_structure);
 if(before.atoms.length!==after.atoms.length||before.cell_angstrom.some((r,i)=>r.some((x,j)=>Math.abs(x-after.cell_angstrom[i][j])>1e-10))||
  before.atoms.some((a,i)=>a.element!==after.atoms[i].element))
  throw Error('Sabit hücre veya atom sırası değişmiş.');
 const r=data.stages?.relax,s=data.stages?.scf,threshold=data.relaxation_settings?.force_threshold_ry_bohr;
 if(!finite(threshold)||threshold<1e-5||threshold>5e-3||r?.geometry_converged!==true||
  r.has_final_coordinates!==true||s?.structure_hash!==data.final_structure_hash||
  ![r,s].every(p=>p?.job_done===true&&p.scf_converged===true&&finite(p.last_scf_accuracy_ry)&&
   p.last_scf_accuracy_ry>=0&&p.last_scf_accuracy_ry<=1e-8&&finite(p.max_force_component_ry_bohr)&&
   p.max_force_component_ry_bohr>=0&&p.max_force_component_ry_bohr<=threshold+1e-8)||
  !finite(data.energy_ry)||!finite(data.energy_ev)||Math.abs(data.energy_ry*13.605693122994-data.energy_ev)>1e-7)
  throw Error('İki aşamanın enerji/kuvvet yakınsama kanıtı eksik veya geçersiz.');
 const rows=before.atoms.map((a,i)=>{
  const b=after.atoms[i],wrapped=b.fractional.map((x,j)=>{const d=x-a.fractional[j];return d-Math.round(d);});
  const delta=cart(wrapped,before.cell_angstrom);
  return {index:i+1,element:a.element,before:a.fractional,after:b.fractional,
   deltaAngstrom:Math.hypot(...delta)};
 });
 return {before,after,rows,sourceHash:data.structure_hash,finalHash:data.final_structure_hash,
  energyEv:data.energy_ev,maxForceComponent:s.max_force_component_ry_bohr,threshold};
}

function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}

export function renderRelaxationComparison(container,result,{THREE,OrbitControls}){
 container.replaceChildren();
 const heading=node('strong','Başlangıç / son yapı · 3B karşılaştırma');container.append(heading);
 container.append(node('p','Ortak ölçek · sürükleyerek döndürün, tekerlekle yakınlaştırın. Konumlar Å birimindedir; aktif yapı değiştirilmez.'));
 const grid=node('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px';
 container.append(grid);
 const points=[result.before,result.after].flatMap(s=>s.atoms.map(a=>new THREE.Vector3(...cart(a.fractional,s.cell_angstrom))));
 const box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3());
 const distance=Math.max(box.getSize(new THREE.Vector3()).length()*1.6,4);
 const colors={H:0xe7edf5,C:0x8993a4,N:0x5289ff,O:0xef6358,Si:0xe4af80,S:0xf3d353,Mo:0x9c87e9};
 const views=[];
 for(const [index,s] of [result.before,result.after].entries()){
  const panel=node('div');panel.append(node('h4',index?'Son SCF yapısı':'Başlangıç'));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101827);
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,-3,5);scene.add(light);
  for(const atom of s.atoms){
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(atom.element==='Mo' ? .3 : .23,24,16),
    new THREE.MeshStandardMaterial({color:colors[atom.element],roughness:.5}));
   mesh.position.set(...cart(atom.fractional,s.cell_angstrom)).sub(center);scene.add(mesh);
  }
  const axes=new THREE.AxesHelper(1);axes.position.copy(box.min.clone().sub(center).addScalar(-.5));scene.add(axes);
  const camera=new THREE.PerspectiveCamera(35,1,.01,1000);camera.up.set(0,0,1);
  camera.position.copy(new THREE.Vector3(1.7,-2.1,1.2).normalize().multiplyScalar(distance));
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));
  renderer.domElement.style.cssText='width:100%;height:220px;display:block;border-radius:8px';
  renderer.domElement.setAttribute('aria-label',index?'Son atom konumları, 3B':'Başlangıç atom konumları, 3B');
  panel.append(renderer.domElement);grid.append(panel);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.update();
  views.push({panel,scene,camera,renderer,controls});
 }
 let syncing=false,disposed=false;
 const draw=()=>{if(!disposed)for(const v of views)v.renderer.render(v.scene,v.camera);};
 for(const v of views)v.controls.addEventListener('change',()=>{
  if(syncing||disposed)return;syncing=true;
  for(const other of views)if(other!==v){
   other.camera.position.copy(v.camera.position);other.camera.quaternion.copy(v.camera.quaternion);
   other.controls.target.copy(v.controls.target);other.controls.update();
  }
  draw();syncing=false;
 });
 const resize=()=>{if(disposed)return;for(const v of views){const w=Math.max(v.panel.clientWidth,180);
  v.camera.aspect=w/220;v.camera.updateProjectionMatrix();v.renderer.setSize(w,220,false);}draw();};
 const observer=new ResizeObserver(resize);observer.observe(grid);resize();
 const summary=node('p','Son en büyük kuvvet bileşeni: '+result.maxForceComponent.toExponential(3)+
  ' Ry/Bohr · sınır '+result.threshold.toExponential(3)+' Ry/Bohr.');container.append(summary);
 const table=node('table');table.style.cssText='width:100%;font-size:11px';
 const head=node('tr');for(const label of ['Atom','Başlangıç (kesirli)','Son (kesirli)','Sarılmış fark (Å)'])head.append(node('th',label));
 table.append(head);
 for(const row of result.rows){const tr=node('tr');
  for(const text of [row.index+' · '+row.element,row.before.map(x=>x.toFixed(5)).join(', '),
   row.after.map(x=>x.toFixed(5)).join(', '),row.deltaAngstrom.toFixed(6)])tr.append(node('td',text));
  table.append(tr);
 }
 const scroll=node('div');scroll.style.overflowX='auto';scroll.append(table);container.append(scroll);
 return ()=>{disposed=true;observer.disconnect();for(const v of views){v.controls.dispose();
  v.scene.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});
  v.renderer.dispose();v.renderer.forceContextLoss();v.renderer.domElement.remove();}};
}
