/* eslint-disable no-case-declarations */
/*
https://docs.nestjs.com/websockets/gateways#gateways
*/

import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CommandCreateRoom, CommandRoomCreated, isCommandCreateRoom } from '../model/CommandCreateRoom.model';
import { Logger, OnModuleInit } from '@nestjs/common';
import { inspect } from 'util';
import { Socket } from 'dgram';

import { v4 as uuid }from 'uuid';
import { Command, UserType } from '../model/Command.model';
import { CommandInvite, Invitation, isCommandInvite } from '../model/CommandInvite.model';
import { APIKey, CommandProRegister, CommandRegister, RegistrationInfo, isCommandProRegister, isCommandRegister } from '../model/CommandRegister.model';
import { Kafka, Producer, Consumer, Admin } from 'kafkajs';
import { CommandJoinRoom, CommandJoinSuccess, CommandUserJoinedSuccess, isCommandJoinRoom } from '../model/CommandJoin.model';
import { CommandGetProfesionals, CommandGetUsers, isCommandGetProfesionals, isCommandGetUsers } from '../model/CommandGet.model';
import { CommandLeaveRoom, isCommandLeaveRoom } from '../model/CommandLeaveRoom.model';
import { CommandChatMessage, CommandInternalChatMessage, isCommandChatMessage, isCommandInternalChatMessage } from '../model/CommandChatMessage.model';
import { ProducerService } from './services/producer.service';
import { CommandPingback, isCommandPingback } from '../model/CommandPingback.model';
import { Cron } from '@nestjs/schedule';
import { ChatMessage, Conversation } from '../model/Conversation.model';

@WebSocketGateway(3002, {
  cors: {
    origin: '*',
    methods: 'GET POST PUT PATCH DELETE'
  }
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleInit
{
  @WebSocketServer()
  server: Server;

    // Websocket clients connected: id socket, Socket
    private clients: Map<string, Socket>;
    private clientsClone: Map<string, Socket>;
    // Users connected. To send and recevice message an user must register first: id socket, username
    private users: Map<string,string>;
    // Usernames connected (all). To send and recevice message an user must register first: id socket, username
    private user_directory: Map<string,string>;
    // Users types. Helper to track connected user types
    private user_types: Map<string, UserType>;
    // Users API Keys, id socket APIKey
    private apikeys_id: Map<string, APIKey>;
    // Users client id, id socket client_id
    private clients_id: Map<string, unknown>;
    // Profesionals connected. To send and recevice message an user must register first: id socket, username
    private profesionals: Map<string,string>;
    // Users client id, id socket client_id
    private profesionals_id: Map<string, unknown>;

    // Rooms created, with a list of users: room uuid, count
    private rooms: Map<string, number>;
    // User rooms, only one allowed per user: id socket, room uuid
    private user_rooms: Map<string, string>;
    // Onwers of rooms
    private owners: Map<string, string>;
    // Conversations by room: room, conversation_id. Filled when profesional joins room, deleted when leave
    private conversations: Map<string, string>;
    // Conversation Members: id conversation, { id client, id profesional }
    private conversation_members: Map<string, { client: unknown, profesional: unknown }>


    private consumer: Consumer;
    private producer: Producer;
    private admin: Admin;
    private kafka: Kafka;
    private topics: string[] = [];

   constructor(/* @Inject('CHAT_MICROSERVICE') private kafkaProxy: ClientKafka,*/ private producerSvc: ProducerService) {

    this.kafka = new Kafka({
          clientId: 'chat-server-cli',
          brokers: ['kafka-service:9092'],
        });

    this.admin = this.kafka.admin()
    this.consumer = this.kafka.consumer({ groupId: 'chat-server', sessionTimeout: 15000, heartbeatInterval: 5000, retry: { retries: 50 }  });

    this.clients = new Map<string, Socket>();
    this.users = new Map<string, string>();
    this.user_directory = new Map<string, string>();
    this.user_types = new Map<string, UserType>();
    this.clients_id = new Map<string, number>();
    this.profesionals_id = new Map<string, number>();
    this.apikeys_id = new Map<string, APIKey>();
    this.rooms = new Map<string, number>();
    this.profesionals = new Map<string, string>();
    this.user_rooms = new Map<string, string>();
    this.conversations = new Map<string, string>();
    this.conversation_members = new Map<string, { client: unknown, profesional: unknown }>()
    this.owners = new Map<string, string>();


    //this.producer = kafkaProxy.
  }

  async onModuleInit() {

    await this.admin.connect();
    await this.consumer.connect();
  }

  @SubscribeMessage('message')
  handleEvent(@MessageBody() data: Command, @ConnectedSocket() client: Socket) {
    //

    Logger.log('Message received');
  }

  @SubscribeMessage('nofity')
  handleGeneral(@MessageBody() data: Command, @ConnectedSocket() client: Socket) {

    Logger.log('Notification sent');
  }

  @SubscribeMessage('command')
  async handleCommand(@MessageBody() data: Command, @ConnectedSocket() client: Socket) {

    Logger.log('Command received');

    switch (data.type) {
      case 'CREATE_ROOM':
        this.createRoom(data as CommandCreateRoom, client)
        break;

      case 'INVITE':
        this.invite(data as CommandInvite, client);
        break;

      case 'USER_REGISTER':
        this.userRegister(data as CommandRegister, client)
        break;
      case 'PRO_REGISTER':
        this.proRegister(data as CommandProRegister, client);
        break;
      case 'JOIN_ROOM':

        this.joinRoom(data as CommandJoinRoom, client)
        break;
      case 'GET_USERS':

        this.get_users(data as CommandGetUsers, client)
        break;
      case 'GET_PROFESIONALS':

        this.get_profesionals(data as CommandGetProfesionals, client)
        break;
      case 'LEAVE_ROOM':

        this.leave_room( data as CommandLeaveRoom, client);
        break;
      case 'CHAT_MESSAGE':

        this.chat_message( data as CommandChatMessage, client);
        break;

      case 'PINGBACK':

        this.pingback(data as CommandPingback, client)
        break;
    }

  }

  private pingback(data: CommandPingback, client: Socket) {

    if (isCommandPingback(data)) {
      const s = (client as any).id;

      this.clientsClone.set(s, client)

      this.clients = new Map(this.clientsClone);

    }
  }

  private chat_message(data: CommandChatMessage, client: Socket) {

    if (isCommandChatMessage) {

      Logger.log('Message sent')

      Logger.log(`Conversation ID: ${this.conversations.get(data.room)}`);

      const message: CommandInternalChatMessage = {
        conversation_id: this.conversations.get(data.room),
        id: uuid(),
        client_id: this.user_types.get(data.from) === 'user' ? this.clients_id.get(data.from) : this.profesionals_id.get(data.from),
        ...data
      }

      this.producerSvc.sendMessage(message)

      client.emit('message_sent', { conversation_id: this.conversations.get(data.room), message_id: message.id})
    }
  }

  private leave_room(data: CommandLeaveRoom, client: Socket) {
    if (isCommandLeaveRoom) {

      const owner = this.owners.get(data.room);

      if (this.user_types.get(data.user) == 'user') {

        this.user_rooms.delete(data.user);
        this.rooms.delete(data.user);

        this.user_rooms.forEach((v,k,m) => {
          if (v == data.room) {
            const sock = this.clients.get(k);
            //sock.emit('room_left', { success: true });
            sock && sock.emit('room_about_to_close', 'El anfitrion ha abandonado la sala')
            this.destroy_room(data.room);
          }
        })

        Logger.log(`Rooms state : ${inspect(this.rooms)}`)
        Logger.log(`Rooms state : ${inspect(this.user_rooms)}`)

      }


      if (this.user_types.get(data.user) == 'profesional') {

        this.user_rooms.delete(data.user);

        if (this.user_rooms.get(owner) !== undefined) {

          this.rooms.set(data.room, 1)

          Logger.log(`Notify owner : ${owner}`)

          const sock = this.clients.get(owner);
          //sock.emit('room_left', { success: true });
          sock.emit('empty_room', 'Solo queda usted en la sala')

        }

        Logger.log(`Rooms state : ${inspect(this.rooms)}`)
        Logger.log(`Rooms state : ${inspect(this.user_rooms)}`)

      }


      //this.user_rooms.delete(data.user);

      /*
      const owner = this.owners.get(data.room);

      const members: string[] = [];

      this.user_rooms.forEach((v,k,m) => {
        if (v == data.room) {
          members.push(k);
        }
      })

      if (owner == data.user) {

        //const members = this.rooms.get(owner);
        //
        Logger.log(`${inspect(members)}`)

        for(const m of members) {
          if (m != owner) {
            const sock = this.clients.get(m);
            //sock.emit('room_left', { success: true });
            sock.emit('room_about_to_close', 'El anfitrion ha abandonado la sala')
          }
        }
        //
        this.rooms.set(data.room, 0)
        // Close Room and save data

      }
      else {
        //const members = this.rooms.get(data.room);

        //Logger.log(`${inspect(this.rooms)}`)

        const members_updated = members.filter(el => el != data.user);

        this.rooms.set(data.room, members_updated.length)

        if (members_updated.length > 1) {
          client.emit('room_left', { success: true });
        }
        else {
          const sock = this.clients.get(this.owners.get(data.room))
          sock.emit('empty_room', 'Solo queda usted en la sala')
        }
      }
      */
    }
  }

  private destroy_room(data: string) {
    /*
    // Get entire conversation and convert into ChatMessage
    const rereadConsumer: Consumer = this.kafka.consumer({ groupId: 'chat-server', sessionTimeout: 15000, heartbeatInterval: 5000, retry: { retries: 50 }});

    rereadConsumer.subscribe({ topics: [data], fromBeginning: true});

    Logger.log(`Member of ${data} : ${inspect(this.conversation_members.get(data))}`)

    const conversation: Conversation = {
      id: this.conversations.get(data),
      client_id: this.conversation_members.get(data).client,
      profesional_id: this.conversation_members.get(data).profesional,
      messages: []
    }

    rereadConsumer.run({
      eachBatchAutoResolve: true,
    eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        commitOffsetsIfNecessary,
        uncommittedOffsets,
        isRunning,
        isStale,
        pause,
    }) => {
        for (let message of batch.messages) {

          //await this.consumer.commitOffsets([{ topic: topic, partition: partition, offset: message.offset }])

          //await heartbeat();

          Logger.log({
              key: message.key.toString(),
              value: message.value.toString(),
              headers: message.headers,
          })

          if (isCommandInternalChatMessage(JSON.parse(message.value.toString()))) {

            const msg: CommandInternalChatMessage = JSON.parse(message.value.toString());

            let chat_message: ChatMessage;

            if (this.user_types.get(msg.from) === 'user') {
              const from = this.clients_id.get(msg.id)
              chat_message = {
                id: msg.id,
                from_id: from as string,
                content: msg.content
              }
            }

            if (this.user_types.get(msg.from) === 'profesional') {
              const from = this.profesionals_id.get(msg.id)
              chat_message =  {
                id: msg.id,
                from_id: from as string,
                content: msg.content
              }
            }

            Logger.log('Store message')
            conversation.messages.push(chat_message);

            resolveOffset(message.offset)
            await heartbeat();
          }
        }
        this.producerSvc.sendEndConversation(conversation);
      }
    })
    .catch(Logger.error);

    //this.producerSvc.sendEndConversation(conversation);
    */
    //
    this.conversation_members.delete(data);
    this.conversations.delete(data);
    this.topics = this.topics.filter(item => item != data)
    this.resubscribeConsumer();
  }

  private createRoom(data: CommandCreateRoom, client: Socket) {
  // eslint-disable-next-line no-case-declarations
  const name = uuid();

  if (isCommandCreateRoom(data)) {
    //producer.createRoom(data)
    this.admin.createTopics({
      waitForLeaders: true,
      topics: [{
        topic: name,
        numPartitions: 1,
        replicationFactor: 1
      }]
    })

    this.topics.push(name);
    this.resubscribeConsumer();

    //const members: string[] = [ data.user ];

    //Logger.log(`data : ${inspect(members)}`)

    this.rooms.set(name, 1)
    this.user_rooms.set(data.user, name)
    this.owners.set(name, data.user)

    // eslint-disable-next-line no-case-declarations
    const response: CommandRoomCreated = {
      id: uuid(),
      room: name,
      timestamp: new Date(Date.now())
    }

    Logger.log(`Room created : ${inspect(name)}`)
    Logger.log(`Room members : ${inspect(this.rooms.get(name))}`)

    client.emit('room_created', response);
  }

  }

  private invite(data: CommandInvite, client: Socket) {
    if (isCommandInvite(data)) {
      //invite to room
      //const pro = this.profesionals.get(data.to);

      const invitation: Invitation = {
        from: data.from,
        room: data.room
      }

      const remote = this.clients.get(data.to)

      Logger.log(`Sent invitation to ${data.to}`)

      remote.emit('invite', invitation)
    }
  }

  private joinRoom(data: CommandJoinRoom, client: Socket) {
    const s2: any = client;
    const csocketjoin = this.clients.get(s2?.id)

    let response: CommandJoinSuccess = { success: false};
    const joinedOwner: CommandUserJoinedSuccess = { room: data?.room, user: s2?.id, username: this.profesionals.get(data.user)};


    if (csocketjoin) {
      if (isCommandJoinRoom(data)) {

        const users_in_room = this.rooms.get(data.room);

        this.rooms.set(data.room, users_in_room + 1);
        this.user_rooms.set(data.user, data.room );

        if (users_in_room > 0) {

          if (!this.conversations.get(data.room)) {
            const conv = uuid();
            this.conversations.set(data.room, conv)
            this.conversation_members.set(data.room, { client: this.clients_id.get(data.user), profesional: ''})
          }
          else {
            const conv = this.conversations.get(data.room)
            const members = this.conversation_members.get(conv)
            members.profesional = this.profesionals_id.get(data.user)

            this.conversation_members.set(conv, members)
          }

          response = {
            success: true
          }
        }
        else {
          response = {
            success: false
          }
        }
        /*
        const members = this.rooms.get(data?.room);

        if (members) {
          members.push(data?.user);

          if (!this.conversations.get(data.room)) {
            this.conversations.set(data.room, uuid())
          }

          response = {
            success: true
          }
        }
        else {
          response = {
            success: false
          }
        }
        */
      }
    }

    Logger.log(`Rooms : ${inspect(this.user_rooms)}`)

    client.emit('join', response)

    if (response.success) {

      let found = '';

      this.user_rooms.forEach((v,k,m) => {
        if (v == data.room) {
          found = k;
        }
      })

      if (found && found != '') {
        const owner_id = this.owners.get(data.room);
        const owner = this.clients.get(owner_id);

        const joinedPro: CommandUserJoinedSuccess = { room: data?.room, user: owner_id, username: this.users.get(owner_id)};

        client.emit('user_joined', joinedPro )
        owner.emit('user_joined', joinedOwner)
      }
    }

  }


  private proRegister(data: CommandProRegister, client: Socket) {
    //Logger.log(`${inspect(client)}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s1: any = client;
    const csocketpro = this.clients.get(s1?.id)

    if (csocketpro) {
      //validate token

      //
      if (isCommandProRegister(data)) {

        this.profesionals.set(s1?.id, data.user)
        this.user_types.set(s1?.id, 'profesional');
        this.user_directory.set(s1?.id, data.user);

        if (data.profesional_id !== undefined)
          this.profesionals_id.set(s1?.id, data.profesional_id);

        if (data.apikey !== undefined)
          this.apikeys_id.set(s1?.id, data.apikey);

        Logger.log(`Profesionals online : ${inspect(this.profesionals)}`)

        const response: RegistrationInfo = {
          user: s1?.id
        }

        client.emit('pro_register', response)

        this.users.forEach((v,k,m) => {
          const sock = this.clients.get(k);
          this.get_profesionals({ type: 'GET_PROFESIONALS'}, sock)
        })

        Logger.log(`User registered : ${data.user}`)
      }
    }

  }

  private userRegister(data: CommandRegister, client: Socket) {

    //Logger.log(`${inspect(data)}`)

    const s: any = client;
    const csocket = this.clients.get(s?.id)

    if (csocket) {
      //validate token

      //
      if (isCommandRegister(data)) {

        this.users.set(s?.id, data.user)
        this.user_types.set(s?.id, 'user');
        this.user_directory.set(s?.id, data.user)

        if (data.client_id !== undefined)
          this.clients_id.set(s?.id, data.client_id);

        if (data.apikey !== undefined)
          this.apikeys_id.set(s?.id, data.apikey)

        const response: RegistrationInfo = {
          user: s?.id
        }

        client.emit('register', response)

        Logger.log(`User registered : ${s?.id}`)

        this.profesionals.forEach((v,k,m) => {
          const sock = this.clients.get(k);
          Logger.log(`${inspect((sock as any).id)}`)
          this.get_users({ type: 'GET_USERS'}, sock)
        })
      }
    }
  }

  private get_users(data: CommandGetUsers, client: Socket) {

    if (isCommandGetUsers) {
      const aUsers: {user_id: string, username: string}[] = [];

      this.users.forEach((v,k,m) => {
        aUsers.push({user_id: k, username: v});
      })

      Logger.log(`Users online for ${(client as any)?.id} : ${inspect(aUsers)}`);

      client.emit('user_list', aUsers)

    }

  }

  private get_profesionals(data: CommandGetProfesionals, client: Socket) {

    if (isCommandGetProfesionals) {
      const aUsers: {user_id: string, username: string}[] = [];

      this.profesionals.forEach((v,k,m) => {
        aUsers.push({user_id: k, username: v});
      })

      Logger.log(`Profesionals online for ${(client as any)?.id} : ${inspect(aUsers)}`);

      client.emit('profesional_list', aUsers)

    }

  }

  private async resubscribeConsumer() {
    await this.consumer.stop();

    Logger.log(`Subscribing to topics : ${inspect(this.topics)}`);

    await this.consumer.subscribe({ topics: [ ...this.topics ]});

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {

        await this.consumer.commitOffsets([{ topic: topic, partition: partition, offset: message.offset }])

        await heartbeat();

        Logger.log({
            key: message.key.toString(),
            value: message.value.toString(),
            headers: message.headers,
        })

        if (isCommandInternalChatMessage(JSON.parse(message.value.toString()))) {
          const msg: CommandInternalChatMessage = JSON.parse(message.value.toString());

          const from = msg.from;

          const members: string[] = [];

          this.user_rooms.forEach((v,k,m) => {
            if (v == msg.room) {
              members.push(k);
            }
          })

          //const members = this.rooms.get(msg.room)
          const replies = members.filter(item => item != from);

          Logger.log(`Reply to : ${inspect(replies)}`)

          for(const r of replies) {
            const sock = this.clients.get(r);
            sock.emit('chat_reply', msg as CommandChatMessage)
          }
        }
      },
    })
    .catch(Logger.error);
  }

  private unregisterUser(user_id: string) {

    this.user_types.delete(user_id);
    this.user_directory.delete(user_id);
    this.users.delete(user_id);

    this.clients_id.delete(user_id);
    this.apikeys_id.delete(user_id);

    const sock = this.clients.get(user_id);

    sock.emit('unregistered');
  }

  private unregisterPro(user_id: string) {

    this.user_types.delete(user_id);
    this.user_directory.delete(user_id);
    this.profesionals.delete(user_id);

    this.profesionals_id.delete(user_id);
    this.apikeys_id.delete(user_id);

    const sock = this.clients.get(user_id);

    sock.emit('unregistered');
  }

  handleConnection(client: any, ...args: any[]) {
    // Validar token JWT e insertar en la lista de clientes

    this.clients.set(client?.id, client);

    client.emit('welcome', "Bienvenido")

    Logger.log(`User connected : ${client?.id}`);
  }

  handleDisconnect(client: any) {
    // Limpiar topics  eliminar de la lista de clientes

    const room = this.user_rooms.get(client?.id);

    if (room && room != '') {
      const leave: CommandLeaveRoom = {
        type: 'LEAVE_ROOM',
        room: room,
        user: client?.id
      }

      this.leave_room(leave,client);
    }

    const t = this.user_types.get(client?.id);

    Logger.log(`Handling disconnect for : ${client?.id}` )

    if (t != undefined) {
      if (t == 'user') {
        Logger.log(`He's user` )
        this.unregisterUser(client?.id);
      }

      if (t == 'profesional') {
        Logger.log(`He's Profesional` )
        this.unregisterPro(client?.id)
      }
    }

    this.clients.delete(client?.id);

    /*
    const inverseRooms = new Map<string, string>();

    if (this.user_rooms) {
      this.user_rooms.forEach((v,k,m) => {
        inverseRooms.set(v,k);
      })
    }

    const inverseUsers = new Map<string, string>();

    if (this.users) {
      this.users.forEach((v,k,m) => {
        inverseUsers.set(v,k);
      })
    }

    let username = inverseUsers.get(client?.id);

    if (username === undefined) {
      if (this.profesionals) {
        this.profesionals.forEach((v,k,m) => {
          inverseUsers.set(v,k);
        })

        username = inverseUsers.get(client?.id);
      }
    }

    this.users.delete(username);

    const room = inverseRooms.get(client?.id);
    const members = this.rooms.get(room);

    if (members && members.length > 1) {
      // notify remaining people
      const notifyList = members.filter(item => item != client?.id)

      if (notifyList && notifyList.length > 0) {
        notifyList.forEach((v,k,m) => {
          Logger.log('Looking for user : ', client?.id )
          const sock = this.clients.get(v);
          if (sock)
            sock.emit('room_about_to_close', 'El anfitrion ha abandonado la sala');
        })
      }
      else {
        Logger.log('Looking for client : ', client?.id )
        const sock = this.clients.get(client?.id);
        if (sock)
          sock.emit('room_about_to_close', 'Solo queda usted en la sala');
      }
    }

    this.user_rooms.delete(room)
    this.rooms.delete(room);
    */

    //this.clients.delete(client?.id)

    Logger.log('User disconnected');
  }

  async afterInit(server: any): Promise<void> {

    //await this.admin.connect();

    //await this.consumer.connect();

    this.admin.createTopics({
      waitForLeaders: true,
      topics: [{
        topic: 'conversations_ended',
        numPartitions: 1,
        replicationFactor: 1
      }]
    })

    // Listener
    this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
          Logger.log({
              key: message.key.toString(),
              value: message.value.toString(),
              headers: message.headers,
          })
      },
    });

    // Anunciar
    Logger.log(`Initialized`);
  }



  // Once per minute we ping our clients
  // Clients still alive must respond with PINGBACK command
  @Cron('30 * * * * *')
  call_ping() {

    const userClone = new Map<string, string>();
    const proClone = new Map<string, string>();

    // Restauramos los usuarios y pro a partir de quien esta online
    this.clients.forEach((v,k,m) => {

      if (this.user_types.get(k) == 'user') {
        const u = this.users.get(k)
        userClone.set(k, u)
      }

      if (this.user_types.get(k) == 'profesional') {
        const p = this.profesionals.get(k)
        proClone.set(k, p)
      }
    });



    const unexistent = this.users.keys();

    for(let u of unexistent) {
      const v = userClone.get(u);

      if (!v) {
        const sock = this.clients.get(u);
        Logger.log('Force client disconnect : ', u )
        this.handleDisconnect(sock)
      }
    }



    const unexistentPro = this.profesionals.keys();

    for(let u of unexistentPro) {
      Logger.log('Looking for : ', u )
      const v = proClone.get(u);

      if (!v) {
        const sock = this.clients.get(u);
        Logger.log('Force pro disconnect : ', u )
        this.handleDisconnect(sock)
      }
    }

      /*
      const u = this.users.get(k)

      if (u) {
        userClone.set(k, u)
      }
      else {
        const p = this.profesionals.get(k)
        if (p) {
          proClone.set(k, u)
        }
      }

    })
    //
    const unexistent = this.users.keys();

    for(let u of unexistent) {
      const v = userClone.get(u);

      if (!v) {
        const sock = this.clients.get(u);
        Logger.log('Force client disconnect : ', u )
        this.handleDisconnect(sock)
      }
    }
    //
    const unexistentPro = this.profesionals.keys();

    for(let u of unexistentPro) {
      Logger.log('Looking for : ', u )
      const v = proClone.get(u);

      if (!v) {
        const sock = this.clients.get(u);
        Logger.log('Force pro disconnect : ', u )
        this.handleDisconnect(sock)
      }
    }
    */
    //
    this.users = new Map(userClone);
    this.profesionals = new Map(proClone);

    this.clientsClone = new Map<string, Socket>();
    this.server.emit('ping');

    Logger.log(`Current clients : ${inspect(this.clients.keys())}`)
    Logger.log(`Current users : ${inspect(this.users.keys())}`)
    Logger.log(`Current profesionals : ${inspect(this.profesionals.keys())}`)
  }
}
