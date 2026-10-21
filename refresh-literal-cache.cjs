'use strict';
/* Refresh only locally modified assets: existing cross-repository /adrian-core/
   release fingerprints are preserved, not silently replaced or guessed. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const root=__dirname,file=path.join(root,'build-assets.js');
const sandbox={self:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
const previous=sandbox.self.AdrianRelease;if(!previous?.assets)throw Error('Missing prior release manifest');
const assets={...previous.assets};
const updated=['index.html','app.js','service-worker.js','literal-exams.html','literal-exams.js','literal-exams.css'];
for(const name of updated){
 const p=path.join(root,name),key='/b2-multiple-choice-cloze/'+name;
 if(!fs.existsSync(p))throw Error('Missing updated asset '+name);
 const raw=Buffer.from(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'));
 assets[key]=crypto.createHash('sha256').update(raw).digest('hex');
}
const sorted=Object.fromEntries(Object.keys(assets).sort().map(k=>[k,assets[k]]));
const build=crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0,16);
fs.writeFileSync(file,'self.AdrianRelease='+JSON.stringify({schema:1,build,assets:sorted})+';\n');
console.log(JSON.stringify({build,updated,carriedForward:Object.keys(assets).length-updated.length,files:Object.keys(assets).length}));
