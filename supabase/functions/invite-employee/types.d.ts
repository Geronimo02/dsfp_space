// Local declaration shims to help VSCode/tsserver resolve remote Deno imports
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(...args: any[]): any;
  const _default: any;
  export default _default;
}

// Basic Deno global shim for the editor
declare const Deno: any;

// Allow imports from esm.sh and deno.land without TS complaints
declare module "https://esm.sh/*" { const x: any; export default x; }
declare module "https://deno.land/*" { const x: any; export default x; }
