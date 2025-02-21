'use client';

/** Cleans up the input image by turning it into a black and white mask with a beveled edge */

export async function parseLogoImage(input: File | HTMLImageElement): Promise<{ imageData: ImageData }> {
  return new Promise(async (resolve, reject) => {
    try {
      let img: HTMLImageElement;
      
      if (input instanceof File) {
        // If input is a File, create an Image from it
        img = new Image();
        img.src = URL.createObjectURL(input);
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
      } else {
        // If input is already an HTMLImageElement, use it directly
        img = input;
      }

      // Force SVG to load at a high fidelity size if it's an SVG
      if (input instanceof File && input.type === 'image/svg+xml') {
        img.width = 1000; // or whatever base size you prefer
        img.height = 1000;
      }

      const MAX_SIZE = 1000;
      const MIN_SIZE = 500;
      let width = img.naturalWidth || img.width || 1000;
      let height = img.naturalHeight || img.height || 1000;

      // Calculate new dimensions if image is too large or too small
      if (width > MAX_SIZE || height > MAX_SIZE || width < MIN_SIZE || height < MIN_SIZE) {
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (width < MIN_SIZE) {
            height = Math.round((height * MIN_SIZE) / width);
            width = MIN_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          } else if (height < MIN_SIZE) {
            width = Math.round((width * MIN_SIZE) / height);
            height = MIN_SIZE;
          }
        }
      }

      // Create a canvas to draw the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');

      // Set canvas size to match image dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);

      // Clean up URL if we created one
      if (input instanceof File) {
        URL.revokeObjectURL(img.src);
      }

      resolve({ imageData });
    } catch (error) {
      reject(error);
    }
  });
}
