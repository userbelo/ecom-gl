declare global {
  interface Document {
    querySelector<E extends Element = HTMLElement>(
      selectors: string,
    ): E | null;
  }
}

export {};
