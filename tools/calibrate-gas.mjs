import * as G from '../widgets/engines/gas.js';
let s=777;const rng=()=>(s=s*16807%2147483647)/2147483647;
const Ns=[1,2,3,5,10,20,50,100,200,500,1000,2000,5000,10000];const out=[];const dt=1/60;
for(const N of Ns){const g=G.createGas();for(let i=0;i<N;i++)G.addBall(g,rng);
 for(let i=0;i<120;i++)G.updateDial(g,G.step(g,dt,rng),dt);
 const R=[];const samples=N<=100?3000:N<=1000?800:250;
 for(let r=0;r<samples;r++){let d;for(let i=0;i<15;i++)d=G.updateDial(g,G.step(g,dt,rng),dt);R.push(d);}
 R.sort((a,b)=>a-b);const q=p=>R[Math.min(R.length-1,Math.floor(p*R.length))];const mean=R.reduce((a,b)=>a+b)/R.length;
 out.push([N,+mean.toFixed(4),+q(.025).toFixed(4),+q(.16).toFixed(4),+q(.84).toFixed(4),+q(.975).toFixed(4)]);
 console.error(out.at(-1).join(' '),'disp',(g.px-g.x0).toFixed(4));}
console.log(JSON.stringify(out));
