import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";

const $=id=>document.getElementById(id);
const videoInput=$("videoInput"),video=$("video"),canvas=$("poseCanvas"),ctx=canvas.getContext("2d");
const analyzeBtn=$("analyzeBtn"),modelStatus=$("modelStatus"),errorBox=$("errorBox"),errorText=$("errorText");
const retryBtn=$("retryBtn"),emptyState=$("emptyState"),timeline=$("timeline"),playBtn=$("playBtn"),slowBtn=$("slowBtn");
const prevBtn=$("prevBtn"),nextBtn=$("nextBtn"),frameLabel=$("frameLabel"),progressWrap=$("progressWrap");
const progressBar=$("progressBar"),progressText=$("progressText"),progressPercent=$("progressPercent");
const videoMeta=$("videoMeta"),analysisState=$("analysisState");

let poseLandmarker=null,videoUrl=null,frames=[],frameIndex=0,targetFps=30,analysisWidth=960,raf=0,lastDraw=0;
const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32],[0,11],[0,12]];

function setStatus(text,kind){modelStatus.textContent=text;modelStatus.className=`status ${kind}`;}
function showError(message){errorText.textContent=message;errorBox.classList.remove("hidden");setStatus("● AI 錯誤","error");}
function clearError(){errorBox.classList.add("hidden");}

async function createLandmarker(delegate){
  const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
  return PoseLandmarker.createFromOptions(vision,{
    baseOptions:{
      modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      delegate
    },
    runningMode:"VIDEO",numPoses:1,
    minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45
  });
}

async function loadPose(){
  clearError();analyzeBtn.disabled=true;setStatus("● 載入 AI…","loading");
  try{
    try{
      poseLandmarker=await createLandmarker("GPU");
      setStatus("● AI Ready · GPU","ready");
    }catch(gpuError){
      console.warn("GPU failed; falling back to CPU",gpuError);
      setStatus("● GPU 不支援，切換 CPU…","loading");
      poseLandmarker=await createLandmarker("CPU");
      setStatus("● AI Ready · CPU","ready");
    }
    if(video.src) analyzeBtn.disabled=false;
  }catch(err){
    console.error(err);
    poseLandmarker=null;
    showError("無法載入 MediaPipe / Pose 模型。請確認網絡可連接 CDN；如果你是剛更新 GitHub Pages，請等 1–2 分鐘後按「重新載入 AI」。");
  }
}
retryBtn.addEventListener("click",loadPose);

videoInput.addEventListener("change",()=>{
  const file=videoInput.files?.[0];if(!file)return;
  if(videoUrl)URL.revokeObjectURL(videoUrl);
  videoUrl=URL.createObjectURL(file);video.src=videoUrl;video.load();
  emptyState.classList.add("hidden");videoMeta.classList.remove("hidden");
  videoMeta.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;
  frames=[];timeline.disabled=true;analysisState.textContent="未開始";
  [playBtn,slowBtn,prevBtn,nextBtn].forEach(b=>b.disabled=false);
  analyzeBtn.disabled=!poseLandmarker;
});

video.addEventListener("loadedmetadata",()=>{
  videoMeta.textContent+=` · ${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} 秒`;
  timeline.max=Math.max(0,Math.floor(video.duration*targetFps)-1);frameLabel.textContent=`Frame 0 / ${timeline.max}`;resizeCanvas();
});

function resizeCanvas(){
  const rect=video.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
function angle(a,b,c){
  if(!a||!b||!c)return null;
  const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
  const mag=Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y);if(!mag)return null;
  return Math.round(Math.acos(Math.max(-1,Math.min(1,(ab.x*cb.x+ab.y*cb.y)/mag)))*180/Math.PI);
}
function metric(id,v){$(id).textContent=v==null?"—":`${v}°`;}

function drawPose(lm){
  resizeCanvas();const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);if(!lm)return;
  ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle="#55a8ff";
  for(const [a,b] of connections){
    const p=lm[a],q=lm[b];if(!p||!q||Math.min(p.visibility??1,q.visibility??1)<.35)continue;
    ctx.beginPath();ctx.moveTo(p.x*w,p.y*h);ctx.lineTo(q.x*w,q.y*h);ctx.stroke();
  }
  for(const p of lm){
    if((p.visibility??1)<.35)continue;
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.2,0,Math.PI*2);ctx.fillStyle="#4f8cff";ctx.fill();
  }
}
function updateMetrics(lm){
  if(!lm)return;
  metric("leftElbow",angle(lm[11],lm[13],lm[15]));metric("rightElbow",angle(lm[12],lm[14],lm[16]));
  metric("leftKnee",angle(lm[23],lm[25],lm[27]));metric("rightKnee",angle(lm[24],lm[26],lm[28]));
  metric("leftShoulder",angle(lm[13],lm[11],lm[23]));metric("rightShoulder",angle(lm[14],lm[12],lm[24]));
  const shoulder=Math.round(Math.abs(Math.atan2(lm[12].y-lm[11].y,lm[12].x-lm[11].x)*180/Math.PI));
  const hip=Math.round(Math.abs(Math.atan2(lm[24].y-lm[23].y,lm[24].x-lm[23].x)*180/Math.PI));
  metric("shoulderRotation",shoulder);metric("hipRotation",hip);
  $("landmarkText").textContent=`已追蹤 ${lm.length} 個人體 landmarks。低可信度的點會自動略過。`;
}

async function seek(t){
  return new Promise(resolve=>{
    if(Math.abs(video.currentTime-t)<0.003){resolve();return;}
    const done=()=>{video.removeEventListener("seeked",done);resolve()};
    video.addEventListener("seeked",done);video.currentTime=t;
  });
}

async function detectAtCurrent(timestampMs){
  if(!poseLandmarker||video.readyState<2)return null;
  try{
    // MediaPipe VIDEO mode requires monotonically increasing timestamps.
    const result=poseLandmarker.detectForVideo(video,timestampMs);
    return result.landmarks?.[0]||null;
  }catch(e){console.warn("Pose detection failed",e);return null;}
}

analyzeBtn.addEventListener("click",async()=>{
  if(!poseLandmarker){showError("AI 尚未 Ready。請先按「重新載入 AI」。");return}
  targetFps=Number($("analysisFps").value);analysisWidth=Number($("analysisWidth").value);
  frames=[];video.pause();progressWrap.classList.remove("hidden");analysisState.textContent="分析中…";analyzeBtn.disabled=true;
  const total=Math.max(1,Math.ceil(video.duration*targetFps)),step=1/targetFps;
  for(let i=0;i<total;i++){
    const t=Math.min(i*step,Math.max(0,video.duration-.001));await seek(t);
    const lm=await detectAtCurrent(Math.round(t*1000));
    frames.push({time:t,landmarks:lm});
    const pct=Math.round((i+1)/total*100);progressBar.value=pct;progressPercent.textContent=`${pct}%`;
    progressText.textContent=`分析第 ${i+1} / ${total} 格`;
    if(i%4===0)await new Promise(r=>setTimeout(r,0));
  }
  timeline.max=Math.max(0,frames.length-1);timeline.value=0;frameIndex=0;
  analysisState.textContent=`完成 · ${frames.length} frames`;analyzeBtn.disabled=false;showFrame(0);
});

function showFrame(i){
  if(!frames.length)return;frameIndex=Math.max(0,Math.min(frames.length-1,i));const f=frames[frameIndex];
  video.currentTime=f.time;drawPose(f.landmarks);updateMetrics(f.landmarks);timeline.value=frameIndex;
  frameLabel.textContent=`Frame ${frameIndex+1} / ${frames.length}`;
}
timeline.addEventListener("input",()=>showFrame(Number(timeline.value)));
prevBtn.addEventListener("click",()=>showFrame(frameIndex-1));nextBtn.addEventListener("click",()=>showFrame(frameIndex+1));
playBtn.addEventListener("click",()=>{if(video.paused){video.play();playBtn.textContent="⏸ 暫停"}else{video.pause();playBtn.textContent="▶ 播放"}});
slowBtn.addEventListener("click",()=>{const rates=[.25,.5,1],i=rates.indexOf(video.playbackRate);const r=rates[(i+1)%rates.length];video.playbackRate=r;slowBtn.textContent=`🐢 ${r}×`});
video.addEventListener("play",()=>{
  const loop=async now=>{if(video.paused)return;if(now-lastDraw>50){await detectAtCurrent(Math.round(video.currentTime*1000));lastDraw=now}raf=requestAnimationFrame(loop)};
  cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
});
video.addEventListener("pause",()=>cancelAnimationFrame(raf));
window.addEventListener("resize",()=>{resizeCanvas();if(frames.length)drawPose(frames[frameIndex].landmarks)});
loadPose();
