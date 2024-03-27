import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MessageService } from '../services/message.service';
import { User } from '../models/user.model';
import { CommonModule } from '@angular/common';
import { EMPTY, Observable, concat, map, scan, Subscription, tap } from 'rxjs';
import { ChatMessage } from '../models/chat-message.model';
import { FormsModule } from '@angular/forms';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt);

@Component({
  selector: 'app-user-container',
  standalone: true,
  imports: [CommonModule, FormsModule,],
  templateUrl: './user-container.component.html',
  styleUrl: './user-container.component.css',
})
export class UserContainerComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('chatMessages') private chatMessagesElement!: ElementRef;

  users: User[] = [];
  messages$: Observable<ChatMessage[]> = EMPTY;
  selectedUserId = '';
  selectedUser: User | null = null;
  message = '';
  show: boolean = false;
  connectedUser: User | undefined;
  hasConnectedUser = false;
  private subscriptions = new Subscription();
  unreadMessagesCount: { [key: string]: number } = {};
  notificacaoRecebida: boolean = false;
  lastSelectedUser: User | null = null;

  ngOnInit(): void {
    this.initConnectedUser();
    this.initUsers();
    this._messageService.unreadMessagesCount$.subscribe(counts => {
      this.unreadMessagesCount = counts;
      const totalUnread = Object.values(counts).reduce((acc, count) => acc + count, 0);
      this.notificacaoRecebida = totalUnread > 0;
    });
  }

  constructor(private _messageService: MessageService) {
    this._messageService.getConnectedUserMessages().subscribe(message => {
      console.log("New message from socket");
      console.log({ message });
      this.addMessageIfNotExists(message);
    });
  }

  private initConnectedUser(): void {
    this.subscriptions.add(
      this._messageService.getConnectedUser().subscribe(user => {
        this.connectedUser = user;
        this.hasConnectedUser = !!user && Object.keys(user).length > 0;
      })
    );
  }

  private initUsers(): void {
    this.subscriptions.add(
      this._messageService.connectedUsers$.subscribe(users => {
        const filteredAndSortedUsers = users
          .filter(user => user.nickName !== this.connectedUser?.nickName)
          .sort((a, b) => {
            if (a.status === "ONLINE" && b.status === "OFFLINE") {
              return -1;
            } else if (a.status === "OFFLINE" && b.status === "ONLINE") {
              return 1;
            } else {
              return 0;
            }
          });
        this.users = filteredAndSortedUsers;
      })
    );
    this._messageService.unreadMessagesCount$.subscribe(counts => {
      this.unreadMessagesCount = counts;
      this.reOrderUsers();
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  selectUser(selectedUser: User) {
    if (this.selectedUser && this.selectedUser.nickName !== selectedUser.nickName) {
      this._messageService.resetUnreadMessagesCountForUser(this.selectedUser.nickName);
    }
    this.selectedUserId = selectedUser.nickName;
    this.selectedUser = selectedUser;
    this._messageService.setActiveConversation(this.connectedUser!.nickName, selectedUser.nickName);
    this.messages$ = concat(
      this._messageService.getUserMessages(this.connectedUser!.nickName, selectedUser.nickName),
      this._messageService.getConnectedUserMessages()
    ).pipe(
      scan((messages: ChatMessage[], newMessage) => {
        console.log("scan");
        console.log([messages]);
        console.log({ newMessage });
        if (Array.isArray(newMessage)) {
          return [...messages, ...newMessage];
        } else {
          return [...messages, newMessage];
        }
      }, []),
      map((messages) =>
        messages.sort(
          (a, b) =>
            new Date(a.timestamp ?? new Date()).getTime() -
            new Date(b.timestamp ?? new Date()).getTime()
        )
      )
    );
  }

  addMessageIfNotExists(message: ChatMessage) {
    this.messages$ = this.messages$.pipe(
      map((messages) => {
        const messageExists = messages.some((msg) => msg.id === message.id);
        const belongsToActiveConversation = this._messageService.isMessageForActiveConversation(message);
        return messageExists || !belongsToActiveConversation ? messages : [...messages, message];
      }),
      map((messages) =>
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      )
    );
  }

  sendMessage() {
    if (this.connectedUser && this.selectedUserId && this.message) {
      const uniqueMessageId = Date.now().toString();
      this._messageService.sendMessage(
        this.connectedUser.nickName,
        this.selectedUserId,
        this.message,
        uniqueMessageId
      );
      const newMessage: ChatMessage = {
        id: uniqueMessageId,
        chat: undefined,
        senderId: this.connectedUser.nickName,
        recipientId: this.selectedUserId,
        content: this.message,
        timestamp: new Date(),
      };
      this.addMessageIfNotExists(newMessage);
      this.message = '';
    }
  }

  getUserFullName(senderId: string): string {
    if (this.connectedUser && senderId === this.connectedUser.nickName) {
      return this.connectedUser.fullName;
    }
    const user = this.users.find((user) => user.nickName === senderId);
    return user ? user.fullName : 'Unknown User';
  }

  isFirstMessageOfDay(
    message: ChatMessage,
    index: number,
    messages: ChatMessage[]
  ): boolean {
    if (index === 0) return true;
    const currentTimestamp = message.timestamp;
    const prevTimestamp = messages[index - 1]?.timestamp;
    if (!currentTimestamp || !prevTimestamp) {
      return false;
    }
    const currentMessageDate = new Date(currentTimestamp);
    const prevMessageDate = new Date(prevTimestamp);
    return !this.sameDay(currentMessageDate, prevMessageDate);
  }

  sameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private reOrderUsers(): void {
    let currentUsers = [...this.users];
    const unreadCounts = this.unreadMessagesCount;
    this.users = currentUsers.sort((a, b) => {
      const countA = unreadCounts[a.nickName] || 0;
      const countB = unreadCounts[b.nickName] || 0;
      if (a.status === "ONLINE" && b.status === "OFFLINE") {
        return -1;
      } else if (a.status === "OFFLINE" && b.status === "ONLINE") {
        return 1;
      } else if (a.status === b.status) {
        return countB - countA;
      }
      return 0;
    });
  }

  isConnectedUser(senderId: string): boolean {
    return senderId == this.connectedUser?.nickName;
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.chatMessagesElement.nativeElement.scrollTop =
        this.chatMessagesElement.nativeElement.scrollHeight;
    } catch (err) { }
  }

  onButtonClick(): void {
    if (!this.show && this.lastSelectedUser) {
      this.selectedUser = this.lastSelectedUser;
      this._messageService.setActiveConversation(this.connectedUser!.nickName, this.selectedUser.nickName);
    } else if (this.show && this.selectedUser) {
      this.lastSelectedUser = this.selectedUser;
      this._messageService.resetUnreadMessagesCountForUser(this.selectedUser.nickName);
      this.selectedUser = null;
      this._messageService.resetActiveConversation();
    }
    this.show = !this.show;
  }
}
