'use client';

import { NumberInput } from '../app/number-input';
import { roundOptimized } from '../app/round-optimized';
import { uploadImage } from './upload-image';
import isEqual from 'lodash-es/isEqual';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as Slider from '@radix-ui/react-slider';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import { Canvas } from './canvas';
import { type ShaderParams, defaultParams, params } from './params';
import { parseLogoImage } from './parse-logo-image';
import GIF from 'gif.js';

const PREDEFINED_LOGOS = ['punisher', 'dcshoes', 'github', 'linux', 'huggingface'];

interface HeroProps {
  imageId: string | string[];
  refraction?: number;
  edge?: number;
  patternBlur?: number;
  liquid?: number;
  speed?: number;
  patternScale?: number;
}

type State = ShaderParams & {
  background: string;
};

const defaultState = { ...defaultParams, background: 'metal' };

/**
 * Hero component for the Liquid Logo Generator
 * @param imageId - The ID of the image to display (string or array of strings)
 * @param refraction - Refraction amount `[0, 0.06]`
 * @param edge - Edge thickness `[0, 1]`
 * @param patternBlur - Pattern blur amount `[0, 0.05]`
 * @param liquid - Liquid distortion amount `[0, 1]`
 * @param speed - Animation speed `[0, 1]`
 * @param patternScale - Pattern scale `[1, 10]`
 */
export function LiquidImage({
  imageId,
  refraction = 0.015,
  edge = 0.4,
  patternBlur = 0.005,
  liquid = 0.07,
  speed = 0.3,
  patternScale = 2,
}: HeroProps) {
  // Handle both string and string array cases
  const id = Array.isArray(imageId) ? imageId[0] : imageId;

  if (!id || typeof id !== 'string') {
    throw new Error('Invalid imageId provided to LiquidImage component');
  }

  const [state, setState] = useState<State>({
    ...defaultState,
    refraction,
    edge,
    patternBlur,
    liquid,
    speed,
    patternScale,
  });
  const [dragging, setDragging] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchParamsDebounce = useRef(0);
  const searchParamsPendingUpdate = useRef(false);

  const stateRef = useRef(state);

  const [imageData, setImageData] = useState<ImageData>();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isGeneratingGif, setIsGeneratingGif] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const types = e.dataTransfer.types;
    if (types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];

    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (validTypes.includes(file.type)) {
        try {
          setIsUploading(true);
          const { imageData: newImageData } = await parseLogoImage(file);
          setImageData(newImageData);
        } catch (error) {
          console.error('Error processing dropped file:', error);
        } finally {
          setIsUploading(false);
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const target = touch.target as HTMLElement;
      if (target.tagName === 'CANVAS') {
        setIsDragging(true);
      }
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Check if files were dropped via share
    if (e.changedTouches.length === 1) {
      const target = e.changedTouches[0].target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file) {
          const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
          if (validTypes.includes(file.type)) {
            try {
              setIsUploading(true);
              await parseLogoImage(file).then(({ imageData: newImageData }) => {
                setImageData(newImageData);
              });
            } catch (error) {
              console.error('Error loading image:', error);
            } finally {
              setIsUploading(false);
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === 'HANDLE_FILE' && event.data.file) {
        try {
          setIsUploading(true);
          const { imageData: newImageData } = await parseLogoImage(event.data.file);
          setImageData(newImageData);
        } catch (error) {
          console.error('Error loading image:', error);
        } finally {
          setIsUploading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const handleImageDataUpdate = (event: CustomEvent) => {
      setImageData(event.detail);
    };

    window.addEventListener('updateImageData', handleImageDataUpdate as EventListener);
    return () => {
      window.removeEventListener('updateImageData', handleImageDataUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    stateRef.current = state;

    if (isEqual(defaultState, state)) {
      router.replace(pathname, { scroll: false });
      return;
    }

    function updateSearchParams() {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(stateRef.current)) {
        if (typeof value === 'number') {
          searchParams.set(key, roundOptimized(value, 4).toString());
        } else {
          searchParams.set(key, value);
        }
      }

      searchParamsPendingUpdate.current = false;
      router.replace(`${pathname}?${searchParams.toString()}`, { scroll: false });
    }

    // Update with a debounce (neither Next.js router nor Safari like frequent URL updates)

    if (searchParamsDebounce.current) {
      clearTimeout(searchParamsDebounce.current);

      searchParamsPendingUpdate.current = true;
      searchParamsDebounce.current = window.setTimeout(() => {
        updateSearchParams();
        searchParamsDebounce.current = 0;
      }, 100);

      return;
    }

    updateSearchParams();

    searchParamsDebounce.current = window.setTimeout(() => {
      searchParamsDebounce.current = 0;
    }, 100);
  }, [state]);

  useEffect(() => {
    if (searchParamsPendingUpdate.current) {
      return;
    }

    const paramsState: Record<string, number | string> = {};
    let isEqual = true;

    for (const [key, value] of searchParams.entries()) {
      if (!(key in state)) {
        continue;
      }

      const number = Number.parseFloat(value);
      paramsState[key] = Number.isNaN(number) ? value : number;

      // @ts-ignore
      let currentValue = stateRef.current[key];
      // Match the precision of the params
      if (typeof currentValue === 'number') {
        currentValue = roundOptimized(currentValue, 4);
      }

      if (paramsState[key] !== currentValue) {
        isEqual = false;
      }
    }

    if (isEqual === false) {
      console.log('💧 LiquidImage: Updating state from URL params');
      setState((state) => ({ ...state, ...paramsState }));
    }
  }, [searchParams]);

  useEffect(() => {
    const loadImage = async (id: string) => {
      try {
        setIsInitialLoading(true);
        let img: HTMLImageElement;

        // Check if it's a predefined logo
        if (PREDEFINED_LOGOS.includes(id)) {
          const response = await fetch(`/liquid-metal-drbaph/logos/${id}.svg`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const svgText = await response.text();
          
          // Create a Blob from the SVG text
          const blob = new Blob([svgText], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          
          img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          
          // Clean up the object URL
          URL.revokeObjectURL(url);
        } else {
          // Try to load from Vercel blob storage
          try {
            const response = await fetch(`https://p1ljtcp1ptfohfxm.public.blob.vercel-storage.com/${id}.png`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            const file = new File([blob], 'logo.png', { type: 'image/png' });
            const { imageData } = await parseLogoImage(file);
            setImageData(imageData);
            return;
          } catch (error) {
            console.error('Failed to load from blob storage:', error);
          }

          // Fallback to API
          const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/user-logo?id=${id}`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          
          img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = data.url;
          });
        }

        // Process the image
        const { imageData } = await parseLogoImage(img);
        setImageData(imageData);
      } catch (error) {
        console.error('Error loading image:', error);
        toast.error('Failed to load image');
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (id) {
      loadImage(id);
    }
  }, [id]); // Only depend on id, not imageId

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFiles(files);
    }
  }, []);

  const handleFiles = async (files: FileList) => {
    if (files.length > 0) {
      const file = files[0];
      const fileType = file.type;

      // Check file size (4.5MB = 4.5 * 1024 * 1024 bytes)
      const maxSize = 4.5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size must be less than 4.5MB');
        return;
      }

      // Check if file is an image or SVG
      if (fileType.startsWith('image/') || fileType === 'image/svg+xml') {
        setIsUploading(true);
        parseLogoImage(file).then(({ imageData }) => {
          // Set the image data for the shader to pick up
          setImageData(imageData);

          // Upload the image
          uploadImage(file)
            .then((imageId) => {
              // Update the URL for sharing
              if (typeof window !== 'undefined' && typeof imageId === 'string' && imageId.length > 0) {
                // const currentParams = searchParams.values.length ? '?' + searchParams.toString() : '';
                router.push(`/share/${imageId}`, { scroll: false });
              }
            })
            .catch((error) => {
              console.error('💧 LiquidImage: Failed to upload image.', error);
            })
            .finally(() => setIsUploading(false));
        });
      } else {
        toast.error('Please upload only images or SVG files');
      }
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      return data.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload image');
      throw error;
    }
  };

  const handleDownload = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Get the WebGL context
      const gl = canvas.getContext('webgl2');
      if (!gl) {
        console.error('Could not get WebGL context');
        return;
      }

      // Read pixels directly from WebGL context
      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Create a temporary canvas for correct orientation
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get 2D context');
        return;
      }

      // Create ImageData and put pixels
      const imageData = ctx.createImageData(width, height);
      // Flip the image vertically
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const sourceIndex = (i * width + j) * 4;
          const targetIndex = ((height - i - 1) * width + j) * 4;
          imageData.data[targetIndex] = pixels[sourceIndex];
          imageData.data[targetIndex + 1] = pixels[sourceIndex + 1];
          imageData.data[targetIndex + 2] = pixels[sourceIndex + 2];
          imageData.data[targetIndex + 3] = pixels[sourceIndex + 3];
        }
      }
      
      ctx.putImageData(imageData, 0, 0);

      // Convert to blob with maximum quality
      const blob = await new Promise<Blob | null>((resolve) => {
        tempCanvas.toBlob(resolve, 'image/png', 1.0);
      });

      if (!blob) {
        console.error('Failed to create blob');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'liquid-metal-logo.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleGifDownload = useCallback(async () => {
    if (!canvasRef.current || isGeneratingGif) return;

    setIsGeneratingGif(true);
    try {
      const gif = new GIF({
        workers: 4,
        quality: 10,
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        workerScript: '/liquid-metal-drbaph/gif.worker.js',
      });

      // Capture frames for 5 seconds at 24fps
      const frameCount = 24 * 5; // 5 seconds at 24fps
      const frameDelay = 1000 / 24; // Delay between frames in ms

      for (let i = 0; i < frameCount; i++) {
        // Read pixels from WebGL context
        const pixels = new Uint8Array(canvasRef.current.width * canvasRef.current.height * 4);
        const gl = canvasRef.current.getContext('webgl2');
        if (!gl) {
          console.error('Could not get WebGL context');
          return;
        }
        gl.readPixels(0, 0, canvasRef.current.width, canvasRef.current.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Create ImageData and put pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const ctx = tempCanvas.getContext('2d');
        
        if (!ctx) {
          console.error('Could not get 2D context');
          return;
        }

        const imageData = ctx.createImageData(canvasRef.current.width, canvasRef.current.height);
        
        // Flip the image vertically
        for (let y = 0; y < canvasRef.current.height; y++) {
          for (let x = 0; x < canvasRef.current.width; x++) {
            const sourceIndex = (y * canvasRef.current.width + x) * 4;
            const targetIndex = ((canvasRef.current.height - y - 1) * canvasRef.current.width + x) * 4;
            imageData.data[targetIndex] = pixels[sourceIndex];
            imageData.data[targetIndex + 1] = pixels[sourceIndex + 1];
            imageData.data[targetIndex + 2] = pixels[sourceIndex + 2];
            imageData.data[targetIndex + 3] = pixels[sourceIndex + 3];
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Add frame to GIF
        gif.addFrame(tempCanvas, { delay: frameDelay, copy: true });
        
        // Wait for next frame
        await new Promise(resolve => setTimeout(resolve, frameDelay));
      }

      // Render GIF
      gif.on('finished', function(blob) {
        setIsGeneratingGif(false);
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'liquid-metal-logo.gif';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });

      gif.render();
    } catch (error) {
      setIsGeneratingGif(false);
      console.error('Error creating GIF:', error);
    }
  }, [canvasRef, isGeneratingGif]);

  return (
    <div 
      className={`flex min-h-[100dvh] flex-col items-center md:justify-center w-full overflow-x-hidden md:fixed md:inset-0 ${isDragging ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="w-full max-w-7xl px-6 py-6 md:py-0">
        <div className="relative flex flex-col items-center">
          {isInitialLoading && (
            <div className="loading-overlay">
              <span className="loading-text">Loading Components</span>
            </div>
          )}
          {isUploading && (
            <div className="loading-overlay">
              <span className="loading-text">Loading Uploaded Image</span>
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-24 md:gap-48 items-center justify-center w-full max-w-[1400px] mx-auto p-24">
            <div className="relative w-full h-full">
              <div
                className={`absolute inset-0 flex items-center justify-center ${
                  isInitialLoading || isUploading ? 'opacity-100' : 'opacity-0 pointer-events-none'
                } transition-opacity duration-500`}
              >
                <div className="loading"></div>
              </div>
              <div
                className={`absolute inset-0 ${
                  isInitialLoading || isUploading ? 'opacity-0' : 'opacity-100'
                } transition-opacity duration-500`}
              >
                {imageData && <Canvas imageData={imageData} params={state} canvasRef={canvasRef} />}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button
                    onClick={handleGifDownload}
                    disabled={isGeneratingGif}
                    className={`bg-black/20 hover:bg-black/30 text-white p-3 rounded-lg transition-all duration-200 ease-in-out backdrop-blur-sm border border-white/20 hover:border-white/40 z-10 touch-manipulation ${isGeneratingGif ? 'generating-gif cursor-wait' : ''}`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <svg width="24" height="24" viewBox="-2.7 -2.7 20.40 20.40" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000" strokeWidth="0.00015000000000000001"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#000000" strokeWidth="0.72"> <path d="M2.5 10.5H2V11H2.5V10.5ZM4.5 10.5V11H5V10.5H4.5ZM13.5 3.5H14V3.29289L13.8536 3.14645L13.5 3.5ZM10.5 0.5L10.8536 0.146447L10.7071 0H10.5V0.5ZM2 6V10.5H3V6H2ZM2.5 11H4.5V10H2.5V11ZM5 10.5V8.5H4V10.5H5ZM3 7H5V6H3V7ZM2 5V1.5H1V5H2ZM13 3.5V5H14V3.5H13ZM2.5 1H10.5V0H2.5V1ZM10.1464 0.853553L13.1464 3.85355L13.8536 3.14645L10.8536 0.146447L10.1464 0.853553ZM2 1.5C2 1.22386 2.22386 1 2.5 1V0C1.67157 0 1 0.671573 1 1.5H2ZM1 12V13.5H2V12H1ZM2.5 15H12.5V14H2.5V15ZM14 13.5V12H13V13.5H14ZM12.5 15C13.3284 15 14 14.3284 14 13.5H13C13 13.7761 12.7761 14 12.5 14V15ZM1 13.5C1 14.3284 1.67157 15 2.5 15V14C2.22386 14 2 13.7761 2 13.5H1ZM6 7H9V6H6V7ZM6 11H9V10H6V11ZM7 6.5V10.5H8V6.5H7ZM10.5 7H13V6H10.5V7ZM10 6V11H11V6H10ZM10.5 9H12V8H10.5V9Z" fill="#ffffff"></path> </g><g id="SVGRepo_iconCarrier"> <path d="M2.5 10.5H2V11H2.5V10.5ZM4.5 10.5V11H5V10.5H4.5ZM13.5 3.5H14V3.29289L13.8536 3.14645L13.5 3.5ZM10.5 0.5L10.8536 0.146447L10.7071 0H10.5V0.5ZM2 6V10.5H3V6H2ZM2.5 11H4.5V10H2.5V11ZM5 10.5V8.5H4V10.5H5ZM3 7H5V6H3V7ZM2 5V1.5H1V5H2ZM13 3.5V5H14V3.5H13ZM2.5 1H10.5V0H2.5V1ZM10.1464 0.853553L13.1464 3.85355L13.8536 3.14645L10.8536 0.146447L10.1464 0.853553ZM2 1.5C2 1.22386 2.22386 1 2.5 1V0C1.67157 0 1 0.671573 1 1.5H2ZM1 12V13.5H2V12H1ZM2.5 15H12.5V14H2.5V15ZM14 13.5V12H13V13.5H14ZM12.5 15C13.3284 15 14 14.3284 14 13.5H13C13 13.7761 12.7761 14 12.5 14V15ZM1 13.5C1 14.3284 1.67157 15 2.5 15V14C2.22386 14 2 13.7761 2 13.5H1ZM6 7H9V6H6V7ZM6 11H9V10H6V11ZM7 6.5V10.5H8V6.5H7ZM10.5 7H13V6H10.5V7ZM10 6V11H11V6H10ZM10.5 9H12V8H10.5V9Z" fill="#ffffff"></path> </g></svg>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="bg-black/20 hover:bg-black/30 text-white p-3 rounded-lg transition-all duration-200 ease-in-out backdrop-blur-sm border border-white/20 hover:border-white/40 z-10 touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000" strokeWidth="0.00024000000000000003"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#000000" strokeWidth="1.488"> <path d="M5.625 15C5.625 14.5858 5.28921 14.25 4.875 14.25C4.46079 14.25 4.125 14.5858 4.125 15H5.625ZM4.875 16H4.125H4.875ZM19.275 15C19.275 14.5858 18.9392 14.25 18.525 14.25C18.1108 14.25 17.775 14.5858 17.775 15H19.275ZM11.1086 15.5387C10.8539 15.8653 10.9121 16.3366 11.2387 16.5914C11.5653 16.8461 12.0366 16.7879 12.2914 16.4613L11.1086 15.5387ZM16.1914 11.4613C16.4461 11.1347 16.3879 10.6634 16.0613 10.4086C15.7347 10.1539 15.2634 10.2121 15.0086 10.5387L16.1914 11.4613ZM11.1086 16.4613C11.3634 16.7879 11.8347 16.8461 12.1613 16.5914C12.4879 16.3366 12.5461 15.8653 12.2914 15.5387L11.1086 16.4613ZM8.39138 10.5387C8.13662 10.2121 7.66533 10.1539 7.33873 10.4086C7.01212 10.6634 6.95387 11.1347 7.20862 11.4613L8.39138 10.5387ZM10.95 16C10.95 16.4142 11.2858 16.75 11.7 16.75C12.1142 16.75 12.45 16.4142 12.45 16H10.95ZM12.45 5C12.45 4.58579 12.1142 4.25 11.7 4.25C11.2858 4.25 10.95 4.58579 10.95 5H12.45ZM4.125 15V16H5.625V15H4.125ZM4.125 16C4.125 18.0531 5.75257 19.75 7.8 19.75V18.25C6.61657 18.25 5.625 17.2607 5.625 16H4.125ZM7.8 19.75H15.6V18.25H7.8V19.75ZM15.6 19.75C17.6474 19.75 19.275 18.0531 19.275 16H17.775C17.775 17.2607 16.7834 18.25 15.6 18.25V19.75ZM19.275 16V15H17.775V16H19.275ZM12.2914 16.4613L16.1914 11.4613L15.0086 10.5387L11.1086 15.5387L12.2914 16.4613ZM12.2914 15.5387L8.39138 10.5387L7.20862 11.4613L11.1086 16.4613L12.2914 15.5387ZM12.45 16V5H10.95V16H12.45Z" fill="#ffffff"></path> </g><g id="SVGRepo_iconCarrier"> <path d="M5.625 15C5.625 14.5858 5.28921 14.25 4.875 14.25C4.46079 14.25 4.125 14.5858 4.125 15H5.625ZM4.875 16H4.125H4.875ZM19.275 15C19.275 14.5858 18.9392 14.25 18.525 14.25C18.1108 14.25 17.775 14.5858 17.775 15H19.275ZM11.1086 15.5387C10.8539 15.8653 10.9121 16.3366 11.2387 16.5914C11.5653 16.8461 12.0366 16.7879 12.2914 16.4613L11.1086 15.5387ZM16.1914 11.4613C16.4461 11.1347 16.3879 10.6634 16.0613 10.4086C15.7347 10.1539 15.2634 10.2121 15.0086 10.5387L16.1914 11.4613ZM11.1086 16.4613C11.3634 16.7879 11.8347 16.8461 12.1613 16.5914C12.4879 16.3366 12.5461 15.8653 12.2914 15.5387L11.1086 16.4613ZM8.39138 10.5387C8.13662 10.2121 7.66533 10.1539 7.33873 10.4086C7.01212 10.6634 6.95387 11.1347 7.20862 11.4613L8.39138 10.5387ZM10.95 16C10.95 16.4142 11.2858 16.75 11.7 16.75C12.1142 16.75 12.45 16.4142 12.45 16H10.95ZM12.45 5C12.45 4.58579 12.1142 4.25 11.7 4.25C11.2858 4.25 10.95 4.58579 10.95 5H12.45ZM4.125 15V16H5.625V15H4.125ZM4.125 16C4.125 18.0531 5.75257 19.75 7.8 19.75V18.25C6.61657 18.25 5.625 17.2607 5.625 16H4.125ZM7.8 19.75H15.6V18.25H7.8V19.75ZM15.6 19.75C17.6474 19.75 19.275 18.0531 19.275 16H17.775C17.775 17.2607 16.7834 18.25 15.6 18.25V19.75ZM19.275 16V15H17.775V16H19.275ZM12.2914 16.4613L16.1914 11.4613L15.0086 10.5387L11.1086 15.5387L12.2914 16.4613ZM12.2914 15.5387L8.39138 10.5387L7.20862 11.4613L11.1086 16.4613L12.2914 15.5387ZM12.45 16V5H10.95V16H12.45Z" fill="#ffffff"></path> </g></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full md:w-[600px] space-y-24 rounded-2xl border border-white/10 bg-black/40 p-24 backdrop-blur">
              <div className="grid grid-cols-[120px_1fr] items-center gap-3 rounded-xl bg-black/20 p-3">
                <div>
                  <label className="text-nowrap">Background</label>
                </div>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setState({ ...state, background: '#ffffff' })}
                    className={`h-16 w-16 rounded-full bg-white transition-transform hover:scale-110 ${
                      state.background === '#ffffff' ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                    }`}
                  />
                  <button
                    onClick={() => setState({ ...state, background: '#eeeeee' })}
                    className={`h-16 w-16 rounded-full bg-[#eeeeee] transition-transform hover:scale-110 ${
                      state.background === '#eeeeee' ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                    }`}
                  />
                  <button
                    onClick={() => setState({ ...state, background: 'metal' })}
                    className={`h-16 w-16 rounded-full bg-gradient-to-b from-[#eeeeee] to-[#b8b8b8] transition-transform hover:scale-110 ${
                      state.background === 'metal' ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                    }`}
                  />
                  <button
                    onClick={() => setState({ ...state, background: '#000000' })}
                    className={`h-16 w-16 rounded-full bg-black transition-transform hover:scale-110 ${
                      state.background === '#000000' ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                    }`}
                  />
                  <label
                    className="h-16 w-16 cursor-pointer rounded-full text-[0px] transition-transform hover:scale-110 focus-within:cursor-default [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-focus"
                    style={{
                      background: `
                        radial-gradient(circle, white, transparent 65%),
                        conic-gradient(
                          in oklch,
                          oklch(63.2% 0.254 30),
                          oklch(79% 0.171 70),
                          oklch(96.7% 0.211 110),
                          oklch(87.4% 0.241 150),
                          oklch(90.2% 0.156 190),
                          oklch(76.2% 0.152 230),
                          oklch(46.5% 0.305 270),
                          oklch(59.5% 0.301 310),
                          oklch(65.9% 0.275 350),
                          oklch(63.2% 0.254 30)
                        )
                      `,
                    }}
                  >
                    <input
                      className="h-0 w-0"
                      type="color"
                      onChange={(event) => setState({ ...state, background: event.currentTarget.value })}
                    />
                    Custom
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl bg-black/20 p-3">
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Refraction</label>
                  <Control
                    value={state.refraction}
                    min={params.refraction.min}
                    max={params.refraction.max}
                    step={params.refraction.step}
                    onValueChange={(value) => setState((state) => ({ ...state, refraction: value }))}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Edge</label>
                  <Control
                    value={state.edge}
                    min={params.edge.min}
                    max={params.edge.max}
                    step={params.edge.step}
                    onValueChange={(value) => setState((state) => ({ ...state, edge: value }))}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Pattern Blur</label>
                  <Control
                    value={state.patternBlur}
                    min={params.patternBlur.min}
                    max={params.patternBlur.max}
                    step={params.patternBlur.step}
                    onValueChange={(value) => setState((state) => ({ ...state, patternBlur: value }))}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Liquify</label>
                  <Control
                    value={state.liquid}
                    min={params.liquid.min}
                    max={params.liquid.max}
                    step={params.liquid.step}
                    onValueChange={(value) => setState((state) => ({ ...state, liquid: value }))}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Speed</label>
                  <Control
                    value={state.speed}
                    min={params.speed.min}
                    max={params.speed.max}
                    step={params.speed.step}
                    onValueChange={(value) => setState((state) => ({ ...state, speed: value }))}
                  />
                </div>

                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <label className="text-nowrap">Pattern Scale</label>
                  <Control
                    value={state.patternScale}
                    min={params.patternScale.min}
                    max={params.patternScale.max}
                    step={params.patternScale.step}
                    onValueChange={(value) => setState((state) => ({ ...state, patternScale: value }))}
                  />
                </div>
              </div>

              <div className="space-y-24">
                <div className="rounded-8 bg-black/20 p-3">
                  <label
                    className="mb-3 flex h-40 w-full cursor-pointer items-center justify-center rounded-4 bg-button font-medium select-none"
                  >
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*,.svg"
                      onChange={handleFileInput}
                    />
                    Upload image
                  </label>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  {[
                    { name: 'Punisher', href: '/liquid-metal-drbaph/logos/punisher.svg' },
                    { name: 'DC Shoes', href: '/liquid-metal-drbaph/logos/dcshoes.svg' },
                    { name: 'GitHub', href: '/liquid-metal-drbaph/logos/github.svg' },
                    { name: 'Linux', href: '/liquid-metal-drbaph/logos/linux.svg' },
                    { name: 'Hugging Face', href: '/liquid-metal-drbaph/logos/huggingface.svg' },
                  ].map(({ name, href }) => (
                    <button
                      key={href}
                      onClick={async () => {
                        try {
                          const response = await fetch(href);
                          const blob = await response.blob();
                          const file = new File([blob], 'logo.svg', { type: 'image/svg+xml' });
                          const { imageData: newImageData } = await parseLogoImage(file);
                          setImageData(newImageData);
                        } catch (error) {
                          console.error('Error loading logo:', error);
                        }
                      }}
                      className="group"
                    >
                      <div className="flex h-[88px] w-[88px] md:h-[100px] md:w-[100px] items-center justify-center rounded-8 transition-all duration-200 p-5">
                        <img
                          alt={`${name} Logo`}
                          src={href}
                          className={`h-full w-full object-contain opacity-30 transition-all duration-200 group-hover:opacity-100 ${
                            !['DC Shoes', 'Hugging Face'].includes(name) ? 'brightness-0 invert' : ''
                          }`}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-black/20 p-3 overflow-hidden w-full hidden md:block">
                  <div className="flex flex-col gap-2 text-sm opacity-50 overflow-hidden w-full">
                    <div className="typing-effect-container flex flex-col">
                      <span className="typing-effect">root@drbaph:~# transparent or white background is required</span>
                      <span className="typing-effect">root@drbaph:~# shapes work better than words</span>
                      <span className="typing-effect">root@drbaph:~# use an svg or a high-resolution image</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  format = (value) => value,
  onValueChange,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: string) => string;
  onValueChange: (value: number) => void;
}) {
  return (
    <Slider.Root min={min} max={max} step={step} value={[value]} onValueChange={([value]) => onValueChange(value)}>
      <Slider.Track className="relative flex h-32 w-full touch-none items-center rounded-full select-none">
        <span inert className="absolute inset-x-0 h-6 rounded-full bg-white/20" />
        <Slider.Range className="absolute h-6 rounded-full bg-blue select-none" />
        <Slider.Thumb
          tabIndex={-1}
          className="block size-16 rounded-full bg-white outline-focus select-none focus-visible:outline-2"
          style={{ boxShadow: '0 2px 6px -2px black' }}
        />
      </Slider.Track>
    </Slider.Root>
  );
}
