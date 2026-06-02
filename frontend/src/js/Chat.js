import ChatAPI from "./api/ChatAPI";

export default class Chat {
  constructor(container) {
    this.modalEl = document.querySelector('.modal__form');
    this.modalCloseEl = document.querySelector('.modal__close');
    this.modalInputEl = document.querySelector('.form__input');
    this.modalSaveNameEl = document.querySelector('.modal__ok');
    this.usersContainer = document.querySelector('.chat__userlist');
    this.chatContainer = document.querySelector('.chat__messages-container');
    this.messageInput = document.querySelector(".chat__messages-input .form__input");
    this.currentUser = null;
    this.container = container;
    this.api = new ChatAPI();
    this.websocket = null;
    this.BASE_URL = "http://localhost:3000";
    this.WS_URL = "ws://localhost:3000";
  }

  init() {
    document.addEventListener('DOMContentLoaded', (e) => {
      e.preventDefault();
      this.modalEl.classList.add('active');
      this.registerEvents(); 
    })
  }

  async createNikName(name) {
    const response = await fetch(`${this.BASE_URL}/new-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    let result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Не удалось создать псевдоним");
    }
    return result;
  }


  registerEvents() {

    this.modalCloseEl.addEventListener('click', () => {
      this.modalEl.classList.remove('active');
      this.modalInputEl.value = "";
      return;
    });

    this.modalSaveNameEl.addEventListener('click', () => {
      const name = this.modalInputEl.value.trim();
    
      if (!name) {
        this.modalInputEl.setAttribute('placeholder', "Enter a name");
        return;
      }
    
      this.createNikName(name)
        .then((result) => {
          if (result.status === "ok") {
            console.log("Пользователь создан:", result.user);
            this.currentUser = result.user;
            this.modalEl.classList.remove('active');
            this.connectWebSocket();
          }
        })
        .catch((error) => {
          this.modalInputEl.value = "";
          this.modalInputEl.setAttribute('placeholder', error.message);
        });
    });
    this.messageInput.closest('form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.sendMessage();
    });
  }

  connectWebSocket() {
    this.websocket = new WebSocket(this.WS_URL);
    this.websocket.addEventListener('open', () => {
      console.log('соединение Websocket подключено')
    });
    this.websocket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (Array.isArray(data)) {
        this.renderUsers(data);
        return;
      }
      if (data.type === 'send') {
        this.renderMessage(data);
      }
    })

  }

  sendMessage() {
      const text = this.messageInput.value.trim();
  
      if (!text) {
        return;
      }
  
      this.websocket.send(JSON.stringify({
        type: "send",
        user: this.currentUser,
        message: text,
      }));
  
      this.messageInput.value = "";
    }

  renderUsers(arrayUsers) {
    this.usersContainer.innerHTML = "";
    arrayUsers.forEach((user) => {
      const userEl = document.createElement('div');
      userEl.classList.add('chat__user');
      userEl.textContent = user.name === this.currentUser.name ? 'You' : user.name;
      this.usersContainer.appendChild(userEl);
    });
  }

  renderMessage(objMessage) {
    let messContainerEl = document.createElement('div');
    let messHeaderEl = document.createElement('div');
    messHeaderEl.classList.add('message__header');
    if (objMessage.user.name === this.currentUser.name) {
      messContainerEl.classList.add('message__container', 'message__container-yourself');
      messHeaderEl.textContent = `You ${this.timeStamp()}`;
    } else {
      messContainerEl.classList.add('message__container', 'message__container-interlocutor');
      messHeaderEl.textContent = `${objMessage.user.name} ${this.timeStamp()}`;
    }
    let messEl = document.createElement('div');
    messEl.classList.add('message__text');
    messEl.textContent = objMessage.message;
    messContainerEl.append(messHeaderEl, messEl);
    this.chatContainer.append(messContainerEl);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  timeStamp() {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    let crDate = date.toLocaleString();
    return crDate;
  }
}
