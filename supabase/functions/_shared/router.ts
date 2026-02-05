import { AuthContext } from "./auth.ts";

export type RouteHandler = (req: Request, auth: AuthContext, params: Record<string, string>) => Promise<Response>;

export type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
};

export class Router {
  private routes: Route[] = [];

  private pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const regexPattern = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    return {
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames,
    };
  }

  register(method: string, path: string, handler: RouteHandler) {
    const { pattern, paramNames } = this.pathToRegex(path);
    this.routes.push({ method: method.toUpperCase(), pattern, paramNames, handler });
  }

  get(path: string, handler: RouteHandler) {
    this.register("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.register("POST", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.register("PUT", path, handler);
  }

  patch(path: string, handler: RouteHandler) {
    this.register("PATCH", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.register("DELETE", path, handler);
  }

  match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const match = path.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = match[i + 1];
      }
      return { route, params };
    }
    return null;
  }
}
