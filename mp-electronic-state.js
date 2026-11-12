/* In-memory reference only; never persist personal MP exports or credentials. */
let current=null;
const listeners=new Set();
export function currentMpElectronic(){return current;}
export function setMpElectronic(data){
 current=data;
 for(const listener of listeners)listener(current);
}
export function onMpElectronicChange(listener){
 listeners.add(listener);
 return ()=>listeners.delete(listener);
}
