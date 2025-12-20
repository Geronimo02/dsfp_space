import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Paperclip, X, FileIcon, Image, File, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface TicketAttachmentsProps {
  ticketId: string;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export function TicketAttachments({ 
  ticketId, 
  attachments = [], 
  onAttachmentsChange,
  readOnly = false 
}: TicketAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        // Check file size (50MB limit)
        if (file.size > 52428800) {
          toast.error(`${file.name} excede el límite de 50MB`);
          continue;
        }

        const fileName = `${ticketId}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("platform-support-attachments")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Error al subir ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("platform-support-attachments")
          .getPublicUrl(fileName);

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      if (newAttachments.length > 0) {
        const updatedAttachments = [...pendingFiles, ...newAttachments];
        setPendingFiles(updatedAttachments);
        onAttachmentsChange?.(updatedAttachments);
        toast.success(`${newAttachments.length} archivo(s) adjuntado(s)`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Error al subir archivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(updatedFiles);
    onAttachmentsChange?.(updatedFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const allAttachments = [...attachments, ...pendingFiles];

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.mp4,.mp3"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4 mr-2" />
            )}
            Adjuntar archivo
          </Button>
          <span className="text-xs text-muted-foreground">
            Máx 50MB por archivo
          </span>
        </div>
      )}

      {allAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {allAttachments.map((attachment, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border",
                "bg-muted/50 hover:bg-muted transition-colors"
              )}
            >
              {getFileIcon(attachment.type)}
              <div className="flex flex-col">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline truncate max-w-[150px]"
                  title={attachment.name}
                >
                  {attachment.name}
                </a>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="p-1 hover:bg-background rounded"
                >
                  <Download className="h-3 w-3" />
                </a>
                {!readOnly && index >= attachments.length && (
                  <button
                    type="button"
                    onClick={() => removeFile(index - attachments.length)}
                    className="p-1 hover:bg-background rounded text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
