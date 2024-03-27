import { Component } from '@angular/core';
import { MessageService } from '../services/message.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-enter-chat-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './enter-chat-form.component.html',
  styleUrl: './enter-chat-form.component.css',
})
export class EnterChatFormComponent {
  nickname = '';
  fullname = '';

  constructor(private _messageService: MessageService, private router: Router) { }

  onSubmit() {
    this._messageService.connect(this.nickname, this.fullname).then(() => {
      this.router.navigate(['/chat']);
    });
    this.nickname = '';
    this.fullname = '';
  }
}
