'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const candidates=[process.env.PYTHON,process.platform==='win32'?'python':'python3'].filter(Boolean);
let result;
for(const cmd of candidates){
 result=spawnSync(cmd,[path.join(__dirname,'test-part4-geometry.py')],{stdio:'inherit',encoding:'utf8'});
 if(!result.error || result.error.code!=='ENOENT')break;
}
if(result?.error){console.error(result.error.message);process.exit(1)}
process.exit(result?.status??1);
