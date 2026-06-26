"use client"

import { useEffect, useRef } from "react"

interface NoisyShaderProps {
  colors?: string[]
  colorCount?: number
  softness?: number
  intensity?: number
  noiseSeed?: number
  rotation?: number
  scale?: number
  speed?: number
  offsetX?: number
  offsetY?: number
}

export default function NoisyShader({
  colors = ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"],
  colorCount = 4,
  softness = 0.5,
  intensity = 0.5,
  noiseSeed = 1.0,
  rotation = 0.0,
  scale = 1.0,
  speed = 0.3,
  offsetX = 0.0,
  offsetY = 0.0,
}: NoisyShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const resizeScheduledRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("[v0] Hash-based grain gradient initializing")

    // Initialize WebGL2
    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 not supported")
      return
    }

    glRef.current = gl

    // Vertex shader
    const vertexShaderSource = `#version 300 es
      precision highp float;
      
      void main() {
        vec2 position = vec2(
          float(gl_VertexID % 2) * 4.0 - 1.0,
          float(gl_VertexID / 2) * 4.0 - 1.0
        );
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    // Fragment shader with hash-based grain
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_color4;
      uniform int u_colorCount;
      uniform float u_softness;
      uniform float u_intensity;
      uniform float u_noiseSeed;
      uniform float u_rotation;
      uniform float u_scale;
      uniform float u_speed;
      uniform float u_offsetX;
      uniform float u_offsetY;
      
      out vec4 fragColor;
      
      // High-frequency hash function for pixel-level grain
      float hash(vec2 p) {
        p = p * u_noiseSeed + u_time * u_speed * 0.1;
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      // Hash-based grain that changes every pixel
      float grain(vec2 uv) {
        vec2 pixelCoord = floor(uv * u_resolution.xy * u_scale);
        return hash(pixelCoord) * 2.0 - 1.0;
      }
      
      // Fine grain at multiple scales for film-like texture
      float multiGrain(vec2 uv) {
        float g1 = grain(uv * 1.0) * 0.6;
        float g2 = grain(uv * 2.0) * 0.3;
        float g3 = grain(uv * 4.0) * 0.1;
        return g1 + g2 + g3;
      }
      
      // Rotation matrix
      mat2 rotate(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c);
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        // Apply offset and rotation
        vec2 centeredUv = uv - 0.5;
        centeredUv = rotate(u_rotation) * centeredUv;
        centeredUv += 0.5;
        centeredUv += vec2(u_offsetX, u_offsetY);
        
        // Create diagonal gradient coordinate
        float gradientCoord = (centeredUv.x + centeredUv.y) * 0.5;
        
        // Get grain value for this pixel
        float grainValue = multiGrain(centeredUv);
        
        // CRITICAL: Apply grain inside color mixing for shimmering edges
        // Each color boundary gets its own grain-distorted interpolation
        float grainedGradient = gradientCoord + grainValue * u_intensity * 0.1;
        
        // Create grain-distorted weights for each color transition
        float step1 = 1.0 / float(u_colorCount - 1);
        float step2 = 2.0 / float(u_colorCount - 1);
        float step3 = 3.0 / float(u_colorCount - 1);
        
        // Each transition gets unique grain for shimmering boundaries
        float grain1 = grain(centeredUv * 1.3) * u_intensity * 0.05;
        float grain2 = grain(centeredUv * 1.7) * u_intensity * 0.05;
        float grain3 = grain(centeredUv * 2.1) * u_intensity * 0.05;
        
        float t1 = smoothstep(0.0 - u_softness, step1 + u_softness, grainedGradient + grain1);
        float t2 = smoothstep(step1 - u_softness, step2 + u_softness, grainedGradient + grain2);
        float t3 = smoothstep(step2 - u_softness, step3 + u_softness, grainedGradient + grain3);
        
        // Mix colors with grain-affected boundaries
        vec3 color = u_color1;
        if (u_colorCount > 1) color = mix(color, u_color2, t1);
        if (u_colorCount > 2) color = mix(color, u_color3, t2);
        if (u_colorCount > 3) color = mix(color, u_color4, t3);
        
        // Add fine grain speckles to the final color (like film grain)
        vec3 grainSpeckles = vec3(grainValue) * u_intensity * 0.03;
        color += grainSpeckles;
        
        // Grain-affected falloff to black
        float falloff = smoothstep(0.0, 0.4, grainedGradient) * smoothstep(1.2, 0.7, grainedGradient);
        falloff += grain(centeredUv * 0.8) * 0.05; // Grain in the falloff too
        falloff = clamp(falloff, 0.0, 1.0);
        
        vec3 finalColor = mix(vec3(0.0), color, falloff);
        
        fragColor = vec4(finalColor, 1.0);
      }
    `

    // Compile shaders
    function compileShader(source: string, type: number): WebGLShader | null {
      const shader = gl.createShader(type)
      if (!shader) return null

      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }

      return shader
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)

    if (!vertexShader || !fragmentShader) return

    // Create program
    const program = gl.createProgram()
    if (!program) return

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program))
      return
    }

    programRef.current = program

    // Get uniform locations
    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      color1: gl.getUniformLocation(program, "u_color1"),
      color2: gl.getUniformLocation(program, "u_color2"),
      color3: gl.getUniformLocation(program, "u_color3"),
      color4: gl.getUniformLocation(program, "u_color4"),
      colorCount: gl.getUniformLocation(program, "u_colorCount"),
      softness: gl.getUniformLocation(program, "u_softness"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      noiseSeed: gl.getUniformLocation(program, "u_noiseSeed"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      scale: gl.getUniformLocation(program, "u_scale"),
      speed: gl.getUniformLocation(program, "u_speed"),
      offsetX: gl.getUniformLocation(program, "u_offsetX"),
      offsetY: gl.getUniformLocation(program, "u_offsetY"),
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

    // Resize function
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    // Debounced resize handler
    const scheduleResize = () => {
      if (!resizeScheduledRef.current) {
        resizeScheduledRef.current = true
        requestAnimationFrame(() => {
          resize()
          resizeScheduledRef.current = false
        })
      }
    }

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(scheduleResize)
    resizeObserver.observe(canvas)

    // Initial resize
    resize()

    // Animation loop
    const animate = (currentTime: number) => {
      const time = currentTime * 0.001

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl["useProgram"](program)

      // Set uniforms
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform1f(uniforms.time, time)
      gl.uniform3f(uniforms.color1, ...rgbColors[0])
      gl.uniform3f(uniforms.color2, ...rgbColors[1])
      gl.uniform3f(uniforms.color3, ...rgbColors[2])
      gl.uniform3f(uniforms.color4, ...rgbColors[3])
      gl.uniform1i(uniforms.colorCount, colorCount)
      gl.uniform1f(uniforms.softness, softness)
      gl.uniform1f(uniforms.intensity, intensity)
      gl.uniform1f(uniforms.noiseSeed, noiseSeed)
      gl.uniform1f(uniforms.rotation, rotation)
      gl.uniform1f(uniforms.scale, scale)
      gl.uniform1f(uniforms.speed, speed)
      gl.uniform1f(uniforms.offsetX, offsetX)
      gl.uniform1f(uniforms.offsetY, offsetY)

      // Draw fullscreen triangle
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      animationRef.current = requestAnimationFrame(animate)
    }

    console.log("[v0] Hash-based grain animation starting")
    animationRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      resizeObserver.disconnect()
      if (program) {
        gl.deleteProgram(program)
      }
      if (vertexShader) {
        gl.deleteShader(vertexShader)
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader)
      }
    }
  }, [colors, colorCount, softness, intensity, noiseSeed, rotation, scale, speed, offsetX, offsetY])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
}
