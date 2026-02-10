import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SSEMessage {
  content: string;
  error?: string;
}

export interface UseSSEStreamOptions {
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
  onChunk?: (chunk: string) => void;
}

export const useSSEStream = (options: UseSSEStreamOptions = {}) => {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    async (
      functionName: string,
      body: Record<string, any>
    ) => {
      // Reset state
      setText("");
      setError(null);
      setIsStreaming(true);

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Get auth session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No hay sesión activa");
        }

        // Build the full URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error("VITE_SUPABASE_URL no está configurada");
        }

        const url = `${supabaseUrl}/functions/v1/${functionName}`;

        // Make the streaming request
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Error ${response.status}`);
        }

        // Check if response is SSE
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("text/event-stream")) {
          throw new Error("La respuesta no es un stream SSE");
        }

        // Read the stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No se pudo leer el stream");
        }

        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              // Check for completion signal
              if (data === "[DONE]") {
                setIsStreaming(false);
                if (options.onComplete) {
                  options.onComplete(accumulatedText);
                }
                return;
              }

              try {
                const parsed: SSEMessage = JSON.parse(data);

                // Handle error in stream
                if (parsed.error) {
                  setError(parsed.error);
                  if (options.onError) {
                    options.onError(parsed.error);
                  }
                  setIsStreaming(false);
                  return;
                }

                // Add content to accumulated text
                if (parsed.content) {
                  accumulatedText += parsed.content;
                  setText(accumulatedText);

                  // Call chunk callback
                  if (options.onChunk) {
                    options.onChunk(parsed.content);
                  }
                }
              } catch (e) {
                // Skip invalid JSON
                console.warn("Error parsing SSE data:", e);
              }
            }
          }
        }

        setIsStreaming(false);
        if (options.onComplete) {
          options.onComplete(accumulatedText);
        }
      } catch (err) {
        // Don't set error if aborted (user stopped manually)
        if (err instanceof Error && err.name === "AbortError") {
          console.log("Stream aborted by user");
          setIsStreaming(false);
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Error en el streaming";
        setError(errorMessage);
        setIsStreaming(false);

        if (options.onError) {
          options.onError(errorMessage);
        }
      }
    },
    [options]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    text,
    isStreaming,
    error,
    startStream,
    stopStream,
  };
};
