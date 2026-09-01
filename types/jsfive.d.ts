declare module 'jsfive' {
  export class File {
    constructor(buffer: ArrayBuffer, filename?: string);
    get(path: string): {
      value: unknown;
      shape: number[];
      dtype?: string;
      attrs?: Record<string, unknown>;
    };
  }
}
