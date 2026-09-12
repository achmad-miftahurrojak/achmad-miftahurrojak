declare module 'gif-encoder-2' {
  import { Writable } from 'stream';
  
  class GIFEncoder {
    constructor(width: number, height: number);
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setQuality(quality: number): void;
    addFrame(ctx: any): void;
    finish(): void;
    out: { getData(): Buffer };
  }
  
  export default GIFEncoder;
}