// Pure game rules for ปงยางคก: catalog, terrain, costs, saves, the monthly simulation and politics.
// Loaded by index.html as a classic script before the main script (its top-level names are shared globals),
// and required by the Node tests through the guarded module.exports at the bottom. No DOM access here.
const GROUPS={
  'ที่อยู่อาศัย':[['wood','บ้านไม้ยกพื้น',800,12],['modern','บ้านปูนโมเดิร์น',1400,20],['row','ตึกแถวคูหา',2400,34],['condo','คอนโด',5800,88]],
  'ค้าขาย':[['market','กาดชุมชน',1300],['shop','ร้านโชห่วย',850],['mall','ห้างสรรพสินค้า',6200]],
  'เกษตร':[['cane','ไร่อ้อย',650],['cassava','ไร่มันสำปะหลัง',520],['soy','ไร่ถั่วเหลือง',440],['pineapple','ไร่สับปะรด',760],['orchard','สวนผลไม้',980],['veg','แปลงผัก',380],['livestock','ฟาร์มปศุสัตว์',1250]],
  'เหมือง':[['coal','เหมืองถ่านหิน',1950],['gold','เหมืองทองคำ',3400],['silver','เหมืองเงิน',2700],['copper','เหมืองทองแดง',2100]],
  'โครงสร้าง':[['road','ถนนลาดยาง',120],['poleWood','เสาไม้ · 3 ช่อง',250],['poleConcrete','เสาคอนกรีต · 5 ช่อง',480],['pylon','เสาแรงสูง · 8 ช่อง',1200],['plant','โรงไฟฟ้าถ่านหิน',3700]],
  'ชุมชน':[['park','สวนสาธารณะ',650],['school','โรงเรียน',1700],['clinic','สถานีอนามัย',1900],['temple','วัดล้านนา',2400]]
};
const catalog=Object.fromEntries(Object.entries(GROUPS).flatMap(([group,rows])=>rows.map(([id,name,cost,capacity])=>[id,{id,name,cost,capacity,group}])));
const N=26, range={poleWood:3,poleConcrete:5,pylon:8,plant:3}, key=(i,j)=>i+','+j;
const roles=['นายกเทศมนตรีตำบล','ผู้บริหารระดับอำเภอ','ผู้บริหารระดับจังหวัด','สมาชิกสภาผู้แทนราษฎร','นายกรัฐมนตรี'];
// The western road tile is the town entrance: every road network is traced from it.
const ENTRANCE='2,14',BRIDGE_COST=420,LOAN=4000,LOAN_RATE=1.1,DEBT_PAYMENT=220;
const COMMUNITY={park:120,school:150,clinic:200,temple:300}; // residents served per building
const SHOP_WEIGHT={shop:1,market:1.5,mall:4};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function terrain(i,j){let d=j-(3.3+Math.sin(i*.28)*1.45+i*.12);return Math.abs(d)<1.12?'water':Math.abs(d)<1.7?'bank':'land'}
// Roads laid over the river become bridges, which cost more to build.
function buildCost(id,i,j){return id==='road'&&i!==undefined&&terrain(i,j)==='water'?BRIDGE_COST:catalog[id].cost}
function cellName(id,i,j){return id==='road'&&i!==undefined&&terrain(i,j)==='water'?'สะพาน':catalog[id].name}
function saleValue(id,i,j){return Math.floor(buildCost(id,i,j)/2)}
function sellTile(s,k,expected){
 if(s.opposition||k===ENTRANCE||!catalog[expected]||s.cells[k]!==expected)return false;
 const [i,j]=k.split(',').map(Number),value=saleValue(expected,i,j);
 delete s.cells[k];s.cash+=value;
 s.news='ขาย'+cellName(expected,i,j)+' • เงินคืน ฿'+value.toLocaleString('th-TH');return true;
}
function newCity(){
 let cells={},put=(i,j,id)=>cells[key(i,j)]=id;
 for(let i=2;i<24;i++)put(i,14,'road');
 for(let j=7;j<24;j++)put(13,j,'road');
 for(let i=6;i<=19;i++)put(i,19,'road');
 for(let j=11;j<20;j++)put(7,j,'road');
 // Poles at 11,12 and 16,17 bridge the gaps so the starting town is fully powered.
 [[8,13,'wood'],[9,13,'wood'],[10,13,'market'],[11,13,'shop'],[12,13,'row'],[14,13,'modern'],[15,13,'wood'],[16,13,'temple'],[8,15,'modern'],[9,15,'wood'],[11,15,'wood'],[12,15,'market'],[14,15,'row'],[15,15,'wood'],[16,15,'park'],[12,11,'school'],[14,11,'clinic'],[8,18,'soy'],[9,18,'cane'],[10,18,'veg'],[11,18,'pineapple'],[12,18,'orchard'],[14,18,'livestock'],[15,18,'cassava'],[16,18,'veg'],[20,13,'coal'],[21,13,'plant'],[18,13,'poleConcrete'],[14,12,'poleConcrete'],[11,12,'poleConcrete'],[10,15,'poleConcrete'],[12,17,'poleWood'],[16,17,'poleConcrete']].forEach(a=>put(...a));
 return {v:1,cells,cash:24000,tax:8,services:2,month:0,pop:108,approval:66,level:0,opposition:false,campaign:0,wins:0,trust:2,influence:0,actionMonth:-1,party:4000,news:'ชาวบ้านเปิดกาดเช้า เทศบาลพร้อมรับฟังความคิดเห็น',rival:55,hist:[],debt:0,loanMonth:-99,speed:0};
}
// Saved games are untrusted: keep only known structures on valid tiles and clamp every number.
function validSave(old){return !!old&&typeof old==='object'&&old.v===1&&!!old.cells&&typeof old.cells==='object'&&!Array.isArray(old.cells)}
function sanitizeCity(old){
 const base=newCity();
 if(!validSave(old))return base;
 const cells={};
 for(const [k,id] of Object.entries(old.cells)){
  const m=/^(-?\d+),(-?\d+)$/.exec(k);if(!m||typeof id!=='string'||!Object.hasOwn(catalog,id))continue;
  const i=+m[1],j=+m[2];if(i<0||j<0||i>=N||j>=N||(terrain(i,j)==='water'&&id!=='road'))continue;
  cells[key(i,j)]=id;
 }
 cells[ENTRANCE]='road';
 const num=(v,d,lo,hi)=>{if(v===null||v===undefined||v==='')return d;v=Number(v);return Number.isFinite(v)?clamp(v,lo,hi):d};
 const int=(v,d,lo,hi)=>Math.round(num(v,d,lo,hi));
 const month=int(old.month,0,0,1e6);
 return {...base,cells,
  cash:num(old.cash,base.cash,-1e9,1e9),tax:int(old.tax,8,2,22),services:int(old.services,2,0,5),month,
  pop:int(old.pop,base.pop,0,1e6),approval:num(old.approval,base.approval,0,100),level:int(old.level,0,0,roles.length-1),
  opposition:old.opposition===true,campaign:num(old.campaign,0,0,500),wins:int(old.wins,0,0,99),trust:num(old.trust,2,-20,14),
  influence:num(old.influence,0,0,500),actionMonth:int(old.actionMonth,-1,-1,1e6),party:num(old.party,4000,0,1e9),
  news:typeof old.news==='string'?old.news.slice(0,240):base.news,rival:num(old.rival,55,20,90),
  hist:Array.isArray(old.hist)?old.hist.map(Number).filter(Number.isFinite).map(v=>clamp(v,0,100)).slice(-6):[],
  debt:num(old.debt,0,0,1e7),loanMonth:int(old.loanMonth,-99,-99,month),speed:int(old.speed,0,0,2)};
}
function analyze(s){
 const entries=Object.entries(s.cells).filter(([,id])=>catalog[id]).map(([k,id])=>({k,id,p:k.split(',').map(Number)}));
 const adj=([x,y])=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
 const roads=new Set(),queue=[ENTRANCE];
 for(let n=0;n<queue.length;n++){let k=queue[n];if(roads.has(k)||s.cells[k]!=='road')continue;roads.add(k);adj(k.split(',').map(Number)).forEach(p=>queue.push(p.join(',')))}
 const access=p=>adj(p).some(a=>roads.has(a.join(',')));
 const fuel=entries.some(e=>e.id==='coal'&&access(e.p));
 const nodes=entries.filter(e=>range[e.id]), live=nodes.filter(e=>e.id==='plant'&&fuel&&access(e.p));
 const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
 // Two poles link when either one reaches the other.
 for(let n=0;n<live.length;n++)for(const e of nodes)if(!live.includes(e)&&e.id!=='plant'&&distance(e.p,live[n].p)<=Math.max(range[e.id],range[live[n].id]))live.push(e);
 const powered=p=>live.some(e=>distance(e.p,p)<=range[e.id]);
 let capacity=0,jobs=0,farmTrade=0,shopTrade=0,shopSlots=0,dirty=0,served=0,used=0,upkeep=0;
 const service={park:0,school:0,clinic:0,temple:0},mines=[],parks=[];
 for(const e of entries){let a=catalog[e.id];upkeep+=Math.ceil(buildCost(e.id,...e.p)*.004);if(e.id==='road'||range[e.id])continue;
 let connected=access(e.p),lit=powered(e.p),factor=connected?(lit?1:.35):.08;
 used++;if(lit)served++;
 capacity+=(a.capacity||0)*factor;
 if(['เกษตร','เหมือง','ค้าขาย'].includes(a.group))jobs+=Math.round((8+a.cost/130)*factor);
 if(a.group==='เกษตร')farmTrade+=a.cost*.042*factor;
 if(a.group==='เหมือง'){farmTrade+=a.cost*.056*factor;mines.push(e.p)}
 if(a.group==='ค้าขาย'){shopTrade+=a.cost*.042*factor;shopSlots+=(SHOP_WEIGHT[e.id]||1)*factor}
 if(a.group==='ชุมชน'){service[e.id]+=factor;if(e.id==='park')parks.push(e.p)}
 }
 // Parks within three tiles soften a mine's pollution; a running coal plant also pollutes.
 for(const m of mines)dirty+=parks.some(p=>distance(p,m)<=3)?1:2;
 dirty+=live.filter(e=>e.id==='plant').length;
 const people=Math.max(40,s.pop),cover=id=>Math.min(1,service[id]*COMMUNITY[id]/people);
 const park=cover('park'),edu=cover('school'),health=cover('clinic'),faith=cover('temple');
 // Shops need customers: trade grows with residents per shop.
 const demand=shopSlots?Math.min(1.25,.4+s.pop/Math.max(40,shopSlots*35)):0;
 const trade=Math.round(farmTrade+shopTrade*demand),debtPay=Math.min(s.debt||0,DEBT_PAYMENT);
 const coverage=used?Math.round(100*served/used):0, income=Math.round(s.pop*s.tax*.43*(1+.15*edu)+trade),expense=Math.round(upkeep+s.services*(60+s.pop*.3)+debtPay);
 const jobFill=Math.min(1,jobs/Math.max(1,s.pop*.65)),care=2.5*(park+edu+health+faith);
 const target=clamp(35+coverage*.18+jobFill*13+care+s.services*4-(s.tax-8)*2-dirty-(s.cash<0?14:0),8,96);
 return {roads,live,powered,access,capacity:Math.floor(capacity),jobs,coverage,income,expense,target,trade,demand,park,edu,health,faith,jobFill,debtPay,dirty};
}
function average(list,fallback){return list?.length?list.reduce((a,b)=>a+b,0)/list.length:fallback}
// Advances one month. Returns an election result object in election months, otherwise null.
function advance(s){
 const a=analyze(s);s.month++;s.party+=s.opposition?180:100;s.cash+=a.income-a.expense;s.debt=Math.max(0,(s.debt||0)-a.debtPay);
 // Residents arrive when there are homes, work and a council they like; clinics speed growth.
 const desire=a.capacity*(.6+.4*a.jobFill)*(s.approval<35?.85:1),gap=desire-s.pop,rate=gap>0?.08+.06*a.health:.12;
 s.pop=Math.max(0,Math.round(s.pop+Math.sign(gap)*Math.min(Math.abs(gap),Math.ceil(Math.abs(gap)*rate))));
 s.approval=Math.round((s.approval+a.target)*5)/10;
 s.hist=[...(s.hist||[]),s.approval].slice(-6);
 if(s.opposition){
  // The rival council governs: its popularity drifts and slowly wears down in office.
  const r=s.rival??55;s.rival=clamp(r+(Math.random()*6-3)-(r-50)*.15-.35,30,80);
  if(a.income<a.expense&&s.tax<14)s.tax++;
 }
 if(s.month%12!==0)return null;
 const caught=s.influence>0&&Math.random()<Math.min(.85,s.influence*.05);
 const wasOpposition=s.opposition,prevLevel=s.level,base=wasOpposition?100-(s.rival??55):average(s.hist,s.approval);
 const score=caught?0:Math.round(base+s.campaign+s.trust+s.influence),shown=clamp(score,0,100);
 const won=score>=50;s.news='เลือกตั้งประจำปี • ได้เสียง '+shown+'% ';
 if(won){s.opposition=false;s.wins++;if(s.wins>=2&&s.level<roles.length-1){s.level++;s.wins=0}s.news+='ชนะเลือกตั้ง รับตำแหน่ง'+roles[s.level]}
 else{s.opposition=true;s.wins=0;s.rival=clamp(100-score,50,62);s.news=caught?'คดีซื้อเสียงถูกเปิดเผย ถูกตัดสิทธิ์รอบนี้ และเสียความเชื่อมั่น':s.news+'คู่แข่งชนะ คุณทำหน้าที่ฝ่ายค้าน'}
 if(caught)s.trust=-8;s.campaign=0;s.influence=0;
 return {won,score:shown,caught,promoted:s.level>prevLevel,role:roles[s.level],level:s.level,opposition:s.opposition,wasOpposition};
}
function politics(s,kind){
 if(s.actionMonth===s.month)return 'เดือนนี้ลงพื้นที่แล้ว';
 const cost=kind==='buy'?900:180;if(s.party<cost)return 'เงินพรรคไม่พอ';
 s.actionMonth=s.month;s.party-=cost;
 if(kind==='buy'){s.influence+=6;s.news='ซื้อเสียงในเกม • ฐานเสียงชั่วคราวเพิ่ม ความเสี่ยงคดีสูงขึ้น'}
 else{s.trust=Math.min(14,s.trust+1);s.campaign+=2;s.news='สภาชุมชนรับข้อเสนอ ชาวบ้านจดจำผลงานของคุณ'}
 return s.news;
}
// Emergency loan: once a year while the treasury is in the red, repaid monthly with 10% interest.
function takeLoan(s){
 if(s.opposition)return 'ฝ่ายค้านกู้เงินในนามเทศบาลไม่ได้';
 if(s.cash>=0)return 'กู้ฉุกเฉินได้เมื่อเงินคลังติดลบเท่านั้น';
 if(s.month-s.loanMonth<12)return 'กู้ฉุกเฉินได้ปีละครั้ง';
 s.cash+=LOAN;s.debt=(s.debt||0)+Math.round(LOAN*LOAN_RATE);s.loanMonth=s.month;s.approval=Math.max(0,s.approval-6);
 s.news='กู้ฉุกเฉิน ฿'+LOAN.toLocaleString('th-TH')+' • ผ่อนคืนเดือนละ ฿'+DEBT_PAYMENT;return '';
}

if(typeof module!=='undefined')module.exports={GROUPS,catalog,N,range,key,roles,ENTRANCE,BRIDGE_COST,LOAN,LOAN_RATE,DEBT_PAYMENT,COMMUNITY,SHOP_WEIGHT,clamp,terrain,buildCost,cellName,saleValue,sellTile,newCity,validSave,sanitizeCity,analyze,average,advance,politics,takeLoan};
