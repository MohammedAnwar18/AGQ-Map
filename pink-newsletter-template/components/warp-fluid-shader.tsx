"use client"

import { useEffect, useRef } from "react"

export default function WarpFluidShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number>()
  const resizeScheduledRef = useRef<boolean>(false)

  const uniforms = {
    colorCount: 4,
    color1: "#121212",
    color2: "#9470ff",
    color3: "#121212",
    color4: "#8838ff",
    proportion: 0.45,
    softness: 1.0,
    distortion: 0.25,
    swirl: 1.0,
    swirlIterations: 10,
    shape: "checks",
    shapeScale: 0.1,
    scale: 1.0,
    rotation: 0.0,
    speed: 1.0,
  }

  const vertexShaderSource = `#version 300 es
    out vec2 vUv;
    void main() {
      vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 4.0 - 1.0;
      gl_Position = vec4(pos, 0.0, 1.0);
      vUv = pos * 0.5 + 0.5;
    }
  `

  const fragmentShaderSource = `#version 300 es
    precision highp float;
    
    in vec2 vUv;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_colorCount;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    uniform vec3 u_color4;
    uniform float u_proportion;
    uniform float u_softness;
    uniform float u_distortion;
    uniform float u_swirl;
    uniform int u_swirlIterations;
    uniform float u_shapeScale;
    uniform float u_scale;
    uniform float u_rotation;
    uniform float u_speed;
    
    out vec4 fragColor;
    
    const float TAU = 6.28318530718;
    
    // Hash function for noise
    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    
    // FBM noise for flow field
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    // Flow field with curl noise
    vec2 flow(vec2 p, float t) {
      vec2 offset = vec2(t * 0.1, t * 0.07);
      float n1 = fbm(p + offset);
      float n2 = fbm(p + offset + vec2(100.0, 50.0));
      
      // Curl noise (perpendicular gradient)
      vec2 curl = vec2(
        fbm(p + vec2(0.01, 0.0)) - fbm(p - vec2(0.01, 0.0)),
        fbm(p + vec2(0.0, 0.01)) - fbm(p - vec2(0.0, 0.01))
      );
      
      return normalize(curl) * 0.5;
    }
    
    // Rotation matrix
    mat2 rot(float a) {
      float c = cos(a);
      float s = sin(a);
      return mat2(c, -s, s, c);
    }
    
    // Checkerboard base field
    float checks(vec2 uv) {
      vec2 scaled = uv / u_shapeScale;
      float checker = sin(scaled.x * TAU) * sin(scaled.y * TAU);
      return (checker + 1.0) * 0.5; // Normalize to [0,1]
    }
    
    // 4-color gradient ramp
    vec3 ramp(float x) {
      if (x <= u_proportion) {
        float t = x / u_proportion;
        return mix(u_color1, u_color2, t);
      } else if (x <= 0.66) {
        float t = (x - u_proportion) / (0.66 - u_proportion);
        return mix(u_color2, u_color3, t);
      } else {
        float t = (x - 0.66) / (1.0 - 0.66);
        return mix(u_color3, u_color4, t);
      }
    }
    
    void main() {
      // UV prep - map to [-1,1] preserving aspect
      vec2 uv = (vUv * 2.0 - 1.0);
      uv.x *= u_resolution.x / u_resolution.y;
      
      // Apply rotation and scale
      float c = cos(u_rotation);
      float s = sin(u_rotation);
      mat2 rot = mat2(c, -s, s, c);
      uv = rot * uv * u_scale;
      
      float t = u_time * 0.2 * u_speed;
      
      // Domain warp with iterative swirl
      vec2 p = uv;
      for(int i = 0; i < u_swirlIterations; i++) {
        vec2 flowVec = flow(p, t);
        // rot90 for swirl
        flowVec = vec2(-flowVec.y, flowVec.x);
        p += u_swirl * flowVec * 0.05 / (1.0 + float(i));
      }
      
      // Final warped sample
      float w = checks(p + u_distortion * flow(p, t));
      
      // Edge shaping with softness
      float softness_factor = 0.15 * u_softness;
      float mask = smoothstep(0.5 - softness_factor, 0.5 + softness_factor, w);
      
      // Color from ramp
      vec3 col = ramp(w);
      
      // Mix in darker tones near valleys
      col = mix(col * 0.3, col, mask);
      
      // Glossy ridge shading (fake lighting)
      vec3 normal = normalize(vec3(dFdx(w), dFdy(w), 1.0));
      vec3 lightDir = normalize(vec3(0.4, 0.3, 0.85));
      
      // Specular highlight on ridges
      float spec = pow(max(dot(normal, lightDir), 0.0), 16.0) * 0.25;
      
      // Final lighting
      col = col * (0.85 + 0.15 * normal.z) + spec;
      
      // Gamma correction
      col = pow(col, vec3(1.0/2.2));
      
      fragColor = vec4(col, 1.0);
    }
  `

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255
    return [r, g, b]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("[v0] Warp fluid shader initializing...")

    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }
    glRef.current = gl

    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("[v0] Vertex shader error:", gl.getShaderInfoLog(vertexShader))
      return
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)

    // Check compilation
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("[v0] Fragment shader error:", gl.getShaderInfoLog(fragmentShader))
      return
    }

    // Create program
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[v0] Program linking error:", gl.getProgramInfoLog(program))
      return
    }

    programRef.current = program
    console.log("[v0] Shaders compiled and program linked successfully")

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      gl.viewport(0, 0, canvas.width, canvas.height)
      resizeScheduledRef.current = false
    }

    function scheduleResize() {
      if (!resizeScheduledRef.current) {
        resizeScheduledRef.current = true
        requestAnimationFrame(resizeCanvas)
      }
    }

    const resizeObserver = new ResizeObserver(scheduleResize)
    resizeObserver.observe(canvas)

    console.log("[v0] Warp fluid animation starting...")

    // Animation loop
    const startTime = Date.now()
    const animate = (currentTime: number) => {
      const gl = glRef.current
      const program = programRef.current

      if (!gl || !program) return

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl["useProgram"](program)

      // Set uniforms
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), canvas.width, canvas.height)
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), currentTime * 0.001)
      gl.uniform1i(gl.getUniformLocation(program, "u_colorCount"), uniforms.colorCount)

      const [r1, g1, b1] = hexToRgb(uniforms.color1)
      const [r2, g2, b2] = hexToRgb(uniforms.color2)
      const [r3, g3, b3] = hexToRgb(uniforms.color3)
      const [r4, g4, b4] = hexToRgb(uniforms.color4)

      gl.uniform3f(gl.getUniformLocation(program, "u_color1"), r1, g1, b1)
      gl.uniform3f(gl.getUniformLocation(program, "u_color2"), r2, g2, b2)
      gl.uniform3f(gl.getUniformLocation(program, "u_color3"), r3, g3, b3)
      gl.uniform3f(gl.getUniformLocation(program, "u_color4"), r4, g4, b4)

      gl.uniform1f(gl.getUniformLocation(program, "u_proportion"), uniforms.proportion)
      gl.uniform1f(gl.getUniformLocation(program, "u_softness"), uniforms.softness)
      gl.uniform1f(gl.getUniformLocation(program, "u_distortion"), uniforms.distortion)
      gl.uniform1f(gl.getUniformLocation(program, "u_swirl"), uniforms.swirl)
      gl.uniform1i(gl.getUniformLocation(program, "u_swirlIterations"), uniforms.swirlIterations)
      gl.uniform1f(gl.getUniformLocation(program, "u_shapeScale"), uniforms.shapeScale)
      gl.uniform1f(gl.getUniformLocation(program, "u_scale"), uniforms.scale)
      gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), uniforms.rotation)
      gl.uniform1f(gl.getUniformLocation(program, "u_speed"), uniforms.speed)

      gl.drawArrays(gl.TRIANGLES, 0, 3)

      animationRef.current = requestAnimationFrame((time) => animate(time))
    }

    animationRef.current = requestAnimationFrame((time) => animate(time))

    return () => {
      resizeObserver.disconnect()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, []) // Removed uniforms dependency since they're now fixed

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
}
