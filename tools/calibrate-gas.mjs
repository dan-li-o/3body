import * as G from '../widgets/engines/gas.js';
let s=12345;const rng=()=>(s=s*16807%2147483647)/2147483647;
const Ns=[1,2,3,5,8,12,20,30,50,80,120,200,300];const out=[];
for(const N of Ns){const g=G.createGas();for(let i=0;i<N;i++)G.addBall(g,rng);
 for(let i=0;i<300;i++)G.step(g,1/60,rng);
 const R=[];const reps=N<20?8000:N<100?3000:1200;
 for(let r=0;r<reps;r++){G.startReading(g);for(let i=0;i<G.WINDOW*60;i++)G.step(g,1/60,rng);R.push(G.reading(g));}
 R.sort((a,b)=>a-b);const q=p=>R[Math.min(R.length-1,Math.floor(p*R.length))];const mean=R.reduce((a,b)=>a+b)/R.length;
 out.push([N,+mean.toFixed(4),+q(.025).toFixed(4),+q(.16).toFixed(4),+q(.84).toFixed(4),+q(.975).toFixed(4)]);
 console.error(N,out.at(-1).join(' '),'piston',(G.createGas().x0-g.px).toFixed(3));}
console.log(JSON.stringify(out));
