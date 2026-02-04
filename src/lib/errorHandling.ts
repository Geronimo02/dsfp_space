/**
 * Error handling utilities for better user feedback
 */

export interface ErrorContext {
  operation?: string;
  resource?: string;
  details?: string;
}

/**
 * Convert error to user-friendly message
 */
export function getErrorMessage(error: unknown, context?: ErrorContext): string {
  // Handle known error types
  if (error instanceof Error) {
    // Supabase auth errors
    if (error.message.includes('Invalid login credentials')) {
      return 'Email o contraseña incorrectos. Por favor, verifica tus datos.';
    }
    if (error.message.includes('Email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.';
    }
    if (error.message.includes('User already registered')) {
      return 'Este email ya está registrado. ¿Olvidaste tu contraseña?';
    }

    // Database errors
    if (error.message.includes('duplicate key')) {
      return context?.resource
        ? `Ya existe un ${context.resource} con estos datos.`
        : 'Ya existe un registro con estos datos.';
    }
    if (error.message.includes('foreign key constraint')) {
      return 'No se puede eliminar porque tiene registros relacionados.';
    }
    if (error.message.includes('violates check constraint')) {
      return 'Los datos ingresados no cumplen con las validaciones requeridas.';
    }

    // Network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
      return 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.';
    }

    // Permission errors
    if (error.message.includes('permission denied') || error.message.includes('unauthorized')) {
      return 'No tienes permisos para realizar esta acción.';
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return 'La operación tardó demasiado. Por favor, intenta nuevamente.';
    }

    // Return original message if no match
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle objects with error property
  if (error && typeof error === 'object' && 'error' in error) {
    return getErrorMessage((error as any).error, context);
  }

  // Default message
  if (context?.operation) {
    return `Error al ${context.operation}. Por favor, intenta nuevamente.`;
  }

  return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
}

/**
 * Create contextual error message
 */
export function createErrorMessage(
  operation: string,
  resource: string,
  error: unknown
): string {
  return getErrorMessage(error, { operation, resource });
}

/**
 * Error messages for common operations
 */
export const ErrorMessages = {
  // CRUD operations
  CREATE_FAILED: (resource: string) => `Error al crear ${resource}`,
  UPDATE_FAILED: (resource: string) => `Error al actualizar ${resource}`,
  DELETE_FAILED: (resource: string) => `Error al eliminar ${resource}`,
  FETCH_FAILED: (resource: string) => `Error al cargar ${resource}`,

  // Validation
  REQUIRED_FIELD: (field: string) => `El campo ${field} es requerido`,
  INVALID_EMAIL: 'Email inválido',
  INVALID_PHONE: 'Teléfono inválido',
  INVALID_FORMAT: (field: string) => `Formato inválido en ${field}`,
  
  // Auth
  SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  UNAUTHORIZED: 'No tienes autorización para realizar esta acción.',
  
  // Network
  NO_CONNECTION: 'Sin conexión a internet. Verifica tu conexión.',
  TIMEOUT: 'La operación tardó demasiado. Intenta nuevamente.',
  
  // Business logic
  INSUFFICIENT_STOCK: 'Stock insuficiente para completar la operación.',
  DUPLICATE_ENTRY: 'Ya existe un registro con estos datos.',
  INVALID_OPERATION: 'Operación no permitida en el estado actual.',
} as const;

/**
 * Success messages for common operations
 */
export const SuccessMessages = {
  CREATED: (resource: string) => `${resource} creado exitosamente`,
  UPDATED: (resource: string) => `${resource} actualizado exitosamente`,
  DELETED: (resource: string) => `${resource} eliminado exitosamente`,
  SAVED: (resource: string) => `${resource} guardado exitosamente`,
  SENT: (resource: string) => `${resource} enviado exitosamente`,
} as const;

/**
 * Log error in development mode
 */
export function logError(error: unknown, context?: ErrorContext): void {
  if (import.meta.env.DEV) {
    console.error('[Error]', context, error);
  }
}

/**
 * Handle error with toast notification
 */
export function handleError(
  error: unknown,
  context?: ErrorContext,
  options?: { toast?: (message: string) => void }
): void {
  const message = getErrorMessage(error, context);
  logError(error, context);
  
  if (options?.toast) {
    options.toast(message);
  }
}
