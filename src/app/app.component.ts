import { Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EnterChatFormComponent } from './enter-chat-form/enter-chat-form.component';
import { UserContainerComponent } from './user-container/user-container.component';
import { MessageService } from './services/message.service';
import { User } from './models/user.model';
import { Subscription, map } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    EnterChatFormComponent,
    UserContainerComponent,
  ],
  template: `<router-outlet />`,
})
export class AppComponent {
  title = 'chat-angular';

}
