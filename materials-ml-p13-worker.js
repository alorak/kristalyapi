/* Isolated opt-in P1.3 corpus audit, repeated phase-group validation, zero network. */
import {runP13Validation} from './materials-ml-p13-core.js';
self.onmessage=event=>{
 try{self.postMessage({ok:true,report:runP13Validation(event.data)});}
 catch(error){self.postMessage({ok:false,message:String(error?.message||error).slice(0,400)});}
};
