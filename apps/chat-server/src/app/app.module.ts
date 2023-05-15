
import { ProducerService } from './services/producer.service';
import { Module } from '@nestjs/common';

import { ChatGateway } from './chat.gateway';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot()
    /*
    ClientsModule.register([
      {
        name: 'CHAT_MICROSERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'chat-server-cli',
            brokers: ['kafka-service:9092'],
          },
          consumer: {
            groupId: 'chat-server',
          },
          producer: {
            allowAutoTopicCreation: true,
          },
          run: {
            autoCommit: true,
            autoCommitInterval: 150,
          },
        },
      },
    ]),
    */
  ],
  controllers: [],
  providers: [ ProducerService, ChatGateway],
})
export class AppModule {}
