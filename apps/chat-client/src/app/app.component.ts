import { Component } from '@angular/core';
import { Socket } from 'ngx-socket-io';


@Component({
  selector: 'chat-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'chat-client';

  public message: string = 'No hay mensajes';
  public registration: string = 'No registrado';
  public room: string = 'Ninguna';

  public user_id: string = '';

  public invitationFrom: string = 'No hay invitaciones';
  public invitationRoom: string = 'No hay sala';

  public canChat: boolean = false;

  public profesionals: string[] = [];

  private socket: Socket;

  public usersInRoom: string[] = [];

  public online: { user_id: string, username: string}[] = [];
  public onlinepro: { user_id: string, username: string}[] = [];

  public user = false;

  public messages: { class: string, from: string, id: number,  message: string }[] = []

  public client_id: number = Math.floor((Math.random() * 11));

  constructor(socket: Socket) {
    this.socket = socket;

    this.socket.on('connect', () => {
      console.log('Connected to server')
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
    })

    this.socket.on('register', (data: any) => {
      if (data) {
        this.registration = 'Registrado correctamente';
        this.user_id = data.user;
        this.socket.emit('command', {type: 'GET_PROFESIONALS'})
      }
    })

    this.socket.on('pro_register', (data: any) => {
      if (data) {
        this.registration = 'Registrado correctamente';
        this.user_id = data.user;
        this.profesionals.push(data.user_id)
      }
    })

    this.socket.on('welcome', (data: string) => {
      //this.message = data
    })

    this.socket.on('room_created', (data: {id: string,room: string,timestamp: Date}) => {
      this.invitationRoom = data?.room;
    })

    this.socket.on('invite', (data: any) => {
      console.log('Received invitation')
      this.invitationFrom = data?.from;
      this.invitationRoom = data?.room;
    })


    this.socket.on('join', (data: { success: boolean }) => {
      console.log('Join success: ' + data.success)
      this.canChat = data.success;
    })

    this.socket.on('user_joined', (data: { room: string, user: string, username: string }) => {
      console.log('User joined to room : ' + data.user);
      this.usersInRoom.push(data.username);
    })

    this.socket.on('user_list', (data: { user_id: string, username: string }[]) => {

      console.log(data)

      this.online = data;
    })

    this.socket.on('profesional_list', (data: { user_id: string, username: string }[]) => {

      console.log(data)

      this.onlinepro = data;
    })

    this.socket.on('room_left', (data: { success: boolean }) => {

      console.log('room_left : ', data)
      this.invitationRoom = 'No hay sala'
      this.invitationFrom = 'Nadie'
      this.canChat = false;
      this.usersInRoom = []

    })

    this.socket.on('chat_reply', (data: { room: string; from: string; client_id: number, content: string}) => {

      console.log('Message received');

      if (this.canChat) this.messages.push({ class: 'invitee', from: data.from, id: data.client_id,  message: data.content})

    })

    this.socket.on('ping', () => {

      this.socket.connect();

      this.socket.emit('command', {type: 'PINGBACK'})

      if (this.user) {
        this.getProfesionals();
      }

    })

    this.socket.on('room_about_to_close', (data: string) => {

      this.messages.push({ class: 'invitee', from: 'System', id: 0,  message: data});
      this.invitationRoom = 'No hay sala'
      this.invitationFrom = 'Nadie'
      this.canChat = false;
      this.usersInRoom = [];

      this.getUsers();

    })

    this.socket.on('empty_room', (data: string) => {

      this.messages.push({ class: 'user', from: 'System', id: 0,  message: data});
      this.invitationRoom = 'No hay sala'
      this.invitationFrom = 'Nadie'
      this.canChat = false;
      this.usersInRoom = [];

      this.getProfesionals();

    })
  }

  connect(): void {
    this.socket.connect();

    this.user = true;

    this.socket.emit('command', {type: 'USER_REGISTER', user: 'test@user', client_id: this.client_id, token: 'aaaaaa'})

  }

  connectPro(): void {
    this.socket.connect();

    this.user = false;

    this.socket.emit('command', {type: 'PRO_REGISTER', user: 'pro@user', profesional_id: this.client_id, token: 'aaaaaa'})

  }

  invitePro(user: string): void {
    this.socket.connect();

    this.canChat = true;

    console.log(`Sending invitation to ${user}`)
    //this.socket.emit('command', {type: 'CREATE_ROOM', user: this.user_id})

    this.socket.emit('command', {type: 'INVITE', from: this.user_id, to: user, room: this.invitationRoom})


  }

  createRoom() {
    this.socket.connect();

    this.socket.emit('command', {type: 'CREATE_ROOM', user: this.user_id})
  }

  joinRoom() {
    this.socket.connect();

    console.log(`Joining room  ${this.invitationRoom}`)

    this.socket.emit('command', {type: 'JOIN_ROOM', user: this.user_id, room: this.invitationRoom})

    this.messages = [];
  }

  getUsers() {
    this.socket.connect();

    this.socket.emit('command', { type: 'GET_USERS'})
  }

  getProfesionals() {
    this.socket.connect();

    this.socket.emit('command', { type: 'GET_PROFESIONALS'})
  }

  leaveRoom() {
    this.socket.connect();

    this.socket.emit('command', { type: 'LEAVE_ROOM', user: this.user_id, room: this.invitationRoom})

    this.invitationRoom = 'No hay sala'
    this.invitationFrom = 'Nadie'
    this.canChat = false;
    this.usersInRoom = [];

    console.log(this.messages)
  }

  send() {
    this.socket.connect();

    this.messages.push({class: 'user',from: this.user_id, id: this.client_id,  message: this.message});

    this.socket.emit('command', { type: 'CHAT_MESSAGE', room: this.invitationRoom, from: this.user_id, client_id: this.client_id, content: this.message})
  }
}
