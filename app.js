let PoseLandmarker = null;
let FilesetResolver = null;

const $ = (id) => document.getElementById(id);
const els = {
  modelStatus:$("modelStatus"), lib:$("libStatus"), wasm:$("wasmStatus"),
  model:$("modelLoadStatus"), delegate:$("delegateStatus"), test:$("testStatus"),
  error:$("errorBox"), retry:$("retryBtn"), file:$("videoFile"), video:$("video"),
  meta:$("videoMeta"), analyze:$("analyzeBtn"), fps:$("fps"), resolution:$("resolution"),
  progress:$("progressBar"), progressText:$("progressText"), info:$("analysisInfo"),
  canvas:$("poseCanvas"), play:$("playBtn"), slow:$("slowBtn"), prev:$("prevBtn"),
  next:$("nextBtn"), timeline:$("timeline")
};

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
let pose = null, delegate = null, objectUrl = null, analysis = [], lastTime = -1;
let slowRates = [1, .5, .25], slowIndex = 0;

function setDiag(el, text, ok=false, bad=false){
  el.textContent = (ok ? "✓ " : bad ? "✕ " : "⏳ ") + text;
  el.style.color = ok ? "#65e59b" : bad ? "#ff7c7c" : "#ffd36b";
}
function setStatus(text, cls="loading"){ els.modelStatus.textContent=text; els.modelStatus.className=`status ${cls}`; }
function showError(title, err){
  const detail = err?.stack || err?.message || String(err);
  els.error.textContent = `${title}\n\n${detail}\n\nBrowser: ${navigator.userAgent}`;
  els.error.classList.remove("hidden"); els.retry.classList.remove("hidden");
  setStatus("● AI 錯誤","error");
}
function clearError(){ els.error.classList.add("hidden"); els.retry.classList.add("hidden"); }

async function loadLibrary(){
  setStatus("● 載入 AI Library…","loading");
  setDiag(els.lib,"載入中"); setDiag(els.wasm,"等待"); setDiag(els.model,"等待");
  setDiag(els.delegate,"等待"); setDiag(els.test,"未測試");

  const urls = [
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
  ];
  let lastError = null;
  for (const url of urls){
    try{
      els.info.textContent = `正在載入 AI Library：${url}`;
      const mod = await import(url);
      if (!mod.PoseLandmarker || !mod.FilesetResolver) {
        throw new Error("Library loaded, but PoseLandmarker / FilesetResolver export not found.");
      }
      PoseLandmarker = mod.PoseLandmarker;
      FilesetResolver = mod.FilesetResolver;
      setDiag(els.lib,"import 成功",true);
      return true;
    }catch(e){ lastError=e; }
  }
  throw lastError || new Error("所有 AI Library CDN 都無法載入。");
}

async function loadPose(){
  clearError(); pose=null; delegate=null;
  try{
    await loadLibrary();
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    setDiag(els.wasm,"WASM runtime OK",true);

    try{
      setStatus("● 載入 Pose Model · GPU…","loading");
      els.info.textContent="正在初始化 Pose Model…";
      pose = await PoseLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:MODEL_URL, delegate:"GPU"},
        runningMode:"VIDEO",numPoses:1,
        minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45
      });
      delegate="GPU";
    }catch(gpuError){
      setStatus("● GPU 不支援，切換 CPU…","loading");
      els.info.textContent="GPU 初始化失敗，正在嘗試 CPU…";
      pose = await PoseLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:MODEL_URL, delegate:"CPU"},
        runningMode:"VIDEO",numPoses:1,
        minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45
      });
      delegate="CPU";
    }

    setDiag(els.model,"Pose model loaded",true);
    setDiag(els.delegate,delegate,true);
    setStatus(`● AI Ready · ${delegate}`,"ready");
    els.info.textContent=`AI 已真正初始化完成（${delegate}）。選擇影片後可以開始分析。`;
    updateAnalyze();
    return true;
  }catch(e){
    setDiag(els.model,"failed",false,true);
    setDiag(els.delegate,"failed",false,true);
    showError("AI 初始化失敗。以下係真正錯誤：",e);
    return false;
  }
}

function updateAnalyze(){
  els.analyze.disabled = !(pose && els.file.files?.length);
}
els.retry.onclick=()=>loadPose();

els.file.onchange=()=>{
  const f=els.file.files?.[0]; if(!f)return;
  if(objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(f); els.video.src=objectUrl;
  els.video.onloadedmetadata=()=>{
    els.meta.textContent=`${f.name} · ${(f.size/1024/1024).toFixed(2)} MB · ${els.video.videoWidth}×${els.video.videoHeight} · ${els.video.duration.toFixed(2)}s`;
    resizeCanvas(); updateAnalyze(); drawCurrent(null);
  };
};

function resizeCanvas(){
  const r=els.video.getBoundingClientRect();
  if(!r.width || !r.height)return;
  els.canvas.width=Math.round(r.width*devicePixelRatio);
  els.canvas.height=Math.round(r.height*devicePixelRatio);
  els.canvas.style.width=r.width+"px"; els.canvas.style.height=r.height+"px";
}
window.addEventListener("resize",resizeCanvas);

function angle(a,b,c){
  if(!a||!b||!c)return null;
  const ab={x:a.x-b.x,y:a.y-b.y}, cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y;
  const den=Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y);
  if(!den)return null;
  return Math.round(Math.acos(Math.max(-1,Math.min(1,dot/den)))*180/Math.PI);
}
function lineAngle(a,b){return Math.round(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);}
function setMetric(id,v){$(id).textContent=v==null?"—":`${v}°`;}

function drawPose(lm){
  const ctx=els.canvas.getContext("2d"), w=els.canvas.width, h=els.canvas.height;
  ctx.clearRect(0,0,w,h); if(!lm)return;
  const sx=w, sy=h;
  ctx.lineWidth=Math.max(2,3*devicePixelRatio); ctx.strokeStyle="#59e38e"; ctx.fillStyle="#ffffff";
  const links=[
    [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],
    [23,25],[25,27],[24,26],[26,28],[27,31],[28,32]
  ];
  for(const [a,b] of links){const p=lm[a],q=lm[b]; if(!p||!q)continue;
    ctx.beginPath();ctx.moveTo(p.x*sx,p.y*sy);ctx.lineTo(q.x*sx,q.y*sy);ctx.stroke();}
  for(const p of lm){if(p.visibility!=null&&p.visibility<.35)continue;ctx.beginPath();ctx.arc(p.x*sx,p.y*sy,4*devicePixelRatio,0,Math.PI*2);ctx.fill();}
}
function updateMetrics(lm){
  if(!lm)return;
  setMetric("leftElbow",angle(lm[11],lm[13],lm[15]));
  setMetric("rightElbow",angle(lm[12],lm[14],lm[16]));
  setMetric("leftKnee",angle(lm[23],lm[25],lm[27]));
  setMetric("rightKnee",angle(lm[24],lm[26],lm[28]));
  $("shoulderAngle").textContent=`${lineAngle(lm[11],lm[12])}°`;
  $("hipAngle").textContent=`${lineAngle(lm[23],lm[24])}°`;
}
function drawCurrent(lm){drawPose(lm);updateMetrics(lm);}

async function detectAtCurrent(){
  if(!pose||!els.video.videoWidth)return;
  const t=Math.max(0,els.video.currentTime*1000);
  if(t<=lastTime)lastTime=t+1; else lastTime=t;
  try{
    const result=pose.detectForVideo(els.video,lastTime);
    const lm=result?.landmarks?.[0] || null;
    drawCurrent(lm);
    return lm;
  }catch(e){ showError("單格 Pose 推理失敗：",e); return null; }
}

els.play.onclick=async()=>{
  if(els.video.paused){await els.video.play();els.play.textContent="⏸ 暫停";}
  else{els.video.pause();els.play.textContent="▶ 播放";}
};
els.video.addEventListener("pause",()=>els.play.textContent="▶ 播放");
els.video.addEventListener("timeupdate",()=>{if(!els.video.paused)detectAtCurrent(); els.timeline.value=els.video.duration?Math.round(els.video.currentTime/els.video.duration*1000):0;});
els.slow.onclick=()=>{slowIndex=(slowIndex+1)%slowRates.length;els.video.playbackRate=slowRates[slowIndex];els.slow.textContent=`🐢 ${slowRates[slowIndex]}×`;};
els.prev.onclick=async()=>{els.video.pause();els.video.currentTime=Math.max(0,els.video.currentTime-1/(+els.fps.value));await new Promise(r=>setTimeout(r,30));detectAtCurrent();};
els.next.onclick=async()=>{els.video.pause();els.video.currentTime=Math.min(els.video.duration,els.video.currentTime+1/(+els.fps.value));await new Promise(r=>setTimeout(r,30));detectAtCurrent();};
els.timeline.oninput=async()=>{if(!els.video.duration)return;els.video.pause();els.video.currentTime=els.video.duration*(+els.timeline.value/1000);await new Promise(r=>setTimeout(r,30));detectAtCurrent();};

els.analyze.onclick=async()=>{
  if(!pose||!els.video.duration)return;
  els.video.pause(); analysis=[]; lastTime=-1;
  const fps=+els.fps.value, step=1/fps, total=Math.max(1,Math.ceil(els.video.duration*fps));
  els.analyze.disabled=true; els.info.textContent=`正在分析：${total} 個取樣 frame`;
  for(let i=0;i<total;i++){
    const sec=Math.min(els.video.duration-.001,i*step);
    els.video.currentTime=sec;
    await new Promise(resolve=>{
      const done=()=>{els.video.removeEventListener("seeked",done);resolve();};
      els.video.addEventListener("seeked",done,{once:true});
    });
    const lm=await detectAtCurrent();
    analysis.push({time:sec,landmarks:lm});
    const pct=Math.round((i+1)/total*100);
    els.progress.style.width=pct+"%";els.progressText.textContent=pct+"%";
    if(i%8===0)await new Promise(r=>requestAnimationFrame(r));
  }
  els.test.textContent=`✓ ${analysis.filter(x=>x.landmarks).length}/${analysis.length} frames`;
  els.test.style.color="#65e59b";
  els.info.textContent=`✓ 分析完成：${analysis.length} frames · ${fps} FPS · ${els.resolution.value}px`;
  els.analyze.disabled=false;
};

loadPose();
