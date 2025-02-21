declare module 'gif.js' {
  export interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    background?: string;
    repeat?: number;
  }

  export default class GIF {
    constructor(options: GIFOptions);
    addFrame(imageElement: HTMLImageElement | HTMLCanvasElement, options?: { delay?: number; copy?: boolean }): void;
    render(): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
  }
}
