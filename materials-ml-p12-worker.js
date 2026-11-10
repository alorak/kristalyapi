/* Isolated same-origin worker for the 179-structure JARVIS P1.2 training phase.
 * No user CIF or external API is accessed by this worker. */
import {trainPolymorphModel} from './materials-ml-p12-core.js';
self.onmessage=event=>{
 try{
  const trained=trainPolymorphModel(event.data);
  self.postMessage({ok:true,trained});
 }catch(error){
  self.postMessage({ok:false,message:String(error?.message||error).slice(0,400)});
 }
};
