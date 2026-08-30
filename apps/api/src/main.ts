import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UzaExceptionFilter } from './platform/http/uza-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Standard secure-header set (CSP, HSTS, X-Frame-Options, etc.). Safe as a blanket default
  // here: this API serves JSON only (no server-rendered HTML views), so Helmet's defaults
  // need no per-route tuning.
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Translate the @uza/contracts error taxonomy → HTTP status (403 / 409 / …).
  app.useGlobalFilters(new UzaExceptionFilter());

  // OpenAPI at /docs so the frontend builds against a typed contract.
  const config = new DocumentBuilder()
    .setTitle('UZA Nexus API')
    .setDescription('HTTP surface for the UZA China→Africa trade corridor platform.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`UZA Nexus API listening on :${port} (docs at /docs)`);
}

void bootstrap();
