(function(){
const LV=[[0,'ルーキー','#6b7385',0],[10,'ブロンズ','#c07a3c',1],[30,'シルバー','#c9d2e0',2],[60,'ゴールド','#e8b923',3],[100,'プラチナ','#9fe7ff',4],[200,'レジェンド','#ff5b7a',5]];
const PERKS=['','ゴールの文字がブロンズに輝く','ボールの軌跡が銀色の流れ星に','ゴールで金色の紙吹雪','ゴールでピッチにスポットライト','試合開始とゴールで虹色の花火'];
function xp(){try{return (JSON.parse(localStorage.getItem('quizXP'))||{}).xp||0}catch(e){return 0}}
function lvOf(x){let i=0;LV.forEach((l,k)=>{if(x>=l[0])i=k});return i}
let gid=0;
function emblem(i,size){const l=LV[i],st=l[3];gid++;const id='tg'+gid;
 const stars=[...Array(st)].map((_,k)=>{const x=50+(k-(st-1)/2)*14;return '<path d="M'+x+' 80l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="'+(i===5?'url(#'+id+')':l[2])+'"/>'}).join('');
 const glow=i>=4?'<circle cx="50" cy="44" r="40" fill="none" stroke="'+l[2]+'" stroke-opacity=".35" stroke-width="6"><animate attributeName="r" values="36;42;36" dur="2.4s" repeatCount="indefinite"/></circle>':'';
 const grad='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5b7a"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#6ea8ff"/></linearGradient></defs>';
 const fill=i===5?'url(#'+id+')':l[2];
 return '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true">'+grad+glow+'<path d="M50 8l32 12v22c0 20-14 34-32 40C32 76 18 62 18 42V20z" fill="#11141b" stroke="'+fill+'" stroke-width="5"/><path d="M50 22l18 7v13c0 12-8 20-18 24-10-4-18-12-18-24V29z" fill="'+fill+'" opacity="'+(i?'.95':'.5')+'"/><text x="50" y="52" text-anchor="middle" font-size="16" font-weight="900" fill="#0c0e13" font-family="sans-serif">'+(i+1)+'</text>'+stars+'</svg>'}
function paint(){const x=xp(),i=lvOf(x);document.querySelectorAll('.tbadge').forEach(a=>{a.innerHTML=emblem(i,26)+'<span><small>称号</small><b style="color:'+LV[i][2]+'">'+LV[i][1]+'</b></span>';a.title='クイズ正解'+x+'問。称号を育てる';a.classList.toggle('lv5',i===5);a.classList.toggle('lv4',i===4)})}
/* 演出：ピッチなどの要素の上に、紙吹雪・スポットライト・花火を一瞬だけ重ねる */
function celebrate(host,i,kind){if(!host||i<3)return;try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return}catch(e){}
 const box=document.createElement('div');box.className='celeb';
 let h='';
 if(i>=3&&kind!=='ko'){const cols=i===5?['#ff5b7a','#ffd166','#6ea8ff','#5fd38d','#c58bff']:['#ffd166','#e8b923','#fff3b0','#f5c542'];
  for(let k=0;k<46;k++){h+='<i class="cf" style="--x:'+(Math.random()*100)+'%;--d:'+(0.8+Math.random()*0.9)+'s;--r:'+(Math.random()*720-360)+'deg;--dx:'+(Math.random()*80-40)+'px;background:'+cols[k%cols.length]+';animation-delay:'+(Math.random()*0.25)+'s"></i>'}}
 if(i>=4&&kind!=='ko')h+='<i class="spot"></i>';
 if(i>=5){for(let f=0;f<3;f++){const cx=20+f*30+Math.random()*10,cy=20+Math.random()*25;h+='<span class="fw" style="left:'+cx+'%;top:'+cy+'%;animation-delay:'+(f*0.22)+'s">'+[...Array(14)].map((_,k)=>'<i style="--a:'+(k*360/14)+'deg;background:hsl('+(k*26+f*60)+',95%,65%)"></i>').join('')+'</span>'}}
 box.innerHTML=h;host.appendChild(box);setTimeout(()=>box.remove(),2200)}
window.BLTitle={LV,PERKS,xp,lvOf,emblem,paint,celebrate};
document.addEventListener('DOMContentLoaded',paint);paint();
window.addEventListener('storage',paint);
})();
(function(){
  function init(){
    var btn=document.querySelector('.ln-btn'),pn=document.getElementById('ln-panel');
    if(!btn||!pn)return;
    // いま見ているページに印を付ける
    var here=location.pathname.replace(/\/$/,'/index.html');
    pn.querySelectorAll('.ln-i').forEach(function(a){
      try{var p=new URL(a.getAttribute('href'),location.href).pathname;if(p===here){a.classList.add('cur');a.setAttribute('aria-current','page')}}catch(e){}
    });
    function place(){var r=btn.getBoundingClientRect();pn.style.top=Math.max(8,Math.round(r.bottom+8))+'px';pn.style.right=Math.max(12,Math.round(document.documentElement.clientWidth-r.right))+'px'}
    function open(){place();pn.hidden=false;btn.setAttribute('aria-expanded','true');var f=pn.querySelector('.ln-i');if(f)f.focus({preventScroll:true})}
    function close(back){if(pn.hidden)return;pn.hidden=true;btn.setAttribute('aria-expanded','false');if(back)btn.focus()}
    btn.addEventListener('click',function(ev){ev.stopPropagation();pn.hidden?open():close()});
    document.querySelectorAll('.ln-all').forEach(function(b){b.addEventListener('click',function(ev){ev.stopPropagation();window.scrollTo({top:0});open()})});
    document.addEventListener('click',function(ev){if(!pn.hidden&&!pn.contains(ev.target))close()});
    document.addEventListener('keydown',function(ev){if(ev.key==='Escape')close(true)});
    window.addEventListener('resize',function(){if(!pn.hidden)place()});
    window.addEventListener('scroll',function(){if(!pn.hidden&&btn.getBoundingClientRect().bottom<0)close()},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
