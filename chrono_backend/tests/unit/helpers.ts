/**
 * Helpers pour les tests unitaires
 * Types et utilitaires pour simplifier les mocks Jest
 */
import { jest } from '@jest/globals';

// Type helper pour les mocks Jest
export type MockedFunction<T extends (...args: any[]) => any> = jest.Mock<ReturnType<T>>;

// Helper pour créer un mock de pool.query
export const createMockPoolQuery = () => {
  return jest.fn() as any;
};

// Helper pour créer un mock de Response Express
export const createMockResponse = () => {
  return {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn().mockReturnThis() as any,
    send: jest.fn().mockReturnThis() as any,
  };
};

// Helper pour créer un mock de Request Express
export const createMockRequest = (overrides: Partial<any> = {}) => {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
};

