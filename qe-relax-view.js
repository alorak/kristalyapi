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
 let ionicHistory=null;
 if(data.ionic_history!==undefined){
  const history=data.ionic_history,steps=history?.steps;
  if(history?.schema!=='kristalyapi.qe-ionic-history.v1'||history.source!=='relax.out'||
    !HASH.test(history.stdout_sha256)||history.stdout_sha256!==data.artifact_sha256?.['relax.out']||
    !Array.isArray(steps)||steps.length<1||steps.length>60||
    !Number.isInteger(data.relaxation_settings?.max_steps)||
    steps.length>data.relaxation_settings.max_steps||
    steps.some((p,i)=>p?.step!==i+1||!finite(p.energy_ry)||
      !finite(p.total_force_ry_bohr)||p.total_force_ry_bohr<0)||
    !finite(r.energy_ry)||!finite(r.total_force_ry_bohr)||
    Math.abs(steps.at(-1).energy_ry-r.energy_ry)>1e-8||
    Math.abs(steps.at(-1).total_force_ry_bohr-r.total_force_ry_bohr)>1e-8)
    throw Error('İyonik adım geçmişi ham relaksasyon kanıtıyla uyuşmuyor.');
  ionicHistory={steps:steps.map(p=>({...p})),stdoutHash:history.stdout_sha256};
 }
 const rows=before.atoms.map((a,i)=>{
  const b=after.atoms[i],wrapped=b.fractional.map((x,j)=>{const d=x-a.fractional[j];return d-Math.round(d);});
  const delta=cart(wrapped,before.cell_angstrom);
  return {index:i+1,element:a.element,before:a.fractional,after:b.fractional,
   alignedAfterFractional:a.fractional.map((x,j)=>x+wrapped[j]),deltaAngstrom:Math.hypot(...delta)};
 });
 return {before,after,rows,sourceHash:data.structure_hash,finalHash:data.final_structure_hash,
  energyEv:data.energy_ev,maxForceComponent:s.max_force_component_ry_bohr,threshold,ionicHistory};
}

function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
const SVG_NS='http://www.w3.org/2000/svg';
function ionicChart(label,steps,key,unit){
 const svg=document.createElementNS(SVG_NS,'svg');
 svg.setAttribute('viewBox','0 0 650 190');svg.setAttribute('role','img');
 svg.setAttribute('aria-label',label+' · iyonik adım');
 svg.setAttribute('data-ionic-points',String(steps.length));
 const add=(tag,attrs={},value)=>{
  const item=document.createElementNS(SVG_NS,tag);
  for(const [k,v] of Object.entries(attrs))item.setAttribute(k,String(v));
  if(value!==undefined)item.textContent=String(value);
  svg.append(item);return item;
 };
 const values=steps.map(p=>p[key]),left=72,right=20,top=16,bottom=43,w=650-left-right,h=190-top-bottom;
 const low=Math.min(...values),high=Math.max(...values),delta=high-low||Math.max(Math.abs(high)*.01,1e-6);
 const y0=low-delta*.08,y1=high+delta*.08;
 const x=i=>left+(steps.length===1?.5:i/(steps.length-1))*w;
 const y=v=>top+(y1-v)/(y1-y0)*h;
 for(let j=0;j<=3;j++){
  const py=top+j*h/3;
  add('line',{x1:left,y1:py,x2:left+w,y2:py,stroke:'#bdd0df','stroke-width':.75});
  add('text',{x:left-7,y:py+4,'text-anchor':'end','font-size':11,fill:'#45657f'},(y1-(y1-y0)*j/3).toPrecision(5));
 }
 const points=values.map((v,i)=>x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
 add('polyline',{points,fill:'none',stroke:'#2877b4','stroke-width':2,'vector-effect':'non-scaling-stroke'});
 values.forEach((v,i)=>add('circle',{cx:x(i),cy:y(v),r:3,fill:'#2877b4'}));
 add('text',{x:left,y:190-24,'font-size':11,fill:'#45657f'},'1');
 add('text',{x:left+w,y:190-24,'text-anchor':'end','font-size':11,fill:'#45657f'},String(steps.length));
 add('text',{x:325,y:185,'text-anchor':'middle','font-size':12,fill:'#365873'},'İyonik adım');
 const title=node('strong',label+' ('+unit+')');
 const box=node('section');box.className='qe-ionic-plot';box.append(title,svg);
 return box;
}

export function renderRelaxationComparison(container,result,{THREE,OrbitControls}){
 container.replaceChildren();
 const heading=node('strong','Başlangıç / son yapı · 3B karşılaştırma');container.append(heading);
 container.append(node('p','Ortak ölçek · sürükleyerek döndürün, tekerlekle yakınlaştırın. Son atomlar başlangıçla periyodik olarak eşlenir. Konumlar Å birimindedir; aktif yapı değiştirilmez.'));
 const controls=node('div');controls.className='qe-relax-controls';
 const displacementToggle=node('input');displacementToggle.type='checkbox';displacementToggle.setAttribute('aria-label','Yer değiştirme vektörlerini göster');
 const overlayLabel=node('label');overlayLabel.append(displacementToggle,node('span','Son yapıda hareket vektörlerini göster'));
 controls.append(overlayLabel);container.append(controls);
 const grid=node('div');grid.className='qe-relax-grid';
 container.append(grid);
 const positions=[result.before.atoms.map(a=>a.fractional),result.rows.map(r=>r.alignedAfterFractional)];
 const points=positions.flatMap(rows=>rows.map(f=>new THREE.Vector3(...cart(f,result.before.cell_angstrom))));
 const box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3());
 const radius=(box.getSize(new THREE.Vector3()).length()+1.1)/2;
 const distance=Math.max(radius/Math.sin(35*Math.PI/360)*1.1,4);
 const colors={H:0xe7edf5,C:0x8993a4,N:0x5289ff,O:0xef6358,Si:0xe4af80,S:0xf3d353,Mo:0x9c87e9};
 const views=[];
 let displacementOverlay=null;
 for(const [index,s] of [result.before,result.after].entries()){
  const panel=node('div');panel.append(node('h4',index?'Son SCF yapısı':'Başlangıç'));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101827);
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,-3,5);scene.add(light);
  for(const [atomIndex,atom] of s.atoms.entries()){
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(atom.element==='Mo' ? .3 : .23,24,16),
    new THREE.MeshStandardMaterial({color:colors[atom.element],roughness:.5}));
   mesh.position.set(...cart(positions[index][atomIndex],s.cell_angstrom)).sub(center);scene.add(mesh);
  }
  if(index===1){
   // True-scale periodic minimum-image displacements; never exaggerate or interpolate.
   displacementOverlay=new THREE.Group();displacementOverlay.visible=false;
   for(const row of result.rows){
    if(row.deltaAngstrom<=1e-8)continue;
    const start=new THREE.Vector3(...cart(row.before,result.before.cell_angstrom)).sub(center);
    const end=new THREE.Vector3(...cart(row.alignedAfterFractional,result.before.cell_angstrom)).sub(center);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),
     new THREE.LineBasicMaterial({color:0x38cbd9,depthTest:false}));
    const startPoint=new THREE.Mesh(new THREE.SphereGeometry(.095,10,8),
     new THREE.MeshBasicMaterial({color:0xcad6e1,transparent:true,opacity:.65}));
    startPoint.position.copy(start);displacementOverlay.add(line,startPoint);
   }
   scene.add(displacementOverlay);
  }
  const axes=new THREE.AxesHelper(1);axes.position.copy(box.min.clone().sub(center).addScalar(-.5));scene.add(axes);
  const camera=new THREE.PerspectiveCamera(35,1,.01,1000);camera.up.set(0,0,1);
  camera.position.copy(new THREE.Vector3(1.7,-2.1,1.2).normalize().multiplyScalar(distance));
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));
  renderer.domElement.style.cssText='width:100%;height:220px;display:block;border-radius:8px';
  renderer.domElement.setAttribute('aria-label',index?'Son atom konumları, 3B':'Başlangıç atom konumları, 3B');
  panel.append(renderer.domElement);grid.append(panel);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.update();
  views.push({panel,scene,camera,renderer,controls,fitDistance:distance});
 }
 let syncing=false,disposed=false;
 const draw=()=>{if(!disposed)for(const v of views)v.renderer.render(v.scene,v.camera);};
 displacementToggle.addEventListener('change',()=>{
  if(displacementOverlay)displacementOverlay.visible=displacementToggle.checked;
  draw();
 });
 for(const v of views)v.controls.addEventListener('change',()=>{
  if(syncing||disposed)return;syncing=true;
  for(const other of views)if(other!==v){
   other.camera.position.copy(v.camera.position);other.camera.quaternion.copy(v.camera.quaternion);
   other.controls.target.copy(v.controls.target);other.controls.update();
  }
  draw();syncing=false;
 });
 const resize=()=>{if(disposed)return;for(const v of views){const w=Math.max(v.panel.clientWidth,180);
  const fit=distance/Math.min(1,w/220);
  v.camera.position.sub(v.controls.target).multiplyScalar(fit/v.fitDistance).add(v.controls.target);v.fitDistance=fit;
  v.camera.aspect=w/220;v.camera.updateProjectionMatrix();v.renderer.setSize(w,220,false);}draw();};
 const observer=new ResizeObserver(resize);observer.observe(grid);resize();
 const maxMove=Math.max(...result.rows.map(row=>row.deltaAngstrom));
 const averageMove=result.rows.reduce((sum,row)=>sum+row.deltaAngstrom,0)/result.rows.length;
 if(result.ionicHistory){
  const section=node('section');section.className='qe-ionic-history';
  section.append(node('h4','İyonik yakınsama · ham QE adımları'));
  section.append(node('p','Kaynak: relax.out · SHA-256 '+result.ionicHistory.stdoutHash+
   ' · Yalnız enerji ve toplam kuvvet çiftleri doğrulanmış adımlar. Ayrı SCF aşamasının enerjisi bu seriyle birleştirilmez.'));
  const plots=node('div');plots.className='qe-ionic-chart-grid';
  plots.append(ionicChart('Toplam enerji',result.ionicHistory.steps,'energy_ry','Ry'),
   ionicChart('Toplam kuvvet',result.ionicHistory.steps,'total_force_ry_bohr','Ry/Bohr'));
  section.append(plots);container.append(section);
 }else{
  const info=node('p','İyonik adım enerji/kuvvet geçmişi bu sonuçta bulunmuyor; yalnız başlangıç ve son geometri karşılaştırılabilir.');
  info.className='qe-ionic-unavailable';container.append(info);
 }
 const summary=node('p','En büyük atom hareketi: '+maxMove.toFixed(6)+' Å · ortalama: '+
  averageMove.toFixed(6)+' Å · son en büyük kuvvet bileşeni: '+
  result.maxForceComponent.toExponential(3)+' Ry/Bohr (eşik '+result.threshold.toExponential(3)+' Ry/Bohr).');
 summary.className='qe-relax-summary';container.append(summary);
 container.append(node('p','Vektörler gerçek ölçekte ve minimum-görüntü eşlemesiyle çizilir; başlangıç konumu gri, hareket çizgisi turkuazdır. Çok küçük hareketler için tabloyu inceleyin.'));
 const sortLabel=node('label');sortLabel.className='qe-relax-sort';
 const sort=node('input');sort.type='checkbox';sort.setAttribute('aria-label','Atomları en büyük harekete göre sırala');
 sortLabel.append(sort,node('span','En büyük harekete göre sırala'));container.append(sortLabel);
 const table=node('table');table.className='qe-relax-table';
 const head=node('tr');for(const label of ['Atom','Başlangıç (kesirli)','Son (kesirli)','Minimum-görüntü Δr (Å)'])head.append(node('th',label));
 const thead=node('thead');thead.append(head);table.append(thead);
 const tbody=node('tbody');table.append(tbody);
 const renderRows=()=>{
  tbody.replaceChildren();
  const rows=sort.checked?[...result.rows].sort((a,b)=>b.deltaAngstrom-a.deltaAngstrom||a.index-b.index):result.rows;
  for(const row of rows){
   const tr=node('tr');if(row.deltaAngstrom===maxMove)tr.className='qe-relax-max';
   for(const text of [row.index+' · '+row.element,row.before.map(x=>x.toFixed(6)).join(', '),
    row.after.map(x=>x.toFixed(6)).join(', '),row.deltaAngstrom.toFixed(6)])tr.append(node('td',text));
   tbody.append(tr);
  }
 };
 sort.addEventListener('change',renderRows);renderRows();
 const scroll=node('div');scroll.className='qe-relax-table-scroll';scroll.append(table);container.append(scroll);
 return ()=>{disposed=true;observer.disconnect();for(const v of views){v.controls.dispose();
  v.scene.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});
  v.renderer.dispose();v.renderer.forceContextLoss();v.renderer.domElement.remove();}};
}
