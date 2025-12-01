import { build } from './app.js';

// Suppress dotenv console output (tips and logs)
process.env.DOTENV_CONFIG_QUIET = 'true';

const start = async () => {
  try {
    const app = await build();

    // Ensure all plugins are loaded before accessing config
    await app.ready();

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
