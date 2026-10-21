'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const dir=__dirname,file=path.join(dir,'build-assets.js'),context={self:{}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const existing=context.self.AdrianRelease;
if(!existing||!existing.assets)throw Error('Missing stable release manifest');
const assets={...existing.assets},names=['index.html','app.js','territory-01.js','territory-01.json','service-worker.js'];
for(const n of names){
 const p=path.join(dir,n),key='/b2-multiple-choice-cloze/'+n;
 if(!fs.existsSync(p))throw Error('Missing '+p);
 const raw=Buffer.from(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'));
 assets[key]=crypto.createHash('sha256').update(raw).digest('hex');
}
const sorted=Object.fromEntries(Object.keys(assets).sort().map(n=>[n,assets[n]]));
const build=crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0,16);
fs.writeFileSync(file,'self.AdrianRelease='+JSON.stringify({schema:1,build,assets:sorted})+';\n');
console.log('RELEASE CACHE PASS',build,names.length,'local assets,',Object.keys(sorted).length,'total');
