const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/cut-geometry.js'),'utf8'),context);
module.exports=context.module.exports;
