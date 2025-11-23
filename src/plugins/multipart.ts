import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';

export const multipartPlugin: FastifyPluginAsync = async (app) => {
  // Access config inside the plugin function after env plugin has loaded
  const maxImageSize = app.config?.MAX_IMAGE_SIZE ?? 5242880; // Default 5MB

  await app.register(multipart, {
    limits: {
      fileSize: maxImageSize,
      files: 1,
    },
    attachFieldsToBody: true,
  });
};
