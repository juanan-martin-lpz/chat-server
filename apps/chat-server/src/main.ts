/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app/app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /*
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['kafka-service:9092'],
      },
      consumer: {
        groupId: 'chat-server',
      },
      producer: {
        allowAutoTopicCreation: true,
      }
    },
  });
  */

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: "*",
    methods: "GET POST PUT PATCH DELETE"
  })

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || 'localhost';

  //app.startAllMicroservices();

  app.listen(`${host}:${port}`);

  Logger.log(
    `🚀 Application is running on: http://${host}:${port}`
  );
}

bootstrap();
