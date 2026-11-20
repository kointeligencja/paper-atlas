// Paper renderer: sprites write colour + height into a G-buffer, one lighting pass turns it into a photograph.
'use strict';
const GFX = (() => {
  const cv = document.getElementById('c');
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  const hf = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  const SH = 42; // shadow px per height unit per (px/unit)
  let W = 2, H = 2, W2 = 2, H2 = 2, resScale = 1, fbo = null, tC = null, tH = null, fS0 = null, fS1 = null, tS0 = null, tS1 = null, texBytes = 0;
  const texByteMap = new WeakMap();
  const trackTex = (obj, bytes) => { if (obj) { texByteMap.set(obj, bytes); texBytes += bytes; } };
  const untrackTex = obj => { if (obj && texByteMap.has(obj)) { texBytes -= texByteMap.get(obj); texByteMap.delete(obj); } };
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramParameter(p, gl.LINK_STATUS) ? '' : gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
  const PS = prog(`#version 300 es
  layout(location=0) in vec2 aP; uniform vec4 uA,uB; out vec2 vUV; // uA: m00 m01 m10 m11, uB: tx ty
  void main(){ vec2 q=aP-0.5; vUV=vec2(aP.x,aP.y); gl_Position=vec4(uA.x*q.x+uA.y*q.y+uB.x, uA.z*q.x+uA.w*q.y+uB.y,0.,1.); }`,
  `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uT,uO; uniform float uHasO; uniform vec4 uP; uniform vec4 uQ; uniform vec4 uR; // uP: zpx zrpx alpha reveal ; uQ: wake glow cells seed ; uR: tint rgb, flutter
  layout(location=0) out vec4 oC; layout(location=1) out vec4 oH;
  void main(){ vec2 uv=vUV; if(uR.a>0.){ uv.y+=sin(uv.x*7.-uR.a)*0.05*uv.x; }
    vec4 t=texture(uT,uv); float cov=clamp(t.a*2.,0.,1.)*uP.z; float rel=clamp(t.a*2.-1.,0.,1.);
    if(uP.w<1. && uHasO>0.5){ cov*=step(texture(uO,vUV).r,uP.w); }
    float w=0.; if(uQ.x>=0.){ float p=vUV.x*0.75+vUV.y*0.25; w=exp(-pow((p-uQ.x*1.5+0.25)*4.5,2.)); }
    float dark=1.-smoothstep(0.07,0.2,max(t.r,max(t.g,t.b)));
    if(uR.a>0.) w+=sin(uv.x*7.-uR.a)*0.5*uv.x;
    vec3 col=t.rgb*uR.rgb*(1.+w*0.16);
    if(uQ.z>0.) col=mix(col,vec3(0.96,0.94,0.89),uQ.z);
    oC=vec4(col,cov); oH=vec4(uP.x+rel*uP.y+w*uP.y*(1.2+2.6*rel), dark*uQ.y*step(0.01,rel+dark), 0., cov); }`);
  const PSH = prog(`#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV=aP; gl_Position=vec4(aP*2.-1.,0.,1.); }`,
  `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uH; uniform vec2 uRes,uL; uniform float uShMax,uHScale; out vec4 o;
  void main(){
    vec2 px=1./uRes;
    float h=texture(uH,vUV).r;
    float s=0., maxO=0.;
    for(int i=0;i<10;i++){
      float f=(float(i)+0.5)/10.;
      float d=1.5+f*f*uShMax;
      float hs=texture(uH,vUV+uL*d*px).r;
      float occ=clamp((hs-h-d*0.85)/(0.8+d*0.45),0.,1.);
      maxO=max(maxO,occ*clamp((hs-h)/28.,0.08,1.));
      s+=occ*(1.-s)*0.82;
    }
    o=vec4(clamp(s*1.15,0.,1.), clamp(h/uHScale,0.,1.), maxO, 1.);
  }`);
  const PBL = prog(`#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV=aP; gl_Position=vec4(aP*2.-1.,0.,1.); }`,
  `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uS; uniform vec2 uSRes,uDir; uniform float uHScale,uPass; out vec4 o;
  void main(){
    vec4 c=texture(uS,vUV);
    float hc=c.g*uHScale;
    float spread=mix(0.6,uPass>0.5?2.2:1.5,c.b);
    vec2 stepUV=uDir*(spread/uSRes);
    float sSum=0., wSum=0.;
    for(int i=-3;i<=3;i++){
      float fi=float(i);
      vec4 sp=texture(uS,vUV+stepUV*fi);
      float dh=abs(sp.g*uHScale-hc);
      float wg=exp(-0.22*fi*fi);
      float wh=exp(-dh*dh*1.15);
      float w=wg*wh;
      sSum+=sp.r*w; wSum+=w;
    }
    o=vec4(wSum>1e-4?sSum/wSum:c.r, c.g, c.b, 1.);
  }`);
  const PL = prog(`#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV=aP; gl_Position=vec4(aP*2.-1.,0.,1.); }`,
  `#version 300 es
  precision highp float; in vec2 vUV; uniform sampler2D uC,uH,uS; uniform vec2 uRes,uL; uniform vec4 uCam; uniform float uHud,uHScale; out vec4 o;
  float Hh(vec2 p){ return texture(uH,p).r; }
  float h1(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
  float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y); }
  void main(){ vec2 px=1./uRes, uv=vUV; vec4 c4=texture(uC,uv); float cv=c4.a; vec3 col=uHud>0.5?c4.rgb/max(cv,0.002):c4.rgb; vec4 hh=texture(uH,uv); float h=hh.r;
    float hl=Hh(uv-vec2(px.x,0.)),hr=Hh(uv+vec2(px.x,0.)),hu=Hh(uv+vec2(0.,px.y)),hd=Hh(uv-vec2(0.,px.y));
    vec2 sp=(uv-0.5)*uRes*uCam.w + uCam.xy*vec2(1.,-1.); // paper-anchored pixel space
    float f1=vn(vec2(sp.x*0.9+vn(sp*0.05)*6.,sp.y*0.11)), f2=vn(vec2(sp.x*0.1,sp.y*0.8+vn(sp*0.04+7.)*6.)), f3=vn(sp*0.33), f4=vn(sp*0.012+3.);
    float fib=(f1+f2)*0.5; float tooth=h1(floor(sp*1.0)+0.5);
    vec3 n=normalize(vec3(hl-hr+(f1-0.5)*0.16+(tooth-0.5)*0.1, hd-hu+(f2-0.5)*0.16, 1.7));
    vec3 L=normalize(vec3(uL,0.78)); float dif=clamp(dot(n,L),0.,1.4);
    float sNear=0.;
    for(int i=0;i<4;i++){ float d=0.8+float(i)*1.1; float hs=Hh(uv+uL*d*px); float occ=clamp((hs-h-d*0.85)/(0.65+d*0.35),0.,1.); sNear=max(sNear,occ*(1.-float(i)*0.12)); }
    vec4 sInfo=texture(uS,uv);
    float sFar=sInfo.r*exp(-max(0.,abs(sInfo.g*uHScale-h)-max(2.,uHScale*0.014))*0.5);
    float s=clamp(max(sNear*0.92,sFar),0.,1.);
    float ao=0.; vec2 e=px*2.2; ao+=clamp(Hh(uv+e)-h,0.,2.5)+clamp(Hh(uv-e)-h,0.,2.5)+clamp(Hh(uv+vec2(e.x,-e.y))-h,0.,2.5)+clamp(Hh(uv+vec2(-e.x,e.y))-h,0.,2.5);
    float drop=h-min(min(hl,hr),min(hu,hd)); float core=smoothstep(0.35,1.6,drop);
    float lum=dot(col,vec3(0.3,0.59,0.11));
    col=mix(col,col*0.55+vec3(0.47,0.45,0.41),core*0.42*smoothstep(0.02,0.3,lum+0.08));
    col*=1.+(fib-0.5)*0.085+(f3-0.5)*0.05+(f4-0.5)*0.07; col+=(fib-0.45)*0.035*(1.-lum)+(tooth-0.5)*0.012;
    float lit=0.5+0.84*dif; lit*=1.+0.13*dot((uv-0.5)*2.,uL);
    col*=lit; col*=mix(vec3(1.),vec3(0.36,0.4,0.52),s*0.8); col*=1.-ao*0.035;
    col+=vec3(1.,0.6,0.22)*hh.g*1.1;
    col*=vec3(1.03,1.0,0.955); vec2 v=(uv-0.5)*vec2(1.,0.9); col*=1.-dot(v,v)*0.38;
    col=col/(1.+max(col-0.82,0.)*0.6);
    o=uHud>0.5?vec4(col*cv,cv+(1.-cv)*s*0.55):vec4(col,1.); }`);
  const dummyOrd = (() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0])); return t; })();
  const quad = gl.createVertexArray(); gl.bindVertexArray(quad); const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(2, Math.round(innerWidth * dpr * resScale)), h = Math.max(2, Math.round(innerHeight * dpr * resScale));
    if (w === W && h === H && fbo) return; W = w; H = h; cv.width = W; cv.height = H;
    W2 = Math.max(2, Math.floor(W / 2)); H2 = Math.max(2, Math.floor(H / 2));
    if (tC) { gl.deleteTexture(tC); gl.deleteTexture(tH); gl.deleteFramebuffer(fbo); gl.deleteTexture(tS0); gl.deleteTexture(tS1); gl.deleteFramebuffer(fS0); gl.deleteFramebuffer(fS1); }
    const mk = (ifmt, type, tw = W, th = H) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, tw, th, 0, gl.RGBA, type, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    tC = mk(gl.RGBA8, gl.UNSIGNED_BYTE); tH = hf ? mk(gl.RGBA16F, gl.HALF_FLOAT) : mk(gl.RGBA8, gl.UNSIGNED_BYTE);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tC, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tH, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    tS0 = mk(gl.RGBA8, gl.UNSIGNED_BYTE, W2, H2); tS1 = mk(gl.RGBA8, gl.UNSIGNED_BYTE, W2, H2);
    fS0 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fS0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tS0, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    fS1 = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fS1); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tS1, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  }
  // ---- baking ----
  let bakes = 0;
  function bake(w, h) { bakes++; w = Math.max(2, Math.ceil(w)); h = Math.max(2, Math.ceil(h)); const a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = w; a.height = b.height = h; return { w, h, c: a.getContext('2d', { willReadFrequently: true }), g: b.getContext('2d', { willReadFrequently: true }) }; }
  const grey = rel => { const v = Math.round(128 + Math.max(0, Math.min(1, rel)) * 127); return `rgb(${v},${v},${v})`; };
  function paper(b, path, col, rel, rule) { const c = b.c, g = b.g; c.fillStyle = col; c.beginPath(); path(c); c.fill(rule || 'nonzero'); c.strokeStyle = col; c.lineWidth = 1.2 / (b.s || 1); c.lineJoin = 'round'; c.stroke(); g.fillStyle = grey(rel); g.beginPath(); path(g); g.fill(rule || 'nonzero'); }
  function padRGB(d, w, h) {
    const n = w * h;
    let seed = new Uint8Array(n), count = 0;
    for (let i = 0; i < n; i++) if (d[i * 4 + 3] >= 24) { seed[i] = 1; count++; }
    if (count === 0) { for (let i = 0; i < n; i++) if (d[i * 4 + 3] > 0) seed[i] = 1; }
    let next = new Uint8Array(seed);
    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (seed[idx]) continue;
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        const y0 = y > 0 ? y - 1 : 0, y1 = y + 1 < h ? y + 1 : h - 1;
        const x0 = x > 0 ? x - 1 : 0, x1 = x + 1 < w ? x + 1 : w - 1;
        for (let ny = y0; ny <= y1; ny++) for (let nx = x0; nx <= x1; nx++) {
          const ni = ny * w + nx;
          if (seed[ni]) { const p = ni * 4; sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; cnt++; }
        }
        if (cnt > 0) {
          const p = idx * 4;
          d[p] = (sr / cnt) | 0; d[p + 1] = (sg / cnt) | 0; d[p + 2] = (sb / cnt) | 0;
          next[idx] = 1; changed = true;
        }
      }
      if (!changed) break;
      seed.set(next);
    }
  }
  function tex(b, opt = {}) {
    const cd = b.c.getImageData(0, 0, b.w, b.h), hd = b.g.getImageData(0, 0, b.w, b.h).data, d = cd.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = (hd[i] * hd[i + 3] + 127) / 255 | 0;
    if (opt.pad !== false) padRGB(d, b.w, b.h);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cd);
    if (opt.noMip) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } else {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    b.c.canvas.width = b.g.canvas.width = 1;
    const bytes = b.w * b.h * 4 * (opt.noMip ? 1 : 1.34);
    const obj = { t, w: b.w, h: b.h, bytes };
    trackTex(obj, bytes);
    return obj;
  }
  function ordTex(canvas) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const bytes = canvas.width * canvas.height * 4;
    canvas.width = 1; return { t, bytes };
  }
  function freeTex(t) {
    if (!t) return;
    untrackTex(t);
    if (t.t) gl.deleteTexture(t.t);
    if (t.ord) {
      if (t.ord.t) { texBytes -= (t.ord.bytes || 0); gl.deleteTexture(t.ord.t); }
      else gl.deleteTexture(t.ord);
    }
  }
  // ---- frame ----
  // cam: {x,y,h}; sprites sorted by order. sprite: {tex,x,y,w,h,rot,sc,z,zr,lift,hud,alpha,reveal,wake,glow,cells,seed,tint,flut,sx}
  function gbuf(list, cam, clr, asp) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, W, H); gl.disable(gl.SCISSOR_TEST); gl.clearBufferfv(gl.COLOR, 0, clr); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 1]);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(PS.p); gl.bindVertexArray(quad);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(PS.u.uT, 0);
    gl.activeTexture(gl.TEXTURE1); gl.uniform1i(PS.u.uO, 1); gl.bindTexture(gl.TEXTURE_2D, dummyOrd); gl.uniform1f(PS.u.uHasO, 0);
    let lastO = dummyOrd, lastHasO = 0;
    const ppuW = H / cam.h, ppuH = H / 1000;
    for (const s of list) {
      if (!s.tex || s.alpha <= 0.004) continue;
      const sc = s.sc * (1 + s.lift * 0.22), w = s.w * sc * (s.sx === undefined ? 1 : s.sx), h = s.h * sc, co = Math.cos(s.rot), si = Math.sin(s.rot);
      let kx, ky, tx, ty, zp, a00, a01, a10, a11;
      if (s.hud && Math.abs(s.rot) < 1e-4 && s.lift < 1e-4) {
        const pxW = W / (1000 * asp), pxH = H / 1000;
        const pw = Math.max(1, Math.round(w * pxW)), ph = Math.max(1, Math.round(h * pxH));
        const px0 = Math.round((s.x - w * 0.5) * pxW), py0 = Math.round((s.y - h * 0.5) * pxH);
        const cx = px0 + pw * 0.5, cy = py0 + ph * 0.5;
        if (cx + pw < 0 || cx - pw > W || cy + ph < 0 || cy - ph > H) continue;
        a00 = (pw / W) * 2; a01 = 0; a10 = 0; a11 = -(ph / H) * 2;
        tx = (cx / W) * 2 - 1; ty = 1 - (cy / H) * 2;
        zp = SH * ppuH * 3.2;
      } else {
        if (s.hud) { kx = 2 / (1000 * asp); ky = -2 / 1000; tx = s.x * kx - 1; ty = s.y * ky + 1; zp = SH * ppuH * 3.2; }
        else { kx = 2 / (cam.h * asp); ky = -2 / cam.h; tx = (s.x - cam.x) * kx; ty = (s.y - cam.y) * ky; zp = SH * ppuW; }
        if (Math.abs(tx) > 1 + (Math.abs(w) + Math.abs(h)) * Math.abs(kx) || Math.abs(ty) > 1 + (Math.abs(w) + Math.abs(h)) * Math.abs(ky)) continue;
        a00 = co * w * kx; a01 = -si * h * kx; a10 = si * w * ky; a11 = co * h * ky;
      }
      const ordObj = s.tex.ord;
      const ot = (ordObj && s.reveal < 1) ? (ordObj.t || ordObj) : dummyOrd;
      const hasO = (ordObj && s.reveal < 1) ? 1 : 0;
      if (ot !== lastO) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ot); lastO = ot; }
      if (hasO !== lastHasO) { gl.uniform1f(PS.u.uHasO, hasO); lastHasO = hasO; }
      gl.uniform4f(PS.u.uA, a00, a01, a10, a11); gl.uniform4f(PS.u.uB, tx, ty, 0, 0);
      gl.uniform4f(PS.u.uP, (s.z + s.lift) * zp, s.zr * zp, s.alpha, s.reveal); gl.uniform4f(PS.u.uQ, s.wake, s.glow, s.wash || 0, s.seed);
      const t = s.tint; gl.uniform4f(PS.u.uR, t ? t[0] : 1, t ? t[1] : 1, t ? t[2] : 1, s.flut || 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  function hudScissors(hud, asp) {
    const pad = Math.ceil(68 * H / 1080) + 4;
    const mkBox = () => [1e9, 1e9, -1e9, -1e9];
    const add = (box, x0, y0, x1, y1) => { box[0] = Math.min(box[0], x0); box[1] = Math.min(box[1], y0); box[2] = Math.max(box[2], x1); box[3] = Math.max(box[3], y1); };
    const top = mkBox(), rail = mkBox(), pick = mkBox();
    for (const s of hud) {
      if (!s.tex || s.alpha <= 0.004) continue;
      const sc = s.sc * (1 + s.lift * 0.22), w = Math.abs(s.w * sc * (s.sx === undefined ? 1 : s.sx)) * W / (1000 * asp), h = Math.abs(s.h * sc) * H / 1000;
      const co = Math.abs(Math.cos(s.rot)), si = Math.abs(Math.sin(s.rot)), hw = (co * w + si * h) * 0.5 + pad, hh = (si * w + co * h) * 0.5 + pad;
      const px = s.x / (1000 * asp) * W, py = (1 - s.y / 1000) * H;
      const box = s.rail ? rail : s.pick ? pick : top;
      add(box, Math.floor(px - hw), Math.floor(py - hh), Math.ceil(px + hw), Math.ceil(py + hh));
    }
    const clampBox = b => { b[0] = Math.max(0, b[0]); b[1] = Math.max(0, b[1]); b[2] = Math.min(W, b[2]); b[3] = Math.min(H, b[3]); return b[2] > b[0] && b[3] > b[1]; };
    const out = []; const hasTop = clampBox(top), hasRail = clampBox(rail), hasPick = clampBox(pick);
    if (hasTop && hasPick && pick[3] > top[1]) {
      out.push([Math.min(top[0], pick[0]), Math.min(top[1], pick[1]), Math.max(top[2], pick[2]), Math.max(top[3], pick[3])]);
    } else {
      if (hasTop) out.push(top);
      if (hasPick) out.push(pick);
    }
    if (hasRail) { if (hasTop && rail[3] > top[1]) rail[3] = top[1]; if (rail[3] > rail[1]) out.push(rail); }
    return out;
  }
  function shadowPasses(cam, light, hud, boxes) {
    const shMax = 64 * H / 1080;
    const hScale = Math.max(180, SH * (hud ? (H / 1000) * 3.2 * 0.65 : (H / Math.max(40, cam.h)) * 0.7));
    const drawQuad = padPx => {
      if (!hud) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      else for (const b of boxes) {
        const x0 = Math.max(0, Math.floor(b[0] * 0.5) - padPx), y0 = Math.max(0, Math.floor(b[1] * 0.5) - padPx);
        const x1 = Math.min(W2, Math.ceil(b[2] * 0.5) + padPx), y1 = Math.min(H2, Math.ceil(b[3] * 0.5) + padPx);
        if (x1 > x0 && y1 > y0) { gl.scissor(x0, y0, x1 - x0, y1 - y0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
      }
    };
    gl.disable(gl.BLEND); gl.bindVertexArray(quad);
    if (hud) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, W2, H2);
    // S1: directional height raymarch -> fS0
    gl.bindFramebuffer(gl.FRAMEBUFFER, fS0);
    gl.useProgram(PSH.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tH); gl.uniform1i(PSH.u.uH, 0);
    gl.uniform2f(PSH.u.uRes, W, H); gl.uniform2f(PSH.u.uL, light[0], light[1]);
    gl.uniform1f(PSH.u.uShMax, shMax); gl.uniform1f(PSH.u.uHScale, hScale);
    drawQuad(12);
    // S2: height-aware blur along light -> fS1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fS1);
    gl.useProgram(PBL.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS0); gl.uniform1i(PBL.u.uS, 0);
    gl.uniform2f(PBL.u.uSRes, W2, H2); gl.uniform2f(PBL.u.uDir, light[0], light[1]);
    gl.uniform1f(PBL.u.uHScale, hScale); gl.uniform1f(PBL.u.uPass, 0);
    drawQuad(7);
    // S3: height-aware blur perpendicular to light -> fS0
    gl.bindFramebuffer(gl.FRAMEBUFFER, fS0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS1); gl.uniform1i(PBL.u.uS, 0);
    gl.uniform2f(PBL.u.uDir, -light[1], light[0]);
    gl.uniform1f(PBL.u.uPass, 1);
    drawQuad(2);
    gl.disable(gl.SCISSOR_TEST);
    return hScale;
  }
  function lightPass(cam, light, hud, boxes, hScale) {
    const ppuW = H / cam.h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(PL.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tC); gl.uniform1i(PL.u.uC, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tH); gl.uniform1i(PL.u.uH, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tS0); gl.uniform1i(PL.u.uS, 2);
    gl.uniform2f(PL.u.uRes, W, H); gl.uniform2f(PL.u.uL, light[0], light[1]);
    gl.uniform4f(PL.u.uCam, hud ? 0 : cam.x * ppuW * (1080 / H), hud ? 0 : cam.y * ppuW * (1080 / H), 0, 1080 / H);
    gl.uniform1f(PL.u.uHud, hud ? 1 : 0); gl.uniform1f(PL.u.uHScale, hScale);
    if (!hud) { gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    else if (boxes.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.SCISSOR_TEST);
      for (const b of boxes) { gl.scissor(b[0], b[1], b[2] - b[0], b[3] - b[1]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
      gl.disable(gl.SCISSOR_TEST);
    }
    gl.activeTexture(gl.TEXTURE0);
  }
  function draw(sprites, cam, light) {
    resize(); const asp = W / H; const world = [], hud = []; for (const s of sprites) (s.hud ? hud : world).push(s);
    gbuf(world, cam, [0.62, 0.58, 0.52, 1], asp);
    const hScaleW = shadowPasses(cam, light, false, null);
    lightPass(cam, light, false, null, hScaleW);
    const boxes = hudScissors(hud, asp);
    if (boxes.length) {
      gbuf(hud, cam, [0, 0, 0, 0], asp);
      const hScaleH = shadowPasses(cam, light, true, boxes);
      lightPass(cam, light, true, boxes, hScaleH);
    }
  }
  return { gl, cv, bake, paper, tex, ordTex, freeTex, draw, resize, grey, size: () => [W, H], texBytes: () => texBytes, bakes: () => bakes, setScale: s => { resScale = s; }, getScale: () => resScale };
})();
