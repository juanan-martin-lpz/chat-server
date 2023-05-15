import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { NxWelcomeComponent } from './nx-welcome.component';

import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { FormsModule } from '@angular/forms'

const config: SocketIoConfig = { url: 'ws://localhost:30002', options: { autoConnect : false} };


@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, SocketIoModule.forRoot(config), FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
