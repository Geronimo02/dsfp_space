import { useSSEStream } from "@/hooks/useSSEStream";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

/**
 * EJEMPLO 1: Uso básico del hook useSSEStream
 */
export function BasicStreamingExample() {
  const [prompt, setPrompt] = useState("");
  
  const { text, isStreaming, error, startStream, stopStream } = useSSEStream({
    onComplete: (fullText) => {
      console.log("Completado:", fullText);
    },
    onError: (err) => {
      console.error("Error:", err);
    }
  });

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    await startStream("ai-assistant-stream", {
      query: prompt,
      type: "search",
      companyId: "your-company-id"
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribe tu consulta..."
          disabled={isStreaming}
        />
        <Button 
          onClick={isStreaming ? stopStream : handleSubmit}
          variant={isStreaming ? "destructive" : "default"}
        >
          {isStreaming ? "Detener" : "Enviar"}
        </Button>
      </div>
      
      {(text || isStreaming) && (
        <div className="bg-muted p-4 rounded-lg min-h-[100px]">
          {text}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </div>
      )}
      
      {error && (
        <div className="text-destructive text-sm">
          Error: {error}
        </div>
      )}
    </Card>
  );
}

/**
 * EJEMPLO 2: Streaming con historial de chat
 */
export function ChatStreamingExample() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");

  const { text, isStreaming, startStream } = useSSEStream({
    onComplete: (fullText) => {
      // Agregar mensaje completo al historial
      setMessages(prev => [...prev, { role: "assistant", content: fullText }]);
    }
  });

  const handleSend = async () => {
    if (!input.trim()) return;

    // Agregar mensaje del usuario
    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    // Iniciar streaming con historial
    await startStream("ai-assistant-stream", {
      query: input,
      conversationHistory: messages
    });
  };

  return (
    <div className="space-y-4">
      {/* Historial de mensajes */}
      <div className="space-y-2">
        {messages.map((msg, i) => (
          <div 
            key={i}
            className={`p-3 rounded-lg ${
              msg.role === "user" 
                ? "bg-primary text-primary-foreground ml-8" 
                : "bg-muted mr-8"
            }`}
          >
            {msg.content}
          </div>
        ))}
        
        {/* Mensaje en streaming */}
        {isStreaming && text && (
          <div className="p-3 rounded-lg bg-muted mr-8">
            {text}
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Escribe un mensaje..."
          disabled={isStreaming}
        />
        <Button onClick={handleSend} disabled={isStreaming}>
          Enviar
        </Button>
      </div>
    </div>
  );
}

/**
 * EJEMPLO 3: Streaming con typing effect mejorado
 */
export function TypewriterStreamingExample() {
  const [displayText, setDisplayText] = useState("");
  const [buffer, setBuffer] = useState("");

  const { isStreaming, startStream } = useSSEStream({
    onChunk: (chunk) => {
      // Acumular en buffer
      setBuffer(prev => prev + chunk);
    },
    onComplete: (fullText) => {
      setDisplayText(fullText);
      setBuffer("");
    }
  });

  // Efecto typewriter (mostrar buffer letra por letra)
  useState(() => {
    if (!buffer) return;

    const interval = setInterval(() => {
      setBuffer(prev => {
        if (prev.length === 0) {
          clearInterval(interval);
          return "";
        }
        
        const char = prev[0];
        setDisplayText(d => d + char);
        return prev.slice(1);
      });
    }, 20); // 20ms por caracter = efecto typewriter

    return () => clearInterval(interval);
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => startStream("ai-assistant-stream", { query: "test" })}>
        Start Typewriter Effect
      </Button>
      
      <div className="bg-muted p-4 rounded-lg font-mono">
        {displayText}
        {(isStreaming || buffer) && <span className="animate-pulse">▊</span>}
      </div>
    </div>
  );
}

/**
 * EJEMPLO 4: Streaming con markdown parsing en tiempo real
 */
export function MarkdownStreamingExample() {
  const { text, isStreaming, startStream } = useSSEStream();

  // Función simple para parsear markdown básico
  const parseMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => startStream("ai-assistant-stream", { 
        query: "Dame una lista en formato markdown" 
      })}>
        Generate Markdown
      </Button>
      
      <div 
        className="bg-muted p-4 rounded-lg prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ 
          __html: parseMarkdown(text) + (isStreaming ? '<span class="animate-pulse">▊</span>' : '')
        }}
      />
    </div>
  );
}

/**
 * EJEMPLO 5: Streaming con auto-scroll
 */
export function AutoScrollStreamingExample() {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { text, isStreaming, startStream } = useSSEStream({
    onChunk: () => {
      // Auto-scroll en cada chunk
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => startStream("ai-assistant-stream", { 
        query: "Dame un análisis largo con muchas líneas" 
      })}>
        Start Long Response
      </Button>
      
      <div 
        ref={scrollRef}
        className="bg-muted p-4 rounded-lg h-[300px] overflow-y-auto"
      >
        <pre className="whitespace-pre-wrap font-sans">
          {text}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </pre>
      </div>
    </div>
  );
}

/**
 * EJEMPLO 6: Streaming con métricas de performance
 */
export function PerformanceMetricsExample() {
  const [metrics, setMetrics] = useState({
    startTime: 0,
    firstTokenTime: 0,
    endTime: 0,
    totalChunks: 0,
    totalChars: 0
  });

  const { text, isStreaming, startStream } = useSSEStream({
    onChunk: (chunk) => {
      setMetrics(prev => {
        const firstToken = prev.firstTokenTime === 0 ? Date.now() : prev.firstTokenTime;
        return {
          ...prev,
          firstTokenTime: firstToken,
          totalChunks: prev.totalChunks + 1,
          totalChars: prev.totalChars + chunk.length
        };
      });
    },
    onComplete: () => {
      setMetrics(prev => ({ ...prev, endTime: Date.now() }));
    }
  });

  const handleStart = async () => {
    setMetrics({ startTime: Date.now(), firstTokenTime: 0, endTime: 0, totalChunks: 0, totalChars: 0 });
    await startStream("ai-assistant-stream", { query: "test" });
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleStart}>Start with Metrics</Button>
      
      <div className="bg-muted p-4 rounded-lg">
        {text}
        {isStreaming && <span className="animate-pulse">▊</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Time to First Token: {metrics.firstTokenTime - metrics.startTime}ms</div>
        <div>Total Time: {metrics.endTime - metrics.startTime}ms</div>
        <div>Total Chunks: {metrics.totalChunks}</div>
        <div>Total Characters: {metrics.totalChars}</div>
      </div>
    </div>
  );
}

/**
 * EJEMPLO 7: Streaming con retry automático
 */
export function AutoRetryStreamingExample() {
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const { text, isStreaming, error, startStream } = useSSEStream({
    onError: async (err) => {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retry ${retryCount + 1}/${MAX_RETRIES}`);
        setRetryCount(prev => prev + 1);
        
        // Wait 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        await startStream("ai-assistant-stream", { query: "test" });
      }
    },
    onComplete: () => {
      setRetryCount(0); // Reset on success
    }
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => startStream("ai-assistant-stream", { query: "test" })}>
        Start with Auto-Retry
      </Button>
      
      {retryCount > 0 && (
        <div className="text-sm text-muted-foreground">
          Retrying... ({retryCount}/{MAX_RETRIES})
        </div>
      )}

      <div className="bg-muted p-4 rounded-lg">
        {text}
        {isStreaming && <span className="animate-pulse">▊</span>}
      </div>

      {error && retryCount >= MAX_RETRIES && (
        <div className="text-destructive text-sm">
          Failed after {MAX_RETRIES} retries: {error}
        </div>
      )}
    </div>
  );
}
