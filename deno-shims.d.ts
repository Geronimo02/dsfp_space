// Global shims to help the TypeScript server in editors resolve Deno/remote imports
declare module "https://deno.land/*" {
  // Provide named export 'serve' used by edge functions
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const _default: any;
  export default _default;
}

declare module "https://esm.sh/*" {
  // Provide named export 'createClient' used in the code
  export function createClient(...args: any[]): any;
  const _default: any;
  export default _default;
}

declare module "https://cdn.jsdelivr.net/*" { const x: any; export default x; }

declare const Deno: any;

// Minimal mapping for std/http server path
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
