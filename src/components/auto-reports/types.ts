export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface AutoReportPreset {
  id: string;
  name: string;
  frequency: Frequency;
  enabled: boolean;
  createdAt: string;
}

export type AutoReportFormData = Omit<AutoReportPreset, 'id' | 'createdAt' | 'enabled'>;

export interface PresetFormProps {
  onSubmit: (data: AutoReportFormData) => void;
  defaultValues?: Partial<AutoReportFormData>;
  isEditing?: boolean;
}

export interface PresetListProps {
  items: AutoReportPreset[];
  onEdit: (preset: AutoReportPreset) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  isLoading?: boolean;
  error?: Error | null;
}

export interface PresetCardProps {
  preset: AutoReportPreset;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}