import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface BaseFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  description?: string;
}

interface InputFieldProps extends BaseFieldProps {
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "date" | "time";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

interface TextareaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}

export function InputField({
  label,
  error,
  required,
  className,
  description,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  step,
}: InputFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={required ? "after:content-['*'] after:ml-1 after:text-destructive" : ""}>
        {label}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        step={step}
        className={error ? "border-destructive" : ""}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextareaField({
  label,
  error,
  required,
  className,
  description,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: TextareaFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={required ? "after:content-['*'] after:ml-1 after:text-destructive" : ""}>
        {label}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        className={error ? "border-destructive" : ""}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  required,
  className,
  description,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled,
}: SelectFieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={required ? "after:content-['*'] after:ml-1 after:text-destructive" : ""}>
        {label}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled} required={required}>
        <SelectTrigger
          id={id}
          className={error ? "border-destructive" : ""}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
