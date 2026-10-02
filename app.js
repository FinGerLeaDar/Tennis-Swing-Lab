import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

const $ = (id) => document.getElementById(id);
const videoInput = $("videoInput");
const video = $("video");
const canvas = $("poseCanvas");
const ctx = canvas.getContext("2d");
const analyzeBtn = $("analyzeBtn");
const modelStatus = $("modelStatus");
const analysisState = $("analysisState");
const emptyState = $("emptyState");
const timeline = $("timeline");
const playBtn = $("playBtn");
const slowBtn = $("slowBtn");
const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const frameLabel = $("frameLabel");
const progressWrap = $("progressWrap");
const progressBar = $("progressBar");
const progressText = $("progressText");
const progressPercent = $("progressPercent");
const videoMeta = $("videoMeta");

let poseLandmarker = null;
let videoUrl = null;
let frames = [];
let frameIndex = 0;
let targetFps = 30;
let analysisWidth = 960;
let raf = null;
let lastDrawTime = 0;

const connections = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],[23,25],[25,27],
  [24,26],[26,28],[27,29],[29,31],[28,30],[30,32],
  [0,11],[0,12]
];

function angle(a,b,c){
  if(!a||!b||!c) return null;
  const ab={x:a.x-b.x,y:a.y-b.y};
  const cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y;
  const mag=Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y);
  if(!mag) return null;
  return Math.round(Math.acos(Math.max(-1,Math.min(1,dot/mag)))*180/Math.PI);
}
function setMetric(id,v){$(id).textContent=v==null?"—":`${v}°`;}

async function loadPose(){
  try{
    modelStatus.textContent="● 載入 AI 模型…";
    const vision=await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );
    poseLandmarker=await PoseLandmarker.createFromOptions(vision,{
      baseOptions:{
        modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
        delegate:"GPU"
      },
      runningMode:"VIDEO",
      numPoses:1,
      minPoseDetectionConfidence:.45,
      minPosePresenceConfidence:.45,
      minTrackingConfidence:.45
    });
    modelStatus.textContent="● AI 模型就緒";
    modelStatus.style.color="#75d39b";
  }catch(err){
    console.error(err);
    modelStatus.textContent="● AI 模型載入失敗";
    modelStatus.style.color="#ff8e8e";
    analysisState.textContent="模型失敗";
  }
}

videoInput.addEventListener("change",()=>{
  const file=videoInput.files?.[0];
  if(!file)return;
  if(videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl=URL.createObjectURL(file);
  video.src=videoUrl;
  video.load();
  emptyState.classList.add("hidden");
  videoMeta.classList.remove("hidden");
  videoMeta.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;
  analyzeBtn.disabled=false;
  frames=[];
  timeline.disabled=true;
  [playBtn,slowBtn,prevBtn,nextBtn].forEach(b=>b.disabled=false);
  analysisState.textContent="未開始";
});

video.addEventListener("loadedmetadata",()=>{
  const fps=30;
  videoMeta.textContent += ` · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} 秒`;
  timeline.max=Math.max(0,Math.floor(video.duration*fps)-1);
  frameLabel.textContent=`Frame 0 / ${timeline.max}`;
  resizeCanvas();
});

function resizeCanvas(){
  const rect=video.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);
  canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function drawPose(landmarks){
  resizeCanvas();
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  if(!landmarks?.length)return;
  ctx.lineWidth=3;
  ctx.lineCap="round";
  ctx.strokeStyle="#55a8ff";
  for(const [a,b] of connections){
    const p=landmarks[a],q=landmarks[b];
    if(!p||!q||Math.min(p.visibility??1,q.visibility??1)<.35)continue;
    ctx.beginPath();ctx.moveTo(p.x*w,p.y*h);ctx.lineTo(q.x*w,q.y*h);ctx.stroke();
  }
  for(const p of landmarks){
    if((p.visibility??1)<.35)continue;
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2);
    ctx.fillStyle="#ffffff";ctx.fill();
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.2,0,Math.PI*2);
    ctx.fillStyle="#4f8cff";ctx.fill();
  }
}

function updateMetrics(lm){
  if(!lm)return;
  const ls=angle(lm[13],lm[11],lm[23]);
  const rs=angle(lm[14],lm[12],lm[24]);
  const le=angle(lm[11],lm[13],lm[15]);
  const re=angle(lm[12],lm[14],lm[16]);
  const lk=angle(lm[23],lm[25],lm[27]);
  const rk=angle(lm[24],lm[26],lm[28]);
  setMetric("leftShoulder",ls);setMetric("rightShoulder",rs);
  setMetric("leftElbow",le);setMetric("rightElbow",re);
  setMetric("leftKnee",lk);setMetric("rightKnee",rk);
  const shoulder=Math.round(Math.abs(Math.atan2(lm[12].y-lm[11].y,lm[12].x-lm[11].x)*180/Math.PI));
  const hip=Math.round(Math.abs(Math.atan2(lm[24].y-lm[23].y,lm[24].x-lm[23].x)*180/Math.PI));
  setMetric("shoulderRotation",shoulder);
  setMetric("hipRotation",hip);
  $("landmarkText").textContent=`已追蹤 ${lm.length} 個人體 landmarks。可見度不足的點會自動略過。`;
}

async function analyzeCurrent(){
  if(!poseLandmarker||video.readyState<2)return;
  try{
    const result=poseLandmarker.detectForVideo(video,performance.now());
    const lm=result.landmarks?.[0]||null;
    if(lm){drawPose(lm);updateMetrics(lm);}
    return lm;
  }catch(e){console.warn(e);}
}

analyzeBtn.addEventListener("click",async()=>{
  if(!poseLandmarker){alert("AI 模型仍在載入，請稍等。");return;}
  targetFps=Number($("analysisFps").value);
  analysisWidth=Number($("analysisWidth").value);
  frames=[];
  video.pause();
  progressWrap.classList.remove("hidden");
  analysisState.textContent="分析中…";
  analyzeBtn.disabled=true;

  const duration=video.duration;
  const total=Math.max(1,Math.ceil(duration*targetFps));
  const step=1/targetFps;
  for(let i=0;i<total;i++){
    const t=Math.min(i*step,Math.max(0,duration-0.001));
    await seekVideo(t);
    const lm=await analyzeCurrent();
    frames.push({time:t,landmarks:lm});
    const pct=Math.round((i+1)/total*100);
    progressBar.value=pct;progressPercent.textContent=`${pct}%`;
    progressText.textContent=`分析第 ${i+1} / ${total} 格`;
    if(i%5===0)await new Promise(r=>setTimeout(r,0));
  }
  timeline.max=Math.max(0,frames.length-1);
  timeline.value=0;
  frameIndex=0;
  analysisState.textContent=`完成 · ${frames.length} frames`;
  analyzeBtn.disabled=false;
  showFrame(0);
});

function seekVideo(t){
  return new Promise(resolve=>{
    const done=()=>{video.removeEventListener("seeked",done);resolve();};
    video.addEventListener("seeked",done);
    video.currentTime=t;
  });
}

function showFrame(i){
  if(!frames.length)return;
  frameIndex=Math.max(0,Math.min(frames.length-1,i));
  const f=frames[frameIndex];
  video.currentTime=f.time;
  drawPose(f.landmarks);
  updateMetrics(f.landmarks);
  timeline.value=frameIndex;
  frameLabel.textContent=`Frame ${frameIndex+1} / ${frames.length}`;
}

timeline.addEventListener("input",()=>showFrame(Number(timeline.value)));
prevBtn.addEventListener("click",()=>showFrame(frameIndex-1));
nextBtn.addEventListener("click",()=>showFrame(frameIndex+1));
playBtn.addEventListener("click",()=>{
  if(video.paused){video.play();playBtn.textContent="⏸ 暫停";}
  else{video.pause();playBtn.textContent="▶ 播放";}
});
slowBtn.addEventListener("click",()=>{
  const rates=[.25,.5,1];
  const current=video.playbackRate;
  const next=rates[(rates.indexOf(current)+1)%rates.length];
  video.playbackRate=next;slowBtn.textContent=`🐢 ${next}×`;
});
video.addEventListener("play",()=>{
  const loop=async(now)=>{
    if(video.paused)return;
    if(now-lastDrawTime>50){await analyzeCurrent();lastDrawTime=now;}
    raf=requestAnimationFrame(loop);
  };
  cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
});
video.addEventListener("pause",()=>cancelAnimationFrame(raf));
window.addEventListener("resize",()=>{resizeCanvas(); if(frames.length)drawPose(frames[frameIndex].landmarks);});

loadPose();
