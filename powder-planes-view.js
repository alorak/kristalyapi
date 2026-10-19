/* Linked real-space viewer for a selected powder-diffraction reflection.
 * The same conventional-cell Miller-plane geometry is used by Reciprocal Space.
 * The highlighted member is the indexed (hkl), not every symmetry mate of a
 * powder peak; several reciprocal reflections may share one 2θ position. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as R from './reciprocal-core.js';

const vector=xyz=>new THREE.Vector3(...xyz);
const fractionalPoint=(f,A)=>R.add(R.add(R.scale(A[0],f[0]),R.scale(A[1],f[1])),R.scale(A[2],f[2]));
const normalizedFractional=v=>v-Math.floor(v);

function cellWireframe(A){
 const corners=Array.from({length:8},(_,i)=>fractionalPoint([i>>2&1,i>>1&1,i&1],A));
 const points=[];
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
  if(((i^j)===1)||((i^j)===2)||((i^j)===4))points.push(vector(corners[i]),vector(corners[j]));
 }
 const geometry=new THREE.BufferGeometry().setFromPoints(points);
 return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x647b91,transparent:true,opacity:.9}));
}
function addPlanes(root,hkl,A){
 const polygons=R.planeCellPolygons(hkl,A,16);
 const fill=new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.3,
  depthWrite:false,side:THREE.DoubleSide});
 const outline=new THREE.LineBasicMaterial({color:0xb85c16});
 for(const polygon of polygons){
  const vertices=[];
  for(let i=1;i<polygon.points.length-1;i++)vertices.push(...polygon.points[0],...polygon.points[i],...polygon.points[i+1]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const plane=new THREE.Mesh(geometry,fill);plane.renderOrder=1;root.add(plane);
  const edges=[];
  for(let i=0;i<polygon.points.length;i++)edges.push(vector(polygon.points[i]),vector(polygon.points[(i+1)%polygon.points.length]));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges),outline));
 }
 const reciprocal=R.reciprocalVectors(A),G=R.gVector(hkl,reciprocal);
 if(polygons.length){
  const center=R.scale(polygons[Math.floor(polygons.length/2)].points.reduce(R.add,[0,0,0]),
   1/polygons[Math.floor(polygons.length/2)].points.length);
  const diagonal=Math.max(...A.map(R.norm));
  const arrow=new THREE.ArrowHelper(vector(G).normalize(),vector(center),diagonal*.55,0xb85c16,diagonal*.12,diagonal*.07);
  root.add(arrow);
 }
 return polygons.length;
}
function addAtoms(root,sites,A,elementColor){
 const radius=Math.min(...A.map(R.norm))*.067;
 const byElement=new Map();
 for(const site of sites.slice(0,1200)){
  const position=fractionalPoint([site.x,site.y,site.z].map(normalizedFractional),A);
  if(!byElement.has(site.symbol))byElement.set(site.symbol,[]);
  byElement.get(site.symbol).push(position);
 }
 const sphere=new THREE.SphereGeometry(radius,18,12);
 const temp=new THREE.Matrix4();
 for(const [symbol,points] of byElement){
  const mesh=new THREE.InstancedMesh(sphere,new THREE.MeshStandardMaterial({color:elementColor(symbol),roughness:.42}),points.length);
  points.forEach((point,i)=>{temp.makeTranslation(...point);mesh.setMatrixAt(i,temp);});
  root.add(mesh);
 }
 return Math.min(sites.length,1200);
}

export function createPowderPlanesView(container,{elementColor}){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}
 catch(error){container.textContent='3B WebGL görünümü bu cihazda kullanılamıyor.';return {update(){throw error;},resize(){}};}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setClearColor(0xffffff,0);
 renderer.domElement.setAttribute('aria-label','Seçili hkl için 3B birim hücre ve düzlemler');
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xffffff,0xb6c7dd,2));
 const light=new THREE.DirectionalLight(0xffffff,1.7);light.position.set(4,-5,8);scene.add(light);
 const root=new THREE.Group();scene.add(root);
 const camera=new THREE.PerspectiveCamera(35,1,.01,10000);camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=false;
 controls.addEventListener('change',()=>renderer.render(scene,camera));
 const resize=()=>{
  const {clientWidth:w,clientHeight:h}=container;
  if(w<2||h<2)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);
 };
 const observer=new ResizeObserver(resize);observer.observe(container);
 let previousKey=null;
 const disposeMeshes=()=>{
  const materials=new Set(),geometries=new Set();
  root.traverse(object=>{
   if(object.geometry)geometries.add(object.geometry);
   if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  root.clear();
  materials.forEach(material=>material.dispose());
  geometries.forEach(geometry=>geometry.dispose());
 };
 function update(structure,hkl){
  const key=JSON.stringify([structure.cell,structure.sites,hkl]);
  if(previousKey===key){resize();return null;}
  const A=R.cellVectors(structure.cell);
  const corners=Array.from({length:8},(_,i)=>fractionalPoint([i>>2&1,i>>1&1,i&1],A));
  const center=R.scale(R.add(R.add(A[0],A[1]),A[2]),.5);
  const radius=Math.max(...corners.map(p=>R.norm(R.sub(p,center))));
  const planes=R.planeCellPolygons(hkl,A,16);
  disposeMeshes();
  root.add(cellWireframe(A));
  const atoms=addAtoms(root,structure.sites,A,elementColor);
  addPlanes(root,hkl,A);
  controls.target.set(...center);
  const dir=vector([1.4,-2,1.5]).normalize();
  camera.position.copy(vector(center).addScaledVector(dir,radius*3.8));
  camera.near=Math.max(.001,radius/150);camera.far=radius*200;
  camera.updateProjectionMatrix();controls.update();resize();
  previousKey=key;
  return {planes:planes.length,atoms,limited:structure.sites.length>atoms,
   planeLimited:planes.length===16};
 }
 return {update,resize,clear(){disposeMeshes();previousKey=null;resize();},
  dispose(){observer.disconnect();controls.dispose();disposeMeshes();renderer.dispose();}};
}
