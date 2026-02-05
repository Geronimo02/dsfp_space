import { describe, it, expect } from 'vitest';
import { getErrorMessage, ErrorMessages } from '@/lib/errorHandling';

describe('errorHandling', () => {
  describe('getErrorMessage', () => {
    it('should handle duplicate key errors', () => {
      const error = new Error('duplicate key value');
      const message = getErrorMessage(error);
      expect(message).toContain('Ya existe un');
    });

    it('should handle foreign key constraint errors', () => {
      const error = new Error('foreign key constraint');
      const message = getErrorMessage(error);
      expect(message).toBe('No se puede eliminar porque tiene registros relacionados.');
    });

    it('should handle permission denied errors', () => {
      const error = new Error('permission denied');
      const message = getErrorMessage(error);
      expect(message).toBe('No tienes permisos para realizar esta acción.');
    });

    it('should handle unauthorized errors', () => {
      const error = new Error('unauthorized');
      const message = getErrorMessage(error);
      expect(message).toBe('No tienes permisos para realizar esta acción.');
    });

    it('should handle network errors', () => {
      const error = new Error('Failed to fetch');
      const message = getErrorMessage(error);
      expect(message).toBe('Error de conexión. Verifica tu conexión a internet e intenta nuevamente.');
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      const message = getErrorMessage(error);
      expect(message).toBe('La operación tardó demasiado. Por favor, intenta nuevamente.');
    });

    it('should handle check constraint validation errors', () => {
      const error = new Error('violates check constraint');
      const message = getErrorMessage(error);
      expect(message).toBe('Los datos ingresados no cumplen con las validaciones requeridas.');
    });

    it('should handle invalid login credentials', () => {
      const error = new Error('Invalid login credentials');
      const message = getErrorMessage(error);
      expect(message).toBe('Email o contraseña incorrectos. Por favor, verifica tus datos.');
    });

    it('should return error message if present', () => {
      const error = new Error('Custom error message');
      const message = getErrorMessage(error);
      expect(message).toBe('Custom error message');
    });

    it('should return generic error for unknown objects', () => {
      const error = { unknown: 'error' };
      const message = getErrorMessage(error);
      expect(message).toBe('Ocurrió un error inesperado. Por favor, intenta nuevamente.');
    });

    it('should handle string errors', () => {
      const message = getErrorMessage('Simple error string');
      expect(message).toBe('Simple error string');
    });

    it('should handle Error instances', () => {
      const error = new Error('Error instance message');
      const message = getErrorMessage(error);
      expect(message).toBe('Error instance message');
    });

    it('should handle null/undefined with generic message', () => {
      expect(getErrorMessage(null)).toBe('Ocurrió un error inesperado. Por favor, intenta nuevamente.');
      expect(getErrorMessage(undefined)).toBe('Ocurrió un error inesperado. Por favor, intenta nuevamente.');
    });

    it('should handle user already registered error', () => {
      const error = new Error('User already registered');
      const message = getErrorMessage(error);
      expect(message).toBe('Este email ya está registrado. ¿Olvidaste tu contraseña?');
    });

    it('should handle email not confirmed error', () => {
      const error = new Error('Email not confirmed');
      const message = getErrorMessage(error);
      expect(message).toBe('Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
    });
  });

  describe('ErrorMessages', () => {
    it('should have correct structure for CRUD operations', () => {
      expect(ErrorMessages.CREATE_FAILED('producto')).toBe('Error al crear producto');
      expect(ErrorMessages.UPDATE_FAILED('cliente')).toBe('Error al actualizar cliente');
      expect(ErrorMessages.DELETE_FAILED('venta')).toBe('Error al eliminar venta');
      expect(ErrorMessages.FETCH_FAILED('datos')).toBe('Error al cargar datos');
    });

    it('should have correct validation messages', () => {
      expect(ErrorMessages.REQUIRED_FIELD('nombre')).toBe('El campo nombre es requerido');
      expect(ErrorMessages.INVALID_FORMAT('email')).toBe('Formato inválido en email');
      expect(ErrorMessages.INVALID_EMAIL).toBe('Email inválido');
      expect(ErrorMessages.INVALID_PHONE).toBe('Teléfono inválido');
    });

    it('should have correct auth messages', () => {
      expect(ErrorMessages.SESSION_EXPIRED).toBe('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      expect(ErrorMessages.UNAUTHORIZED).toBe('No tienes autorización para realizar esta acción.');
    });

    it('should have correct network messages', () => {
      expect(ErrorMessages.NO_CONNECTION).toBe('Sin conexión a internet. Verifica tu conexión.');
      expect(ErrorMessages.TIMEOUT).toBe('La operación tardó demasiado. Intenta nuevamente.');
    });

    it('should have correct business logic messages', () => {
      expect(ErrorMessages.INSUFFICIENT_STOCK).toBe('Stock insuficiente para completar la operación.');
      expect(ErrorMessages.DUPLICATE_ENTRY).toBe('Ya existe un registro con estos datos.');
      expect(ErrorMessages.INVALID_OPERATION).toBe('Operación no permitida en el estado actual.');
    });
  });
});
