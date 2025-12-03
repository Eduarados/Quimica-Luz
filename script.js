const canvas = document.getElementById('space');
const ctx = canvas.getContext('2d');
const chartCanvas = document.getElementById('chart');
const chartCtx = chartCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const lightSlider = document.getElementById('light');
const lightVal = document.getElementById('lightVal');
const speedSlider = document.getElementById('speed');
const speedVal = document.getElementById('speedVal');
const particlesSlider = document.getElementById('particles');
const particleCountLabel = document.getElementById('particleCount');
const trailsCheckbox = document.getElementById('trails');
const timeLabel = document.getElementById('timeLabel');
const countAel = document.getElementById('countA');
const countBel = document.getElementById('countB');
const countCel = document.getElementById('countC');
const collisionsEl = document.getElementById('collisions');
const kfEl = document.getElementById('kf');
const krEl = document.getElementById('kr');
const KestEl = document.getElementById('Kest');
const exportCsvBtn = document.getElementById('exportCsv');
const compareBtn = document.getElementById('compareBtn');
const lantern = document.getElementById('lantern');
let running = false;
let lastTime = null;
let simTime = 0;
let collisions = 0;
let particles = [];
let grid = null;
let history = { t:[], A:[], B:[], C:[] };
const maxPoints = 900;
const boxW = canvas.width;
const boxH = canvas.height;
let config = {
  N: Number(particlesSlider.value),
  particleRadius: 4.6,
  k0: 0.04,
  alpha: 6,
  beta: 1.25,
  k_rev: 0.007,
  excitedLifetime: 1.0,
  collisionFreqApprox: 1.2,
  cellSize: 28
};
particleCountLabel.textContent = config.N;
speedVal.textContent = Number(speedSlider.value).toFixed(1);
lightVal.textContent = lightSlider.value;
let compareState = false;
let compareSnapshot = null;
class Particle{
  constructor(x,y,vx,vy,type){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.type=type;this.r=config.particleRadius;this.excited=0;this.age=0;this.trail=[]
  }
  move(dt){
    this.x+=this.vx*dt;this.y+=this.vy*dt;this.age+=dt;
    if(this.x<this.r){this.x=this.r;this.vx*=-1}
    if(this.x>boxW-this.r){this.x=boxW-this.r;this.vx*=-1}
    if(this.y<this.r){this.y=this.r;this.vy*=-1}
    if(this.y>boxH-this.r){this.y=boxH-this.r;this.vy*=-1}
    if(trailsCheckbox.checked){
      this.trail.push({x:this.x,y:this.y,age:0});
      if(this.trail.length>18) this.trail.shift();
      for(let t of this.trail) t.age+=dt;
    } else this.trail=[];
    if(this.excited>0) this.excited=Math.max(0,this.excited-dt)
  }
  draw(ctx,I){
    if(trailsCheckbox.checked && this.trail.length>1){
      for(let i=0;i<this.trail.length-1;i++){
        const p1 = this.trail[i];
        const p2 = this.trail[i+1];
        const alpha = (i+1)/this.trail.length;
        ctx.beginPath();
        ctx.moveTo(p1.x,p1.y);
        ctx.lineTo(p2.x,p2.y);
        ctx.strokeStyle = `rgba(230,235,255,${0.08 + 0.22*alpha})`;
        ctx.lineWidth = 1.6 * Math.min(1, 0.5 + alpha);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    if(this.type==='A'){
      const glow = Math.min(0.9,0.15 + 0.85*this.excited);
      ctx.fillStyle = `rgba(96,165,250,${0.35+glow*0.6})`;
      ctx.strokeStyle = `rgba(96,165,250,${0.9*glow})`;
      ctx.shadowBlur = 8*glow;
      ctx.shadowColor = 'rgba(96,165,250,0.8)';
    } else if(this.type==='B'){
      const glow = Math.min(0.9,0.15 + 0.85*this.excited);
      ctx.fillStyle = `rgba(251,113,133,${0.35+glow*0.6})`;
      ctx.strokeStyle = `rgba(251,113,133,${0.9*glow})`;
      ctx.shadowBlur = 8*glow;
      ctx.shadowColor = 'rgba(251,113,133,0.8)';
    } else {
      const glow = 0.3 + 0.6*(this.excited||0);
      ctx.fillStyle = `rgba(167,243,208,${0.5+glow*0.5})`;
      ctx.strokeStyle = `rgba(52,211,153,${0.9*glow})`;
      ctx.shadowBlur = 6*glow;
      ctx.shadowColor = 'rgba(52,211,153,0.8)';
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
  }
}
function buildGrid(){
  const cols = Math.ceil(boxW/config.cellSize);
  const rows = Math.ceil(boxH/config.cellSize);
  grid = { cols, rows, cells: new Array(cols*rows) };
  for(let i=0;i<grid.cells.length;i++) grid.cells[i]=[];
}
function gridIndex(x,y){
  const cx = Math.floor(x/config.cellSize);
  const cy = Math.floor(y/config.cellSize);
  return Math.max(0,Math.min(grid.cols-1,cx)) + Math.max(0,Math.min(grid.rows-1,cy))*grid.cols;
}
function placeInGrid(){
  for(let c of grid.cells) c.length=0;
  for(let i=0;i<particles.length;i++){
    const p=particles[i];
    const idx = gridIndex(p.x,p.y);
    grid.cells[idx].push(i);
  }
}
function initSim(){
  particles.length=0;
  collisions=0;
  simTime=0;
  history={t:[],A:[],B:[],C:[]};
  config.N = Number(particlesSlider.value);
  particleCountLabel.textContent = config.N;
  for(let i=0;i<config.N;i++){
    const x=10+Math.random()*(boxW-20);
    const y=10+Math.random()*(boxH-20);
    const speed = 30 + Math.random()*80;
    const ang = Math.random()*Math.PI*2;
    const type = Math.random()<0.5?'A':'B';
    particles.push(new Particle(x,y,Math.cos(ang)*speed,Math.sin(ang)*speed,type))
  }
  for(let i=0;i<6;i++){
    const x=20+Math.random()*(boxW-40);
    const y=20+Math.random()*(boxH-40);
    particles.push(new Particle(x,y,(Math.random()-0.5)*40,(Math.random()-0.5)*40,'C'))
  }
  buildGrid();
  placeInGrid();
  updateKDisplays();
  updateStats();
}
function resolveCollisions(dt){
  placeInGrid();
  for(let cellIndex=0;cellIndex<grid.cells.length;cellIndex++){
    const cell = grid.cells[cellIndex];
    if(cell.length<=1) continue;
    for(let i=0;i<cell.length;i++){
      for(let j=i+1;j<cell.length;j++){
        const a = particles[cell[i]];
        const b = particles[cell[j]];
        const dx=b.x-a.x, dy=b.y-a.y;
        const rsum = a.r + b.r;
        if(dx*dx+dy*dy <= rsum*rsum){
          const dist = Math.sqrt(Math.max(0.0001,dx*dx+dy*dy));
          const nx = dx/dist, ny = dy/dist;
          const pvn = a.vx*nx + a.vy*ny;
          const qvn = b.vx*nx + b.vy*ny;
          const optimized = (2*(pvn - qvn))/2;
          a.vx = a.vx - optimized*nx; a.vy = a.vy - optimized*ny;
          b.vx = b.vx + optimized*nx; b.vy = b.vy + optimized*ny;
          const overlap = Math.max(0.1,0.5*(rsum - dist));
          a.x -= nx*overlap; a.y -= ny*overlap;
          b.x += nx*overlap; b.y += ny*overlap;
          collisions++;
          maybeReactOnCollision(a,b,dt);
        }
      }
    }
  }
}
function maybeReactOnCollision(p,q,dt){
  let a=null,b=null;
  if((p.type==='A'&&q.type==='B')||(p.type==='B'&&q.type==='A')){a=p;b=q}else{return}
  const I = Number(lightSlider.value)/100;
  const k0 = config.k0;
  const alpha = config.alpha;
  const beta = config.beta;
  const kf_effective = k0 * (1 + alpha * Math.pow(I,beta));
  const prob = Math.min(1,kf_effective* (0.6 + 0.8*(p.excited||0) + 0.8*(q.excited||0)));
  if(Math.random()<prob){
    a.type='C'; b.type='C';
    a.excited = Math.max(a.excited, 0.8);
    b.excited = Math.max(b.excited, 0.8);
    return
  }
  const photonAbsProb = Math.min(0.6,0.18 + 0.9*I);
  if(Math.random()<photonAbsProb){
    a.excited = Math.max(a.excited, config.excitedLifetime*(0.5+Math.random()*0.8));
    b.excited = Math.max(b.excited, config.excitedLifetime*(0.5+Math.random()*0.8));
  }
}
function handleReverse(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    if(p.type==='C'){
      const probPerDt = config.k_rev * dt * (1 - 0.5*Math.min(1,p.excited));
      if(Math.random()<probPerDt){
        p.type='A';
        const nb = new Particle(Math.min(boxW-10,Math.max(10,p.x+ (Math.random()-0.5)*18)),Math.min(boxH-10,Math.max(10,p.y+(Math.random()-0.5)*18)),(Math.random()-0.5)*40,(Math.random()-0.5)*40,'B');
        particles.push(nb)
      }
    }
  }
}
function recordHistory(t){
  const c = countTypes();
  history.t.push(t); history.A.push(c.A); history.B.push(c.B); history.C.push(c.C);
  if(history.t.length>maxPoints){history.t.shift();history.A.shift();history.B.shift();history.C.shift()}
}
function drawBackground(){
  ctx.clearRect(0,0,boxW,boxH);
  const grd = ctx.createLinearGradient(0,0,0,boxH);
  grd.addColorStop(0,'rgba(255,255,255,0.01)'); grd.addColorStop(1,'rgba(0,0,0,0.02)');
  ctx.fillStyle = grd; ctx.fillRect(0,0,boxW,boxH);
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for(let x=0;x<boxW;x+=60) ctx.fillRect(x,0,1,boxH);
  for(let y=0;y<boxH;y+=60) ctx.fillRect(0,y,boxW,1);
}
function drawScene(){
  const I = Number(lightSlider.value)/100;
  drawBackground();
  const lanternRect = lantern.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const lx = lanternRect.left + lanternRect.width/2 - canvasRect.left;
  const ly = lanternRect.top + lanternRect.height/2 - canvasRect.top;
  const maxRadius = 260 + 420*I;
  for(let p of particles) p.draw(ctx,I);
  ctx.beginPath();
  const rad = maxRadius;
  const grad = ctx.createRadialGradient(lx,ly,10,lx,ly,rad);
  grad.addColorStop(0, `rgba(255,242,200,${0.45*I})`);
  grad.addColorStop(0.35, `rgba(255,242,200,${0.14*I})`);
  grad.addColorStop(1, `rgba(255,242,200,0)`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,boxW,boxH);
  ctx.globalCompositeOperation='lighter';
  for(let p of particles){
    if(p.excited>0){
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*3*(0.4+p.excited*0.6),0,Math.PI*2);
      ctx.fillStyle = `rgba(255,250,210,${0.02 + 0.08*p.excited})`;
      ctx.fill()
    }
  }
  ctx.globalCompositeOperation='source-over';
}
function drawChart(){
  const w = chartCanvas.width; const h = chartCanvas.height;
  chartCtx.clearRect(0,0,w,h);
  chartCtx.fillStyle='rgba(255,255,255,0.01)'; chartCtx.fillRect(0,0,w,h);
  chartCtx.strokeStyle='rgba(255,255,255,0.06)'; chartCtx.lineWidth=1;
  chartCtx.beginPath(); chartCtx.moveTo(36,10); chartCtx.lineTo(36,h-30); chartCtx.lineTo(w-10,h-30); chartCtx.stroke();
  if(history.t.length<2) return;
  const maxC = Math.max(...history.A, ...history.B, ...history.C,1);
  const left=36, top=10, right=w-10, bottom=h-30;
  const plotW = right-left, plotH = bottom-top;
  function plot(arr, color, width){
    chartCtx.beginPath();
    for(let i=0;i<arr.length;i++){
      const x = left + (i/(arr.length-1))*plotW;
      const y = bottom - (arr[i]/maxC)*plotH;
      if(i===0) chartCtx.moveTo(x,y); else chartCtx.lineTo(x,y)
    }
    chartCtx.strokeStyle = color; chartCtx.lineWidth = width; chartCtx.stroke()
  }
  plot(history.A,'#60a5fa',2.6);
  plot(history.B,'#fb7185',2.6);
  plot(history.C,'#34d399',2.6);
  chartCtx.fillStyle='#60a5fa'; chartCtx.fillRect(w-140,12,10,8); chartCtx.fillStyle='#e6eef8'; chartCtx.fillText('A',w-125,20);
  chartCtx.fillStyle='#fb7185'; chartCtx.fillRect(w-100,12,10,8); chartCtx.fillStyle='#e6eef8'; chartCtx.fillText('B',w-85,20);
  chartCtx.fillStyle='#34d399'; chartCtx.fillRect(w-65,12,10,8); chartCtx.fillStyle='#e6eef8'; chartCtx.fillText('C',w-50,20);
  chartCtx.fillStyle='rgba(230,238,248,0.75)'; chartCtx.font='12px sans-serif'; chartCtx.fillText('Contagem (proxy de concentração)', left, top-1);
}
function countTypes(){
  let A=0,B=0,C=0;
  for(let p of particles){ if(p.type==='A') A++; else if(p.type==='B') B++; else C++; }
  return {A,B,C};
}
function updateStats(){
  const c = countTypes();
  countAel.textContent = c.A; countBel.textContent = c.B; countCel.textContent = c.C; collisionsEl.textContent = collisions;
  const I = Number(lightSlider.value)/100;
  const kf_eff = config.k0 * (1 + config.alpha * Math.pow(I,config.beta));
  const kf_s = kf_eff * config.collisionFreqApprox;
  const kr_s = config.k_rev;
  kfEl.textContent = kf_s.toFixed(4); krEl.textContent = kr_s.toFixed(4);
  const denom = (c.A*c.B) || 1;
  const Kest = (c.C/denom).toFixed(5);
  KestEl.textContent = (denom===1 && c.A===0 && c.B===0)?'—':Kest;
  timeLabel.textContent = simTime.toFixed(2)+' s';
}
function updateKDisplays(){
  const I = Number(lightSlider.value)/100;
  const kf_eff = config.k0 * (1 + config.alpha * Math.pow(I,config.beta));
  kfEl.textContent = (kf_eff * config.collisionFreqApprox).toFixed(4);
}
function loop(ts){
  if(!running) return;
  if(!lastTime) lastTime = ts;
  const dtMs = Math.min(60, ts - lastTime);
  lastTime = ts;
  const simSpeed = Number(speedSlider.value);
  const dt = (dtMs/1000)*simSpeed;
  simTime += dt;
  for(let p of particles) p.move(dt);
  resolveCollisions(dt);
  handleReverse(dt);
  recordHistory(simTime);
  drawScene();
  drawChart();
  updateStats();
  requestAnimationFrame(loop);
}
startBtn.addEventListener('click',()=>{
  if(!running){ running=true; lastTime=null; requestAnimationFrame(loop) }
});
pauseBtn.addEventListener('click',()=>{ running=false; lastTime=null; });
resetBtn.addEventListener('click',()=>{ initSim(); drawScene(); drawChart(); });
lightSlider.addEventListener('input',()=>{
  lightVal.textContent = lightSlider.value;
  updateKDisplays();
});
speedSlider.addEventListener('input',()=>{ speedVal.textContent = Number(speedSlider.value).toFixed(1); });
particlesSlider.addEventListener('input',()=>{
  particleCountLabel.textContent = particlesSlider.value;
});
particlesSlider.addEventListener('change',()=>{ initSim(); drawScene(); drawChart(); });
canvas.addEventListener('click',()=>{
  const orig = Number(lightSlider.value);
  lightSlider.value = Math.min(100, Math.round(orig + 30));
  lightVal.textContent = lightSlider.value;
  updateKDisplays();
  setTimeout(()=>{ lightSlider.value = orig; lightVal.textContent = orig; updateKDisplays(); },700);
});
exportCsvBtn.addEventListener('click',()=>{
  let csv = 'time,A,B,C\n';
  for(let i=0;i<history.t.length;i++) csv += `${history.t[i].toFixed(3)},${history.A[i]},${history.B[i]},${history.C[i]}\n`;
  const blob = new Blob([csv],{type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='sim_data.csv'; a.click(); URL.revokeObjectURL(url);
});
compareBtn.addEventListener('click',()=>{
  if(!compareState){
    compareSnapshot = { history: JSON.parse(JSON.stringify(history)), label: `I=${lightSlider.value}%` };
    lightSlider.value = 0; lightVal.textContent = '0'; updateKDisplays();
    compareState = true;
    compareBtn.textContent = 'Finalizar comparação';
  } else {
    const base = compareSnapshot.history;
    const side = history;
    drawComparison(base,side,compareSnapshot.label,`I=${lightSlider.value}%`);
    compareState=false; compareBtn.textContent='Comparar: sem luz ↔ com luz';
    initSim();
  }
});
function drawComparison(a,b,la,lb){
  chartCtx.clearRect(0,0,chartCanvas.width,chartCanvas.height);
  const w = chartCanvas.width; const h = chartCanvas.height;
  chartCtx.fillStyle='rgba(255,255,255,0.01)'; chartCtx.fillRect(0,0,w,h);
  const left=36,top=10,right=w-10,bottom=h-30; const plotW=right-left,plotH=bottom-top;
  const maxC = Math.max(...a.A,...a.B,...a.C,...b.A,...b.B,...b.C,1);
  function plotArr(arr,color,width,offset){
    chartCtx.beginPath();
    for(let i=0;i<arr.length;i++){
      const x = left + (i/(Math.max(a.t.length,b.t.length)-1))*plotW;
      const y = bottom - (arr[i]/maxC)*plotH;
      if(i===0) chartCtx.moveTo(x,y); else chartCtx.lineTo(x,y);
    }
    chartCtx.strokeStyle=color; chartCtx.lineWidth=width; chartCtx.stroke();
  }
  plotArr(a.C,'rgba(52,211,153,0.28)',3);
  plotArr(b.C,'rgba(52,211,153,0.95)',3);
  chartCtx.fillStyle='#e6eef8'; chartCtx.fillText(`${la} (faded)`, w-210,20); chartCtx.fillText(`${lb} (solid)`, w-120,20);
}
let dragging=false, dragOffsetX=0, dragOffsetY=0;
lantern.addEventListener('pointerdown',(e)=>{ dragging=true; lantern.setPointerCapture(e.pointerId); const r=lantern.getBoundingClientRect(); dragOffsetX=e.clientX-r.left; dragOffsetY=e.clientY-r.top; });
window.addEventListener('pointermove',(e)=>{ if(!dragging) return; const wrap = canvas.parentElement.getBoundingClientRect(); let left = e.clientX - wrap.left - dragOffsetX; let top = e.clientY - wrap.top - dragOffsetY; left = Math.max(0,Math.min(wrap.width-110,left)); top = Math.max(0,Math.min(wrap.height-110,top)); lantern.style.left = left+'px'; lantern.style.top = top+'px'; });
window.addEventListener('pointerup',(e)=>{ if(!dragging) return; dragging=false; lantern.releasePointerCapture(e.pointerId||0); });
initSim();
drawScene();
drawChart();
running=false;
