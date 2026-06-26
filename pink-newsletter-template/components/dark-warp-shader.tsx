"use client"

import { useEffect, useRef } from "react"

interface DarkWarpShaderProps {
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
}

export default function DarkWarpShader({
  proportion = 0.45,
  softness = 1.0,
  distortion = 0.25,
  swirl = 0.8,
  swirlIterations = 10.0,
  shapeScale = 0.1,
  scale = 1.0,
  rotation = 0.0,
  speed = 0.5,
  colors = ["#121212", "#9470ff", "#121212", "#8838ff"],
}: DarkWarpShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resizeScheduledRef = useRef<boolean>(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("[v0] Dark Warp Shader initializing...")

    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }

    // Vertex shader - creates fullscreen triangle
    const vertexShaderSource = `#version 300 es
      out vec2 vUv;
      void main() {
        vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 4.0 - 1.0;
        gl_Position = vec4(pos, 0.0, 1.0);
        vUv = pos * 0.5 + 0.5;
      }
    `

    // Fragment shader with dark warp effect
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_proportion;
      uniform float u_softness;
      uniform float u_distortion;
      uniform float u_swirl;
      uniform float u_swirlIterations;
      uniform float u_shapeScale;
      uniform float u_scale;
      uniform float u_rotation;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_color4;
      
      vec2 hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                      dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                  mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                      dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
      }
      
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      vec2 domainWarp(vec2 p, float time) {
        vec2 warp = vec2(
          fbm(p + vec2(time * 0.1, time * 0.15)),
          fbm(p + vec2(time * 0.12, time * 0.08))
        );
        
        // Apply swirl effect
        float dist = length(p - 0.5);
        float angle = atan(p.y - 0.5, p.x - 0.5);
        angle += u_swirl * dist * sin(time * 0.5);
        
        vec2 swirlPos = vec2(cos(angle), sin(angle)) * dist + 0.5;
        warp += vec2(
          fbm(swirlPos * 3.0 + time * 0.2),
          fbm(swirlPos * 3.0 + time * 0.25)
        ) * u_distortion;
        
        return p + warp * u_distortion;
      }
      
      float checkerPattern(vec2 p) {
        vec2 grid = floor(p / u_shapeScale);
        return mod(grid.x + grid.y, 2.0);
      }
      
      vec3 getColor(float t) {
        t = fract(t);
        if (t < 0.33) {
          return mix(u_color1, u_color2, t * 3.0);
        } else if (t < 0.66) {
          return mix(u_color2, u_color3, (t - 0.33) * 3.0);
        } else {
          return mix(u_color3, u_color4, (t - 0.66) * 3.0);
        }
      }
      
      void main() {
        vec2 uv = vUv;
        uv.x *= u_resolution.x / u_resolution.y;
        
        // Apply multiple layers of domain warping
        vec2 warpedUv = domainWarp(uv, u_time);
        vec2 warpedUv2 = domainWarp(warpedUv + vec2(100.0), u_time * 1.3);
        vec2 warpedUv3 = domainWarp(warpedUv2 + vec2(200.0), u_time * 0.8);
        
        // Create flowing pattern with checks
        float pattern = checkerPattern(warpedUv3 * u_scale);
        float flow = fbm(warpedUv2 * 2.0 + u_time * 0.3);
        float flow2 = fbm(warpedUv3 * 1.5 + u_time * 0.4);
        
        // Combine patterns
        float combined = mix(pattern, flow, 0.7);
        combined = mix(combined, flow2, 0.5);
        
        // Add dramatic swirl variations
        float swirlPattern = 0.0;
        for (float i = 0.0; i < u_swirlIterations; i++) {
          vec2 offset = vec2(cos(i * 0.628), sin(i * 0.628)) * 0.1;
          swirlPattern += fbm(warpedUv + offset + u_time * (0.1 + i * 0.02)) * (1.0 / (i + 1.0));
        }
        
        combined = mix(combined, swirlPattern, 0.6);
        
        // Apply softness and get final color
        combined = smoothstep(u_proportion - u_softness, u_proportion + u_softness, combined);
        vec3 color = getColor(combined + u_time * 0.1);
        
        // Add dramatic contrast and depth
        color = pow(color, vec3(1.2));
        color = mix(color, vec3(0.0), 0.1); // Darken slightly
        
        fragColor = vec4(color, 1.0);
      }
    `

    // Compile shaders
    function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program))
      return
    }

    // Get uniform locations
    const uniforms = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_proportion: gl.getUniformLocation(program, "u_proportion"),
      u_softness: gl.getUniformLocation(program, "u_softness"),
      u_distortion: gl.getUniformLocation(program, "u_distortion"),
      u_swirl: gl.getUniformLocation(program, "u_swirl"),
      u_swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
      u_shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      u_scale: gl.getUniformLocation(program, "u_scale"),
      u_rotation: gl.getUniformLocation(program, "u_rotation"),
      u_color1: gl.getUniformLocation(program, "u_color1"),
      u_color2: gl.getUniformLocation(program, "u_color2"),
      u_color3: gl.getUniformLocation(program, "u_color3"),
      u_color4: gl.getUniformLocation(program, "u_color4"),
    }

    // Convert hex colors to RGB
    function hexToRgb(hex: string): [number, number, number] {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? [
            Number.parseInt(result[1], 16) / 255,
            Number.parseInt(result[2], 16) / 255,
            Number.parseInt(result[3], 16) / 255,
          ]
        : [0, 0, 0]
    }

    const rgbColors = colors.map(hexToRgb)

    // Resize canvas
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

    // Animation loop
    let animationId: number
    function animate(time: number) {
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl["useProgram"](program)

      // Set uniforms
      gl.uniform1f(uniforms.u_time, time * 0.001 * speed)
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height)
      gl.uniform1f(uniforms.u_proportion, proportion)
      gl.uniform1f(uniforms.u_softness, softness)
      gl.uniform1f(uniforms.u_distortion, distortion)
      gl.uniform1f(uniforms.u_swirl, swirl)
      gl.uniform1f(uniforms.u_swirlIterations, swirlIterations)
      gl.uniform1f(uniforms.u_shapeScale, shapeScale)
      gl.uniform1f(uniforms.u_scale, scale)
      gl.uniform1f(uniforms.u_rotation, rotation)
      gl.uniform3f(uniforms.u_color1, ...rgbColors[0])
      gl.uniform3f(uniforms.u_color2, ...rgbColors[1])
      gl.uniform3f(uniforms.u_color3, ...rgbColors[2])
      gl.uniform3f(uniforms.u_color4, ...rgbColors[3])

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      animationId = requestAnimationFrame(animate)
    }

    console.log("[v0] Dark Warp Shader animation starting...")
    animationId = requestAnimationFrame(animate)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationId)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
}
