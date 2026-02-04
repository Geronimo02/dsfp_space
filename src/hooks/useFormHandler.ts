import { useForm, UseFormProps, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "./use-toast";
import { getErrorMessage } from "@/lib/errorHandling";

interface UseFormHandlerOptions<TSchema extends z.ZodType> extends Omit<UseFormProps<z.infer<TSchema>>, "resolver"> {
  schema: TSchema;
  onSubmit: (data: z.infer<TSchema>) => Promise<void> | void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseFormHandlerReturn<TSchema extends z.ZodType> extends UseFormReturn<z.infer<TSchema>> {
  handleSubmit: () => (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Custom hook for handling forms with Zod validation and error handling
 * 
 * @example
 * ```tsx
 * const form = useFormHandler({
 *   schema: customerSchema,
 *   onSubmit: async (data) => {
 *     await supabase.from('customers').insert(data);
 *   },
 *   successMessage: "Cliente creado exitosamente",
 * });
 * 
 * <form onSubmit={form.handleSubmit()}>
 *   <InputField
 *     label="Nombre"
 *     {...form.register("name")}
 *     error={form.formState.errors.name}
 *   />
 *   <Button type="submit" disabled={form.isSubmitting}>
 *     Guardar
 *   </Button>
 * </form>
 * ```
 */
export function useFormHandler<TSchema extends z.ZodType>({
  schema,
  onSubmit,
  successMessage,
  errorMessage,
  ...formOptions
}: UseFormHandlerOptions<TSchema>): UseFormHandlerReturn<TSchema> {
  const { toast } = useToast();
  
  const form = useForm<z.infer<TSchema>>({
    ...formOptions,
    resolver: zodResolver(schema),
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      
      if (successMessage) {
        toast({
          title: "Éxito",
          description: successMessage,
        });
      }
      
      // Reset form on success if specified
      if (formOptions.mode === "onSubmit") {
        form.reset();
      }
    } catch (error) {
      const message = errorMessage || getErrorMessage(error);
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      
      if (import.meta.env.DEV) {
        console.error("Form submission error:", error);
      }
    }
  });

  return {
    ...form,
    handleSubmit: () => handleFormSubmit,
    isSubmitting: form.formState.isSubmitting,
  };
}
