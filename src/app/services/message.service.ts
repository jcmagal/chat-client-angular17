import { Injectable } from '@angular/core';
import { Client, Stomp } from '@stomp/stompjs';
import { User } from '../models/user.model';
import {
  BehaviorSubject,
  Observable,
  Subject,
  concatMap,
  firstValueFrom,
  map,
  of,
  take,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ChatMessage } from '../models/chat-message.model';
import SockJS from 'sockjs-client';


@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private stompClient: any;

  private messagesUrl = 'http://localhost:8088/messages';
  private connectedUserMessages$: Subject<ChatMessage> = new Subject();
  private unreadMessagesCountSource = new BehaviorSubject<{ [key: string]: number }>({});
  public unreadMessagesCount$ = this.unreadMessagesCountSource.asObservable();
  private activeConversation: { senderNickName: string, recipientNickName: string } | null = null;
  private notificacaoRecebidaSource = new Subject<void>();
  public notificacaoRecebida$ = this.notificacaoRecebidaSource.asObservable();

  private userUrl = 'http://localhost:8088/users';
  private connectedUsersSource = new BehaviorSubject<User[]>([]);
  public connectedUsers$ = this.connectedUsersSource.asObservable();
  private currentUser$: BehaviorSubject<User | undefined> = new BehaviorSubject<User | undefined>(undefined);

  constructor(private _http: HttpClient) { }

  connect(nickName: string, fullName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = 'http://localhost:8088/ws';
      const socket = new SockJS(url);
      this.stompClient = Stomp.over(socket);
      this.stompClient.onConnect = () => {
        try {
          this.onConnected(nickName, fullName);
          this.currentUser$.next({ nickName, fullName, status: 'ONLINE' });
          this.findAndDisplayConnectedUsers();
          resolve();
        } catch (error) {
          console.error('Error in onConnected:', error);
          reject(error);
        }
      };
      this.stompClient.activate();
    });
  }

  onConnected(nickname: string, fullname: string): any {
    this.stompClient.subscribe(`/topic/${nickname}/messages`, (payload: any) => {
      const newMessage = JSON.parse(payload.body);
      this.connectedUserMessages$.next(newMessage);

      if (!this.isMessageForActiveConversation(newMessage)) {
        const currentCounts = this.unreadMessagesCountSource.value;
        const senderId = newMessage.senderId;
        const newCount = currentCounts[senderId] ? currentCounts[senderId] + 1 : 1;
        this.unreadMessagesCountSource.next({ ...currentCounts, [senderId]: newCount });
        this.notificacaoRecebidaSource.next();
      }
    });
    this.stompClient.publish({
      destination: '/app/user.addUser',
      headers: {},
      body: JSON.stringify({
        nickName: nickname,
        fullName: fullname,
        status: 'ONLINE',
      }),
    });
    this.stompClient.subscribe('/topic/userUpdates',
      this.onMessageReceived.bind(this));

    this.startHeartbeat(nickname);

    this.stompClient.subscribe('/topic/disconnectEvent', (message: any) => {
      const data = JSON.parse(message.body);
      const user = new User(data.nickName, data.fullName, data.status);
      if (user.status === 'OFFLINE') {
        this.disconnect(user);
        this.updateUserStatus(user, 'OFFLINE');
      }
    });
  }

  public async findAndDisplayConnectedUsers() {
    const connectedUsersResponse = await firstValueFrom(this._http.get<User[]>(this.userUrl));
    const connectedUsers = connectedUsersResponse ?? [];
    this.connectedUsersSource.next(connectedUsers);
  }

  private onMessageReceived(message: any) {
    console.log('Message received', message);
    const user = JSON.parse(message.body);
    if (user && user.status) {
      this.updateUserStatus(user, user.status);
    }
  }

  public updateUserStatus(user: User, action: string): void {
    let currentUsers = this.connectedUsersSource.getValue();
    const userIndex = currentUsers.findIndex(u => u.nickName === user.nickName);
    if (userIndex !== -1) {
      const updatedUser = { ...currentUsers[userIndex], status: action };
      currentUsers[userIndex] = updatedUser;
    } else if (action === 'ONLINE') {
      currentUsers.push(user);
    }
    this.connectedUsersSource.next([...currentUsers]);
  }


  disconnect(connectedUser: User) {
    this.stompClient.publish({
      destination: '/app/user.disconnectUser',
      headers: {},
      body: JSON.stringify({ ...connectedUser, status: 'OFFLINE' }),
    });
  }

  startHeartbeat(nickName: string): void {
    const heartbeatInterval = setInterval(() => {
      if (this.stompClient.connected) {
        this.stompClient.publish({
          destination: '/app/heartbeat',
          body: JSON.stringify({ nickName: nickName }),
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 10000);
  }

  getConnectedUser(): Observable<User | undefined> {
    return this.currentUser$;
  }

  sendMessage(senderId: string, recipientId: string, message: string, messageId: string
  ) {
    const chatMessage = {
      id: messageId,
      senderId,
      recipientId,
      content: message,
      timestamp: new Date(),
    };
    this.stompClient.publish({
      destination: `/app/chat/${recipientId}`,
      headers: {},
      body: JSON.stringify(chatMessage),
    });
  }

  getUserMessages(senderId: string, recipientId: string): Observable<ChatMessage[]> {
    return this._http.get<ChatMessage[]>(
      `${this.messagesUrl}/${senderId}/${recipientId}`);
  }

  getConnectedUserMessages(): Observable<ChatMessage> {
    return this.connectedUserMessages$.asObservable();
  }

  resetUnreadMessagesCountForUser(nickName: string): void {
    const currentCounts = this.unreadMessagesCountSource.value;
    if (currentCounts[nickName]) {
      this.unreadMessagesCountSource.next({ ...currentCounts, [nickName]: 0 });
    }
  }

  public setActiveConversation(senderNickName: string, recipientNickName: string): void {
    this.activeConversation = { senderNickName, recipientNickName };
  }

  public resetActiveConversation(): void {
    this.activeConversation = null;
  }

  public isMessageForActiveConversation(message: ChatMessage): boolean {
    if (!this.activeConversation) return false;
    return (message.senderId === this.activeConversation.senderNickName && message.recipientId === this.activeConversation.recipientNickName) ||
      (message.senderId === this.activeConversation.recipientNickName && message.recipientId === this.activeConversation.senderNickName);
  }
}
