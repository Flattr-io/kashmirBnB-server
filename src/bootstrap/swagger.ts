import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const getServerConfig = () => {
    const port = process.env.PORT || 3000;
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && process.env.RENDER_EXTERNAL_URL) {
        return [
            { url: process.env.RENDER_EXTERNAL_URL, description: 'Production server' },
            { url: `http://localhost:${port}`, description: 'Local server' }
        ];
    }
    
    return [{ url: `http://localhost:${port}`, description: 'Local server' }];
};

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Revam-BNB API',
            version: '1.0.0',
            description: 'API documentation for Revam-BNB backend',
        },
        servers: getServerConfig(),
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/routes/*.ts'], // <-- Path to your route files for JSDoc comments
};

export const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
