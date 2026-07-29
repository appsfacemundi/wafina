import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth';
import { changeRequestsRouter } from './routes/change-requests';
import { disputesRouter } from './routes/disputes';
import { donationsRouter } from './routes/donations';
import { donorRouter } from './routes/donor';
import { geoRegionsRouter } from './routes/geo-regions';
import { healthRouter } from './routes/health';
import { institutionsRouter } from './routes/institutions';
import { notificationsRouter } from './routes/notifications';
import { usersRouter } from './routes/users';

const app = express();

app.use(cors({ origin: env.allowedOrigins }));
app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(geoRegionsRouter);
app.use(usersRouter);
app.use(donationsRouter);
app.use(institutionsRouter);
app.use(donorRouter);
app.use(notificationsRouter);
app.use(disputesRouter);
app.use(changeRequestsRouter);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Wafina API listening on port ${env.port}`);
});
