'use strict';
/** NERDS ROUTE SWARM — external non-mutating diagnostic harness.
 * Usage from NERDS repository root:
 *   node tools/route-swarm.cjs --samples 2 --timeout 30000
 *   node tools/route-swarm.cjs --worker <base64-json>   (internal)
 * No application/project files are modified. Reports under test-results/route-swarm/.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const ROOT = process.cwd();
const arg = (name, fallback) => {const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const routes = [
 ['Barcelona → Ibiza',[['Barcelona',41.3874,2.1686],['Ibiza',38.9067,1.4206]]],
 ['Algiers → Marseille',[['Algiers',36.7538,3.0588],['Marseille',43.2965,5.3698]]],
 ['A Coruña → Lisbon',[['A Coruña',43.3623,-8.4115],['Lisbon',38.7223,-9.1393]]],
 ['Amsterdam → Emden',[['Amsterdam',52.3676,4.9041],['Emden',53.3670,7.2078]]],
 ['Amsterdam → London',[['Amsterdam',52.3676,4.9041],['London',51.5074,-0.1278]]],
 ['Gibraltar → Algiers',[['Gibraltar',36.1408,-5.3536],['Algiers',36.7538,3.0588]]],
 ['Algiers → Marseille → Barcelona',[['Algiers',36.7538,3.0588],['Marseille',43.2965,5.3698],['Barcelona',41.3874,2.1686]]],
 ['London → Hastings → Brest',[['London',51.5074,-0.1278],['Hastings',50.8543,0.5735],['Brest',48.3904,-4.4861]]],
 ['Ponta Delgada → Lisbon → Cádiz',[['Ponta Delgada',37.7412,-25.6756],['Lisbon',38.7223,-9.1393],['Cádiz',36.5271,-6.2886]]],
 ['Marseille → Barcelona → Ibiza',[['Marseille',43.2965,5.3698],['Barcelona',41.3874,2.1686],['Ibiza',38.9067,1.4206]]],
 ['Hamburg → Cuxhaven',[['Hamburg',53.5511,9.9937],['Cuxhaven',53.8616,8.6947]]],
 ['Cuxhaven → Emden',[['Cuxhaven',53.8616,8.6947],['Emden',53.3670,7.2078]]],
 ['Santarém → Macapá',[['Santarém',-2.4385,-54.6996],['Macapá',0.0389,-51.0664]]],
 ['Macapá → Belém → Breves',[['Macapá',0.0389,-51.0664],['Belém',-1.4558,-48.5044],['Breves',-1.6822,-50.4803]]],
 ['Montréal → Québec',[['Montréal',45.5019,-73.5674],['Québec',46.8139,-71.2080]]],
 ['Kingston Mills → Toronto → Montréal',[['Kingston Mills',44.2934,-76.4449],['Toronto',43.7064,-79.3986],['Montréal',45.5019,-73.5674]]],
 ['Odesa → Sevastopol → Rostov-on-Don',[['Odesa',46.4825,30.7233],['Sevastopol',44.6167,33.5254],['Rostov-on-Don',47.2357,39.7015]]]
];
function sha(x){return createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);}
function worker(payload){
  try{
    const {emptyState} = require(path.join(ROOT,'src','core.cjs'));
    const {plan} = require(path.join(ROOT,'src','passage.cjs'));
    const s=emptyState();s.waypoints=payload.points.map(([name,lat,lon],i)=>({id:'swarm-'+i,name,lat,lon,operatingMode:'AUTO'}));
    s.transport=payload.mode || 'BY-SEA';
    s.routePreference=payload.preference || 'SHORTEST WATER';
    s.coastalSeparationNM=payload.separation ?? 0;
    s.departureUTC='2027-01-01T00:00:00.000Z';
    const t=performance.now();const r=plan(s);const elapsedMs=Math.round(performance.now()-t);
    const legs=(r.legs||[]).map(l=>({distanceNM:l.distanceNM,status:l.status||null,transport:l.transport,pointCount:l.points?.length||0,standardETA:l.standardETA||null,calculatedETA:l.calculatedETA||null,pointsHash:sha(l.points||[])}));
    const connectors=(r.connectors||[]).map(c=>({distanceNM:c.distanceNM,includedInPassage:c.includedInPassage,access:c.access?{lat:c.access.lat,lon:c.access.lon}:null}));
    const legSum=legs.reduce((x,l)=>x+(Number.isFinite(l.distanceNM)?l.distanceNM:0),0);
    const accounting=Number.isFinite(r.totalNM)?Math.abs(r.totalNM-legSum)<0.001:null;
    const incomplete=legs.some(l=>!Number.isFinite(l.distanceNM)||['UNRESOLVED','FAILED'].includes(String(l.status).toUpperCase()));
    process.stdout.write(JSON.stringify({status:accounting===false?'ACCOUNTING_FAILURE':incomplete?'PARTIAL':'CALCULATED',elapsedMs,totalNM:r.totalNM??null,legs,connectors,accounting,routeStatus:r.status||null,routeKind:r.kind||null})+'\n');
  }catch(e){process.stdout.write(JSON.stringify({status:'ERROR',error:String(e?.message||e),stack:String(e?.stack||'').split('\n').slice(0,5).join('\n')})+'\n');}
}
if(process.argv.includes('--worker')){
  worker(JSON.parse(Buffer.from(arg('--worker',''),'base64').toString('utf8')));
}else{
  if(!fs.existsSync(path.join(ROOT,'src','passage.cjs'))){console.error('Run from NERDS repository root; src/passage.cjs was not found.');process.exit(2);}
  const samples=Math.max(1,Math.min(30,Number(arg('--samples','2'))||2));
  const timeoutMs=Math.max(1000,Math.min(180000,Number(arg('--timeout','30000'))||30000));
  const items=[];
  for(const [name,points] of routes){
    for(const order of ['FORWARD','REVERSE']){
      const list=order==='FORWARD'?points:[...points].reverse();
      for(let run=1;run<=samples;run++){
        const payload={points:list,mode:'BY-SEA',preference:'SHORTEST WATER',separation:0};
        const cmd=spawnSync(process.execPath,[__filename,'--worker',Buffer.from(JSON.stringify(payload)).toString('base64')],{cwd:ROOT,encoding:'utf8',timeout:timeoutMs,maxBuffer:4*1024*1024,windowsHide:true});
        let outcome;
        try{outcome=JSON.parse((cmd.stdout||'').trim().split('\n').pop());}catch{outcome={status:cmd.error?.code==='ETIMEDOUT'?'TIMEOUT':'CRASH',error:String(cmd.error?.message||cmd.stderr||'Unknown subprocess failure').slice(0,2000)};}
        items.push({name,order,run,points:list.map(p=>p[0]),...outcome});
        process.stdout.write(String(items.length).padStart(3)+' '+String(outcome.status).padEnd(19)+' '+name+' ('+order+' #'+run+')\n');
      }
    }
  }
  const issues=[];
  for(const [name] of routes){
    const a=items.filter(x=>x.name===name&&x.order==='FORWARD'),b=items.filter(x=>x.name===name&&x.order==='REVERSE');
    for(const group of [a,b])if(group.length>1){const fingerprints=new Set(group.map(r=>sha({status:r.status,totalNM:r.totalNM,legs:r.legs?.map(l=>[l.distanceNM,l.pointCount,l.pointsHash])})));if(fingerprints.size>1)issues.push({name,type:'NONDETERMINISM',order:group[0].order});}
    if(a[0]?.status==='CALCULATED'&&b[0]?.status==='CALCULATED'&&Number.isFinite(a[0].totalNM)&&Number.isFinite(b[0].totalNM)){
      const delta=Math.abs(a[0].totalNM-b[0].totalNM);if(delta>.1)issues.push({name,type:'DIRECTION_ASYMMETRY',deltaNM:delta});
    }
    if(items.some(x=>x.name===name&&x.accounting===false))issues.push({name,type:'ACCOUNTING_FAILURE'});
  }
  const report={harness:'NERDS ROUTE SWARM',createdAt:new Date().toISOString(),node:process.version,platform:os.platform(),sourceRoot:ROOT,configuration:{samples,timeoutMs,preferences:'SHORTEST WATER / coastal separation 0',assumptions:'Coordinate fixtures for diagnostic comparison; validate exact waypoint IDs in application.'},summary:{cases:items.length,counts:Object.fromEntries([...new Set(items.map(x=>x.status))].map(k=>[k,items.filter(x=>x.status===k).length])),issues:issues.length},issues,items};
  const output=path.join(ROOT,'test-results','route-swarm');fs.mkdirSync(output,{recursive:true});const target=path.join(output,'route-swarm-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');fs.writeFileSync(target,JSON.stringify(report,null,2));
  console.log('\nREPORT:',target);console.log('SUMMARY:',JSON.stringify(report.summary));
  if(issues.length)process.exitCode=1;
}
