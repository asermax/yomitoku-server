import { build } from './app.js';

const start = async () => {
  try {
    const app = await build();

    const address = await app.listen({
      port: app.config.PORT,
      host: app.config.HOST,
    });

    app.log.info(`Server listening on ${address}`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        app.log.info(`Received ${signal}, closing server gracefully`);
        await app.close();
        process.exit(0);
      });
    });
  }
  catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
