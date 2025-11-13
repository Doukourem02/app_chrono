import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chrono Livraison API',
      version: '1.0.0',
      description: 'API REST pour la plateforme de livraison en temps réel Chrono Livraison',
      contact: {
        name: 'Support API',
        email: 'support@chronodelivery.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Serveur de développement',
      },
      {
        url: 'https://api.chronodelivery.com',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Token JWT obtenu via /api/auth-simple/verify-otp ou /api/auth-simple/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Erreur de validation',
            },
            errors: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['client', 'driver', 'admin'],
            },
            phone: {
              type: 'string',
            },
            avatar: {
              type: 'string',
              format: 'uri',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            driverId: {
              type: 'string',
              format: 'uuid',
            },
            pickup: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                },
                coordinates: {
                  type: 'object',
                  properties: {
                    latitude: {
                      type: 'number',
                    },
                    longitude: {
                      type: 'number',
                    },
                  },
                },
              },
            },
            dropoff: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                },
                coordinates: {
                  type: 'object',
                  properties: {
                    latitude: {
                      type: 'number',
                    },
                    longitude: {
                      type: 'number',
                    },
                  },
                },
              },
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'accepted',
                'enroute',
                'picked_up',
                'completed',
                'cancelled',
                'declined',
              ],
            },
            price: {
              type: 'number',
            },
            deliveryMethod: {
              type: 'string',
              enum: ['moto', 'vehicule', 'cargo'],
            },
            distance: {
              type: 'number',
            },
            estimatedDuration: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Rating: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            orderId: {
              type: 'string',
              format: 'uuid',
            },
            driverId: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
            },
            comment: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Chrono Livraison API Documentation',
    })
  );
};

export default swaggerSpec;
