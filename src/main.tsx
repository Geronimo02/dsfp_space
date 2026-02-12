import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App from "./App.tsx";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		integrations: [new BrowserTracing()],
		tracesSampleRate: 0.1,
	});
}

const Root = sentryDsn ? Sentry.ErrorBoundary : ({ children }: { children: React.ReactNode }) => <>{children}</>;

createRoot(document.getElementById("root")!).render(
	<Root fallback={<div className="p-6 text-sm text-muted-foreground">Ocurrió un error inesperado.</div>}>
		<App />
	</Root>
);
