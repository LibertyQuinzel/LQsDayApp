export {};

declare global {
  interface Window {
    myDay?: {
      readState: () => Promise<unknown>;
      writeState: (state: unknown) => void;
      notify: (options: { title: string; body?: string }) => Promise<boolean>;
    };
  }
}
