import { Routes } from "@angular/router";
import { EnterChatFormComponent } from "./enter-chat-form/enter-chat-form.component";
import { UserContainerComponent } from "./user-container/user-container.component";

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: EnterChatFormComponent, title: 'Login' },
  { path: 'chat', component: UserContainerComponent, title: 'Chat' },
];
