'use client';

import { liquidFragSource } from './liquid-frag';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// uniform sampler2D u_image_texture;
// uniform float u_time;
// uniform float u_ratio;
// uniform float u_img_ratio;
// uniform float u_patternScale;
// uniform float u_refraction;
// uniform float u_edge;
// uniform float u_patternBlur;
// uniform float u_liquid;

const vertexShaderSource = `#version 300 es
precision mediump float;

in vec2 a_position;
out vec2 vUv;

void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
}` as const;

export type ShaderParams = {
  patternScale: number;
  refraction: number;
  edge: number;
  patternBlur: number;
  liquid: number;
  speed: number;
};

export function Canvas({
  imageData,
  params,
  canvasRef,
}: {
  imageData: ImageData;
  params: ShaderParams;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const [gl, setGl] = useState<WebGL2RenderingContext | null>(null);
  const [uniforms, setUniforms] = useState<Record<string, WebGLUniformLocation>>({});
  /** Keeps track of how long we've been playing, fed into u_time */
  const totalAnimationTime = useRef(0);
  const lastRenderTime = useRef(0);

  function updateUniforms() {
    if (!gl || !uniforms) return;
    gl.uniform1f(uniforms.u_edge, params.edge);
    gl.uniform1f(uniforms.u_patternBlur, params.patternBlur);
    gl.uniform1f(uniforms.u_time, 0);
    gl.uniform1f(uniforms.u_patternScale, params.patternScale);
    gl.uniform1f(uniforms.u_refraction, params.refraction);
    gl.uniform1f(uniforms.u_liquid, params.liquid);
  }

  useEffect(() => {
    function initShader() {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('Canvas element not found');
        return;
      }

      // Set initial canvas size
      const side = 1000;
      canvas.width = side * devicePixelRatio;
      canvas.height = side * devicePixelRatio;

      const contextAttributes: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
        depth: false,
        preserveDrawingBuffer: true,
        stencil: false,
        premultipliedAlpha: false
      };

      const gl = canvas.getContext('webgl2', contextAttributes);
      if (!gl) {
        toast.error('Failed to initialize WebGL2. Please check if your browser supports WebGL2.');
        return;
      }

      function createShader(gl: WebGL2RenderingContext, sourceCode: string, type: number) {
        // Create shader object
        const shader = gl.createShader(type);
        if (!shader) {
          console.error('Failed to create shader object');
          return null;
        }

        // Set the shader source code
        gl.shaderSource(shader, sourceCode);

        // Compile the shader
        gl.compileShader(shader);

        // Check if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error(
            `An error occurred compiling the shader: ${gl.getShaderInfoLog(shader)}\n\nShader source:\n${sourceCode}`
          );
          gl.deleteShader(shader);
          return null;
        }

        return shader;
      }

      // Create vertex and fragment shaders
      const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
      const fragmentShader = createShader(gl, liquidFragSource, gl.FRAGMENT_SHADER);

      if (!vertexShader || !fragmentShader) {
        toast.error('Failed to compile shaders. Check console for details.');
        return;
      }

      // Create the shader program
      const program = gl.createProgram();
      if (!program) {
        toast.error('Failed to create shader program');
        return;
      }

      // Attach shaders to the program
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);

      // Link the program
      gl.linkProgram(program);

      // Check if it linked successfully
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`Unable to link the shader program: ${gl.getProgramInfoLog(program)}`);
        toast.error('Failed to link shader program');
        return;
      }

      // Use the program
      gl.useProgram(program);

      // Get uniform locations
      function getUniforms(program: WebGLProgram, gl: WebGL2RenderingContext) {
        const uniforms: Record<string, WebGLUniformLocation> = {};
        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
          const uniformInfo = gl.getActiveUniform(program, i);
          if (!uniformInfo) continue;
          const location = gl.getUniformLocation(program, uniformInfo.name);
          if (location === null) {
            console.warn(`Could not get location for uniform: ${uniformInfo.name}`);
            continue;
          }
          uniforms[uniformInfo.name] = location;
        }
        return uniforms;
      }

      const uniforms = getUniforms(program, gl);
      setUniforms(uniforms);

      // Set up vertex position attribute
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      const vertexBuffer = gl.createBuffer();
      if (!vertexBuffer) {
        toast.error('Failed to create vertex buffer');
        return;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Set viewport
      gl.viewport(0, 0, canvas.width, canvas.height);

      // Set WebGL context
      setGl(gl);
    }

    initShader();
    updateUniforms();
  }, []);

  // Keep uniforms updated
  useEffect(() => {
    if (!gl || !uniforms) return;

    updateUniforms();
  }, [gl, params, uniforms]);

  // Render every frame
  useEffect(() => {
    if (!gl || !uniforms) return;

    let renderId: number;

    function render(currentTime: number) {
      const deltaTime = currentTime - lastRenderTime.current;
      lastRenderTime.current = currentTime;

      // Update the total animation time and time uniform
      totalAnimationTime.current += deltaTime * params.speed;
      gl!.uniform1f(uniforms.u_time, totalAnimationTime.current);
      // Draw!
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      // rAF
      renderId = requestAnimationFrame(render);
    }

    // Kick off the render loop
    lastRenderTime.current = performance.now();
    renderId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(renderId);
    };
  }, [gl, params.speed]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || !gl || !uniforms) return;

    function resizeCanvas() {
      if (!canvasEl || !gl || !uniforms) return;
      const imgRatio = imageData.width / imageData.height;
      gl.uniform1f(uniforms.u_img_ratio, imgRatio);

      const side = 1000;
      canvasEl.width = side * devicePixelRatio;
      canvasEl.height = side * devicePixelRatio;
      gl.viewport(0, 0, canvasEl.height, canvasEl.height);
      gl.uniform1f(uniforms.u_ratio, 1);
      gl.uniform1f(uniforms.u_img_ratio, imgRatio);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [gl, uniforms, imageData]);

  useEffect(() => {
    if (!gl || !uniforms) return;

    // Delete any existing texture first
    const existingTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
    if (existingTexture) {
      gl.deleteTexture(existingTexture);
    }

    const imageTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);

    // Set texture parameters before uploading the data
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Ensure power-of-two dimensions or use appropriate texture parameters
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        imageData.width,
        imageData.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData.data
      );

      gl.uniform1i(uniforms.u_image_texture, 0);
    } catch (e) {
      console.error('Error uploading texture:', e);
      toast.error('Failed to upload image texture');
    }

    return () => {
      // Cleanup texture when component unmounts or imageData changes
      if (imageTexture) {
        gl.deleteTexture(imageTexture);
      }
    };
  }, [gl, uniforms, imageData]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full object-contain no-select"
      onContextMenu={(e) => e.stopPropagation()}
      tabIndex={0}
    />
  );
}
