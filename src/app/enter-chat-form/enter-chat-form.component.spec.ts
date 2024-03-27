import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnterChatFormComponent } from './enter-chat-form.component';

describe('EnterChatFormComponent', () => {
  let component: EnterChatFormComponent;
  let fixture: ComponentFixture<EnterChatFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnterChatFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EnterChatFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
