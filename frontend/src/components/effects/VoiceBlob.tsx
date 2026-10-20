"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interactive "voice AI" particle blob: a noise-deformed sphere of points that
 * swells and glows under the cursor. Plain WebGL (no three.js), so it adds
 * nothing to the bundle. It fills its parent, and the parent is the hover area,
 * so give the parent a size and `position: relative`.
 */
interface VoiceBlobProps {
  className?: string;
  /** Dot colour on the lit side. */
  color?: string;
  /** Colour the dots fade into toward the bottom (usually the panel background). */
  fadeColor?: string;
  /** Colour of the bloom under the cursor. */
  glowColor?: string;
  /** Number of dots on the sphere. */
  pointCount?: number;
  /** How far the noise pushes the surface in and out. */
  amplitude?: number;
  /** Base dot size before perspective. */
  pointSize?: number;
  /** Dot opacity, 0 to 1. */
  opacity?: number;
  /** React to the cursor. */
  interactive?: boolean;
}

const VERTEX_SHADER = `
attribute vec3 aPos;
uniform mat4 uProj, uView, uModel;
uniform float uTime, uAmp, uSize, uDpr;
uniform mediump float uHover;
uniform mediump vec3 uCursor;
varying mediump vec3 vN;
varying mediump vec3 vP;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nm.x; p1*=nm.y; p2*=nm.z; p3*=nm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main(){
  vec3 n=normalize(aPos);
  vec3 pos=aPos+n*snoise(aPos*1.7+uTime*0.28)*uAmp;
  // swell the surface under the cursor
  float cd=length(pos.xy-uCursor.xy);
  pos+=n*exp(-cd*cd*2.0)*uHover*0.42;
  vN=n; vP=pos;
  vec4 mv=uView*uModel*vec4(pos,1.0);
  gl_Position=uProj*mv;
  // perspective-correct dot size keeps the sphere reading as a volume
  gl_PointSize=max(1.0,uSize*uDpr/max(-mv.z,0.25));
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uA, uB, uLight, uGlow;
uniform float uAlpha;
uniform mediump vec3 uCursor;
uniform mediump float uHover;
varying mediump vec3 vN;
varying mediump vec3 vP;

void main(){
  vec3 n=normalize(vN);
  float diff=max(dot(n,normalize(uLight-vP)),0.0);
  float fres=pow(1.0-abs(dot(n,vec3(0.0,0.0,1.0))),2.0);
  vec3 base=uA*(1.0+diff*0.55);
  float g=clamp(0.5-vP.y*0.42,0.0,1.0);
  g=mix(g,min(1.0,g+fres*0.35),0.3);
  vec3 col=mix(base,uB,g);
  float cd=length(vP.xy-uCursor.xy);
  col=mix(col,uGlow,clamp(exp(-cd*cd*2.4)*uHover*0.9,0.0,1.0));
  // discard rather than fade out: depth testing is on, so a transparent corner
  // would still write depth and punch holes in the dots behind it
  vec2 pc=gl_PointCoord-vec2(0.5);
  float rr=dot(pc,pc)*4.0;
  if(rr>1.0) discard;
  gl_FragColor=vec4(col,uAlpha*smoothstep(1.0,0.45,rr));
}`;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Evenly spread points on a unit sphere (Fibonacci), lightly jittered so no rows show. */
function spherePoints(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const jitter = 0.42 * Math.sqrt((4 * Math.PI) / count);
  // seeded xorshift so the blob looks the same on every load
  let seed = 2654435769 >>> 0;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = golden * i;
    const px = Math.cos(a) * r + (rand() - 0.5) * jitter;
    const py = y + (rand() - 0.5) * jitter;
    const pz = Math.sin(a) * r + (rand() - 0.5) * jitter;
    const len = Math.hypot(px, py, pz) || 1;
    out[i * 3] = px / len;
    out[i * 3 + 1] = py / len;
    out[i * 3 + 2] = pz / len;
  }
  return out;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}

function translationZ(z: number): Float32Array {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  m[14] = z;
  return m;
}

/** Rotation about X by `rx` then Y by `ry`. */
function rotationXY(rx: number, ry: number): Float32Array {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  return new Float32Array([cy, 0, -sy, 0, sx * sy, cx, sx * cy, 0, cx * sy, -sx, cx * cy, 0, 0, 0, 0, 1]);
}

export default function VoiceBlob({
  className,
  color = "#5463ff",
  fadeColor = "#000000",
  glowColor = "#dbe6ff",
  pointCount = 26000,
  amplitude = 0.22,
  pointSize = 7.2,
  opacity = 0.84,
  interactive = true,
}: VoiceBlobProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const host = wrap?.parentElement;
    if (!wrap || !host) return;

    // A fresh canvas per mount: cleanup loses the GL context, and a canvas hands
    // back that same dead context forever (StrictMode remounts would hit it).
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    wrap.appendChild(canvas);

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) {
      canvas.remove();
      setUnsupported(true);
      return;
    }
    const loseContext = () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      loseContext();
      setUnsupported(true);
      return;
    }
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, spherePoints(pointCount), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const loc = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1f(loc("uAmp"), amplitude);
    gl.uniform1f(loc("uSize"), pointSize);
    gl.uniform1f(loc("uAlpha"), opacity);
    gl.uniform3fv(loc("uA"), hexToRgb(color));
    gl.uniform3fv(loc("uB"), hexToRgb(fadeColor));
    gl.uniform3fv(loc("uGlow"), hexToRgb(glowColor));
    gl.uniformMatrix4fv(loc("uView"), false, translationZ(-3.35));
    const u = {
      proj: loc("uProj"),
      dpr: loc("uDpr"),
      model: loc("uModel"),
      time: loc("uTime"),
      cursor: loc("uCursor"),
      hover: loc("uHover"),
      light: loc("uLight"),
    };

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // target cursor (-1..1) and hover, eased toward each frame
    let mouseX = 0, mouseY = 0, hoverTarget = 0, hover = 0;
    const cursor = new Float32Array(3);
    const light = new Float32Array([0, 0, 4.2]);

    const draw = (t: number) => {
      cursor[0] += (mouseX * 1.55 - cursor[0]) * 0.12;
      cursor[1] += (mouseY * 1.55 - cursor[1]) * 0.12;
      hover += (hoverTarget - hover) * 0.07;
      light[0] = mouseX * 3.2;
      light[1] = mouseY * 3.2;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(u.model, false, rotationXY(t * 0.04, t * 0.093));
      gl.uniform1f(u.time, t);
      gl.uniform3fv(u.cursor, cursor);
      gl.uniform1f(u.hover, hover);
      gl.uniform3fv(u.light, light);
      gl.drawArrays(gl.POINTS, 0, pointCount);
    };

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      draw((now - start) / 1000);
    };

    // sizes the canvas to its box and pauses while the box is hidden (e.g. display: none below lg)
    const resize = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = entry.contentRect;
      const w = Math.max(1, Math.round(width * dpr));
      const h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniformMatrix4fv(u.proj, false, perspective(1.15, w / h, 0.1, 100));
        gl.uniform1f(u.dpr, dpr);
      }
      if (width < 1 || height < 1) {
        cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (reducedMotion) draw(2.4);
      else if (!frame) frame = requestAnimationFrame(tick);
    });
    resize.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      hoverTarget = 1;
    };
    const onLeave = () => {
      hoverTarget = 0;
    };
    const listen = interactive && !reducedMotion;
    if (listen) {
      host.addEventListener("mousemove", onMove);
      host.addEventListener("mouseleave", onLeave);
    }

    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      if (listen) {
        host.removeEventListener("mousemove", onMove);
        host.removeEventListener("mouseleave", onLeave);
      }
      loseContext();
    };
  }, [color, fadeColor, glowColor, pointCount, amplitude, pointSize, opacity, interactive]);

  if (unsupported) {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(60% 46% at 50% 44%, ${color}4d, ${color}1a 55%, transparent 76%)` }}
      />
    );
  }

  return <div ref={wrapRef} aria-hidden="true" className={className} style={{ position: "absolute", inset: 0 }} />;
}
