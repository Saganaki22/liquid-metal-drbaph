'use client';

/** Cleans up the input image by turning it into a black and white mask with a beveled edge */

export function parseLogoImage(file: File): Promise<{ imageData: ImageData; pngBlob: Blob }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return new Promise((resolve, reject) => {
    if (!file || !ctx) {
      reject(new Error('Invalid file or context'));
      return;
    }

    const img = new Image();
    img.onload = function () {
      const MAX_SIZE = 1000;
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      // Calculate new dimensions if image is too large
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the user image on an offscreen canvas.
      const shapeCanvas = document.createElement('canvas');
      shapeCanvas.width = width;
      shapeCanvas.height = height;
      const shapeCtx = shapeCanvas.getContext('2d')!;
      shapeCtx.drawImage(img, 0, 0, width, height);

      // 1) Build the inside/outside mask:
      // Non-shape pixels: pure white (255,255,255,255) or fully transparent.
      // Everything else is part of a shape.
      const shapeImageData = shapeCtx.getImageData(0, 0, width, height);
      const data = shapeImageData.data;
      const shapeMask = new Array(width * height).fill(false);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var idx4 = (y * width + x) * 4;
          var r = data[idx4];
          var g = data[idx4 + 1];
          var b = data[idx4 + 2];
          var a = data[idx4 + 3];
          if ((r === 255 && g === 255 && b === 255 && a === 255) || a === 0) {
            shapeMask[y * width + x] = false;
          } else {
            shapeMask[y * width + x] = true;
          }
        }
      }

      function inside(x: number, y: number) {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return shapeMask[y * width + x];
      }

      // 2) Identify boundary (pixels that have at least one non-shape neighbor)
      var boundaryMask = new Array(width * height).fill(false);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var idx = y * width + x;
          if (!shapeMask[idx]) continue;
          var isBoundary = false;
          for (var ny = y - 1; ny <= y + 1 && !isBoundary; ny++) {
            for (var nx = x - 1; nx <= x + 1 && !isBoundary; nx++) {
              if (!inside(nx, ny)) {
                isBoundary = true;
              }
            }
          }
          if (isBoundary) {
            boundaryMask[idx] = true;
          }
        }
      }

      // 3) Poisson solve: Δu = -C (i.e. u_xx + u_yy = C), with u=0 at the boundary.
      var u = new Float32Array(width * height).fill(0);
      var newU = new Float32Array(width * height).fill(0);
      var C = 0.01;
      var ITERATIONS = 300;

      function getU(x: number, y: number, arr: Float32Array) {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        if (!shapeMask[y * width + x]) return 0;
        return arr[y * width + x];
      }

      for (var iter = 0; iter < ITERATIONS; iter++) {
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            var idx = y * width + x;
            if (!shapeMask[idx] || boundaryMask[idx]) {
              newU[idx] = 0;
              continue;
            }
            var sumN = getU(x + 1, y, u) + getU(x - 1, y, u) + getU(x, y + 1, u) + getU(x, y - 1, u);
            newU[idx] = (C + sumN) / 4;
          }
        }
        // Swap u with newU
        for (var i = 0; i < width * height; i++) {
          u[i] = newU[i];
        }
      }

      // 4) Normalize the solution and apply a nonlinear remap.
      var maxVal = 0;
      for (var i = 0; i < width * height; i++) {
        if (u[i] > maxVal) maxVal = u[i];
      }
      const alpha = 2.0; // Adjust for contrast.
      const outImg = ctx.createImageData(width, height);

      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var idx = y * width + x;
          var px = idx * 4;
          if (!shapeMask[idx]) {
            outImg.data[px] = 255;
            outImg.data[px + 1] = 255;
            outImg.data[px + 2] = 255;
            outImg.data[px + 3] = 255;
          } else {
            const raw = u[idx] / maxVal;
            const remapped = Math.pow(raw, alpha);
            const gray = 255 * (1 - remapped);
            outImg.data[px] = gray;
            outImg.data[px + 1] = gray;
            outImg.data[px + 2] = gray;
            outImg.data[px + 3] = 255;
          }
        }
      }
      ctx.putImageData(outImg, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG blob'));
          return;
        }
        resolve({
          imageData: outImg,
          pngBlob: blob,
        });
      }, 'image/png');
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
