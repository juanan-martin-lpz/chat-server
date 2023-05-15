/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { CommandInternalChatMessage } from '../../model/CommandChatMessage.model';
import { inspect } from 'util';
import { Conversation } from '../../model/Conversation.model';

@Injectable()
export class ProducerService implements OnModuleInit{

  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
          clientId: 'chat-server-producer',
          brokers: ['kafka-service:9092']
    });

    this.producer = this.kafka.producer();

  }

  onModuleInit() {
    this.producer.connect();
  }

  async sendMessage(message: CommandInternalChatMessage) {

    Logger.log(`A message is about to send : ${inspect(message)}`);

    const result = await this.producer.send({
      topic: message.room,
      messages: [ {key: message.id, value: JSON.stringify(message)}]
    })

    Logger.log(`Message sent : ${inspect(result)}`)
  }

  async sendEndConversation(conversation: Conversation) {
    Logger.log(`End Conversation is about to send : ${inspect(conversation)}`);

    const result = await this.producer.send({
      topic: 'conversation_ended',
      messages: [ {key: conversation.id, value: JSON.stringify(conversation)}]
    })

    Logger.log(`End Conversation : ${inspect(result)}`)
  }
}
