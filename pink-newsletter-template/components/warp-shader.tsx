"use client"

import { useEffect, useRef } from "react"

interface WarpShaderProps {
  proportion?: number
  softness?: number
  distortion?: number
  swirl?: number
  swirlIterations?: number
  shapeScale?: number
  scale?: number
  rotation?: number
  speed?: number
  colors?: string[]
  className?: string
}

export default function WarpShader({
  proportion = 0.45,
  softness = 1.0,
  distortion = 0.8,
  swirl = 1.2,
  swirlIterations = 15,
  shapeScale = 0.3,
  scale = 1.0,
  rotation = 0.0,
  speed = 0.5,
  colors = ["hsl(280, 100%, 20%)", "hsl(290, 100%, 70%)", "hsl(320, 80%, 60%)", "hsl(260, 90%, 40%)"],
  className = "",
}: WarpShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const uniformsRef = useRef<any>({})
  const resizeScheduledRef = useRef<boolean>(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("[v0] Initializing WebGL shader")

    // Initialize WebGL2 context
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: true })
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }
    glRef.current = gl

    // Vertex shader source
    const vertexShaderSource = `#version 300 es
    precision highp float;
    const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
    out vec2 vPos;
    void main(){
      gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
      vPos = verts[gl_VertexID];
    }`

    // Fragment shader source
    const fragmentShaderSource = `#version 300 es
    precision highp float;

    uniform vec2  u_resolution;
    uniform float u_time;
    uniform float u_proportion;
    uniform float u_softness;
    uniform float u_distortion;
    uniform float u_swirl;
    uniform int   u_swirlIterations;
    uniform float u_shapeScale;
    uniform float u_scale;
    uniform float u_rotation;
    uniform float u_speed;
    uniform int   u_colorCount;
    uniform vec3  u_colors[8];

    out vec4 fragColor;

    #define PI 3.1415926535897932384626433832795

    mat2 rot(float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }

    float hash(vec2 p){
      p = fract(p*vec2(123.34, 234.56));
      p += dot(p, p+34.45);
      return fract(p.x*p.y);
    }
    
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      float a=hash(i);
      float b=hash(i+vec2(1.,0.));
      float c=hash(i+vec2(0.,1.));
      float d=hash(i+vec2(1.,1.));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    
    float fbm(vec2 p){
      float v=0., amp=0.5;
      for (int i=0;i<6;i++){
        v += amp*noise(p);
        p *= 2.0; amp *= 0.5;
      }
      return v;
    }

    float fluidPattern(vec2 p, float time) {
      // Multiple layers of flowing noise
      float n1 = fbm(p * 0.8 + vec2(time * 0.1, time * 0.05));
      float n2 = fbm(p * 1.5 + vec2(-time * 0.08, time * 0.12));
      float n3 = fbm(p * 2.2 + vec2(time * 0.06, -time * 0.09));
      
      // Combine layers with different weights
      float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
      
      // Add flowing ridges
      vec2 ridge = p + vec2(sin(p.y * 3.0 + time * 0.2), cos(p.x * 2.5 + time * 0.15)) * 0.3;
      float ridgeNoise = fbm(ridge * 1.8);
      
      return mix(pattern, ridgeNoise, 0.4);
    }

    vec3 palette(float t){
      if (u_colorCount <= 0) return vec3(t);
      if (u_colorCount == 1) return u_colors[0];
      float segs = float(u_colorCount - 1);
      float x = clamp(t,0.0,1.0) * segs;
      float idx = floor(x);
      float f = x - idx;
      int i0 = int(idx);
      int i1 = min(i0+1, u_colorCount-1);
      return mix(u_colors[i0], u_colors[i1], smoothstep(0.0,1.0,f));
    }

    void main(){
      // uv in -1..1, aspect corrected
      vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
      uv.x *= u_resolution.x / u_resolution.y;

      // proportion squish
      uv.y *= mix(0.5, 1.0, clamp(u_proportion, 0.0, 1.0));

      // global rotation / scale
      uv *= rot(u_rotation);
      uv /= max(u_scale, 1e-4);

      float t = u_time * u_speed;

      float n1 = fbm(uv * 1.8 + vec2(t*0.12, t*0.08));
      float n2 = fbm(uv * 2.4 + vec2(-t*0.09, t*0.15));
      float n3 = fbm(uv * 3.1 + vec2(t*0.06, -t*0.11));
      
      vec2 warp1 = vec2(n1, n2) - 0.5;
      vec2 warp2 = vec2(n2, n3) - 0.5;
      
      uv += warp1 * u_distortion * 1.2;
      uv += warp2 * u_distortion * 0.6;

      vec2 p = uv;
      float r = length(p);
      float angle = atan(p.y, p.x);
      
      // Multiple swirl layers
      float base = u_swirl * 2.0 * (1.0 - smoothstep(0.0, 2.0, r));
      int iters = clamp(u_swirlIterations, 0, 32);
      for (int i=0;i<32;i++){
        if (i >= iters) break;
        float a = base * (0.4 + float(i)/float(max(iters,1))) * sin(t * 0.3 + float(i));
        p = rot(a * r * (1.0 + sin(angle * 3.0 + t) * 0.2)) * p;
      }
      uv = p;

      float pattern = fluidPattern(uv * u_shapeScale * 3.0, t);
      
      // Add flowing variations
      float flow1 = fbm(uv * 1.2 + t * 0.05);
      float flow2 = fbm(uv * 2.1 - t * 0.03);
      pattern = mix(pattern, flow1, 0.3);
      pattern = mix(pattern, flow2, 0.2);

      float shade1 = pattern;
      float shade2 = fbm(uv * 1.5 + t * 0.04);
      float shade3 = fbm(uv * 0.8 - t * 0.02);
      
      // Create multiple color layers
      vec3 col1 = palette(shade1);
      vec3 col2 = palette(shade2 * 0.8 + 0.2);
      vec3 col3 = palette(shade3 * 0.6 + 0.4);
      
      // Blend colors for organic appearance
      vec3 col = mix(col1, col2, smoothstep(0.3, 0.7, pattern));
      col = mix(col, col3, smoothstep(0.1, 0.9, flow1) * 0.4);
      
      // Add subtle highlights for liquid metal effect
      float highlight = pow(max(0.0, pattern - 0.6), 2.0) * 0.3;
      col += vec3(highlight * 0.8, highlight * 0.6, highlight * 1.0);

      fragColor = vec4(col, 1.0);
    }`

    // Shader compilation helpers
    function compileShader(type: number, source: string): WebGLShader {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compile error")
      }
      return shader
    }

    function createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Program link error")
      }
      return program
    }

    // Create shaders and program
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
    const program = createProgram(vertexShader, fragmentShader)
    programRef.current = program

    // Create VAO (required in WebGL2)
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    // Get uniform locations
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      proportion: gl.getUniformLocation(program, "u_proportion"),
      softness: gl.getUniformLocation(program, "u_softness"),
      distortion: gl.getUniformLocation(program, "u_distortion"),
      swirl: gl.getUniformLocation(program, "u_swirl"),
      swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
      shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      scale: gl.getUniformLocation(program, "u_scale"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      speed: gl.getUniformLocation(program, "u_speed"),
      colorCount: gl.getUniformLocation(program, "u_colorCount"),
      colors: gl.getUniformLocation(program, "u_colors[0]"),
    }
    uniformsRef.current = uniforms

    function cssColorToRGB(css: string): [number, number, number] {
      const ctx = document.createElement("canvas").getContext("2d")!
      ctx.fillStyle = css
      const computed = ctx.fillStyle
      const el = document.createElement("div")
      el.style.color = computed
      document.body.appendChild(el)
      const rgb = getComputedStyle(el).color
      document.body.removeChild(el)
      const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/)
      if (!m) return [1, 1, 1]
      return [Number.parseInt(m[1]) / 255, Number.parseInt(m[2]) / 255, Number.parseInt(m[3]) / 255]
    }

    // Resize function
    function resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      resizeScheduledRef.current = false
    }

    function scheduleResize() {
      if (!resizeScheduledRef.current) {
        resizeScheduledRef.current = true
        requestAnimationFrame(resize)
      }
    }

    const resizeObserver = new ResizeObserver(scheduleResize)
    resizeObserver.observe(canvas)

    // Animation loop
    startTimeRef.current = performance.now()

    function animate() {
      if (!glRef.current || !programRef.current) return

      resize()
      const currentTime = (performance.now() - startTimeRef.current!) / 1000

      const glContext = glRef.current
      const shaderProgram = programRef.current
      const uniformLocations = uniformsRef.current

      glContext["useProgram"](shaderProgram)

      const colorArray = colors.slice(0, 8).flatMap(cssColorToRGB)
      while (colorArray.length < 8 * 3) {
        colorArray.push(0, 0, 0)
      }

      // Set uniforms every frame
      glContext.uniform2f(uniformLocations.resolution, canvas.width, canvas.height)
      glContext.uniform1f(uniformLocations.time, currentTime)
      glContext.uniform1f(uniformLocations.proportion, proportion)
      glContext.uniform1f(uniformLocations.softness, softness)
      glContext.uniform1f(uniformLocations.distortion, distortion)
      glContext.uniform1f(uniformLocations.swirl, swirl)
      glContext.uniform1i(uniformLocations.swirlIterations, Math.floor(swirlIterations))
      glContext.uniform1f(uniformLocations.shapeScale, shapeScale)
      glContext.uniform1f(uniformLocations.scale, scale)
      glContext.uniform1f(uniformLocations.rotation, rotation)
      glContext.uniform1f(uniformLocations.speed, speed)
      glContext.uniform1i(uniformLocations.colorCount, Math.min(colors.length, 8))
      glContext.uniform3fv(uniformLocations.colors, new Float32Array(colorArray))

      glContext.drawArrays(glContext.TRIANGLES, 0, 3)

      animationRef.current = requestAnimationFrame(animate)
    }

    console.log("[v0] Starting animation loop")
    animate()

    // Cleanup function
    return () => {
      console.log("[v0] Cleaning up shader")
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      resizeObserver.disconnect()
      if (glRef.current && programRef.current) {
        glRef.current.deleteProgram(programRef.current)
      }
    }
  }, []) // Empty dependency array - only recreate on mount/unmount

  return <canvas ref={canvasRef} className={`block w-full h-full ${className}`} style={{ background: "#0b0b0b" }} />
}
