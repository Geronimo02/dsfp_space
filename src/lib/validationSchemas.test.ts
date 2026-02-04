import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  phoneSchema,
  priceSchema,
  percentageSchema,
  customerSchema,
  productSchema,
  validateData,
} from '../validationSchemas';

describe('validationSchemas', () => {
  describe('emailSchema', () => {
    it('should validate correct email', () => {
      const result = emailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should trim and lowercase email', () => {
      const result = emailSchema.safeParse('  TEST@EXAMPLE.COM  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should allow empty string', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('should reject email exceeding max length', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('priceSchema', () => {
    it('should validate positive numbers', () => {
      const result = priceSchema.safeParse(99.99);
      expect(result.success).toBe(true);
    });

    it('should reject negative numbers', () => {
      const result = priceSchema.safeParse(-10);
      expect(result.success).toBe(false);
    });

    it('should reject numbers exceeding max', () => {
      const result = priceSchema.safeParse(1000000000);
      expect(result.success).toBe(false);
    });

    it('should reject non-numbers', () => {
      const result = priceSchema.safeParse('not a number' as any);
      expect(result.success).toBe(false);
    });
  });

  describe('percentageSchema', () => {
    it('should validate 0-100 range', () => {
      expect(percentageSchema.safeParse(0).success).toBe(true);
      expect(percentageSchema.safeParse(50).success).toBe(true);
      expect(percentageSchema.safeParse(100).success).toBe(true);
    });

    it('should reject negative percentages', () => {
      const result = percentageSchema.safeParse(-5);
      expect(result.success).toBe(false);
    });

    it('should reject percentages over 100', () => {
      const result = percentageSchema.safeParse(101);
      expect(result.success).toBe(false);
    });
  });

  describe('customerSchema', () => {
    const validCustomer = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      document: '12345678',
      address: '123 Main St',
      credit_limit: 1000,
      payment_terms: '30 days',
      notes: 'Good customer',
    };

    it('should validate complete customer data', () => {
      const result = customerSchema.safeParse(validCustomer);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const { name, ...customerWithoutName } = validCustomer;
      const result = customerSchema.safeParse(customerWithoutName);
      expect(result.success).toBe(false);
    });

    it('should allow optional fields', () => {
      const minimalCustomer = {
        name: 'Jane Doe',
        email: '',
        phone: undefined,
        document: undefined,
        address: undefined,
        notes: undefined,
      };
      const result = customerSchema.safeParse(minimalCustomer);
      expect(result.success).toBe(true);
    });

    it('should trim and validate name', () => {
      const customer = { ...validCustomer, name: '  Test  ' };
      const result = customerSchema.safeParse(customer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test');
      }
    });
  });

  describe('productSchema', () => {
    const validProduct = {
      name: 'Test Product',
      description: 'A test product',
      sku: 'TEST-001',
      barcode: '1234567890',
      price: 99.99,
      cost: 50.00,
      stock: 100,
      min_stock: 10,
      category: 'Electronics',
      active: true,
    };

    it('should validate complete product data', () => {
      const result = productSchema.safeParse(validProduct);
      expect(result.success).toBe(true);
    });

    it('should require name and price', () => {
      const { name, ...productWithoutName } = validProduct;
      expect(productSchema.safeParse(productWithoutName).success).toBe(false);

      const { price, ...productWithoutPrice } = validProduct;
      expect(productSchema.safeParse(productWithoutPrice).success).toBe(false);
    });

    it('should validate stock is non-negative integer', () => {
      const invalidProduct = { ...validProduct, stock: -5 };
      expect(productSchema.safeParse(invalidProduct).success).toBe(false);

      const floatProduct = { ...validProduct, stock: 10.5 };
      expect(productSchema.safeParse(floatProduct).success).toBe(false);
    });

    it('should default active to true', () => {
      const { active, ...productWithoutActive } = validProduct;
      const result = productSchema.safeParse(productWithoutActive);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.active).toBe(true);
      }
    });
  });

  describe('validateData helper', () => {
    it('should return success with valid data', () => {
      const data = { name: 'Test', email: 'test@test.com' };
      const result = validateData(customerSchema, data);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return errors with invalid data', () => {
      const data = { email: 'invalid-email' };
      const result = validateData(customerSchema, data);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errorMessages).toBeDefined();
      expect(result.errorMessages!.length).toBeGreaterThan(0);
    });

    it('should include all error messages', () => {
      const data = { 
        name: '', 
        email: 'invalid',
        price: -10,
      };
      const result = validateData(customerSchema, data);
      
      expect(result.success).toBe(false);
      expect(result.errorMessages).toBeDefined();
      expect(result.errorMessages!.length).toBeGreaterThan(1);
    });
  });
});
