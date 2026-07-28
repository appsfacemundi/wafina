import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth';
import { donationsRouter } from './routes/donations';
import { donorRouter } from './routes/donor';
import { healthRouter } from './routes/health';
import { institutionsRouter } from './routes/institutions';

const app = express();

app.use(cors({ origin: env.allowedOrigins }));
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(donationsRouter);
app.use(institutionsRouter);
app.use(donorRouter);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Wafina API listening on port ${env.port}`);
});
