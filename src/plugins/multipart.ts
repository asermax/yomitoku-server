import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';

export const multipartPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: {
      fileSize: app.config.MAX_IMAGE_SIZE,
      files: 1,
    },
    attachFieldsToBody: true,
  });
};
