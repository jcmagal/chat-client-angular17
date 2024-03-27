export class ChatMessage {
  constructor(
    public id: string,
    public chat: string | undefined,
    public senderId: string,
    public recipientId: string,
    public content: string,
    public timestamp: Date | string,
  ) { }
}
