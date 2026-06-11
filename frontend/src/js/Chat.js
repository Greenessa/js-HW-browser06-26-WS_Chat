import ChatAPI from "./api/ChatAPI";

export default class Chat {
  constructor(container) {
    this.modalEl = document.querySelector(".modal__form");
    this.modalCloseEl = document.querySelector(".modal__close");
    this.modalInputEl = document.querySelector(".form__input");
    this.modalSaveNameEl = document.querySelector(".modal__ok");
    this.usersContainer = document.querySelector(".chat__userlist");
    this.chatContainer = document.querySelector(".chat__messages-container");
    this.messageInput = document.querySelector(".chat__messages-input .form__input");

    this.currentUser = null;
    this.container = container;
    this.api = new ChatAPI();
    this.websocket = null;

    // this.BASE_URL = "http://localhost:3000";
    this.BASE_URL = "https://ws1-chat-backend.onrender.com";

    // this.WS_URL = "ws://localhost:3000";
    this.WS_URL = "wss://ws1-chat-backend.onrender.com";

    this.reconnectTimer = null;
    this.reconnectDelay = 3000;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;
  }

  init() {
    if (document.readyState === "loading") { 
    document.addEventListener("DOMContentLoaded", () => {
      this.modalEl.classList.add("active");
      this.registerEvents();
    });
    } else {
      this.modalEl.classList.add("active");
      this.registerEvents();
    }
  }

  async createNikName(name) {
    const response = await fetch(`${this.BASE_URL}/new-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Не удалось создать псевдоним");
    }

    return result;
  }

  registerEvents() {
    this.modalCloseEl.addEventListener("click", () => {
      this.modalEl.classList.remove("active");
      this.modalInputEl.value = "";
    });

    this.modalSaveNameEl.addEventListener("click", () => {
      const name = this.modalInputEl.value.trim();

      if (!name) {
        this.modalInputEl.setAttribute("placeholder", "Enter a name");
        return;
      }

      this.createNikName(name)
        .then((result) => {
          if (result.status === "ok") {
            console.log("Пользователь создан:", result.user);

            this.currentUser = result.user;
            this.modalEl.classList.remove("active");
            this.connectWebSocket();
          }
        })
        .catch((error) => {
          this.modalInputEl.value = "";
          this.modalInputEl.setAttribute("placeholder", error.message);
        });
    });

    this.messageInput.closest("form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.sendMessage();
    });
  }

  connectWebSocket() {
    this.websocket = new WebSocket(this.WS_URL);

    this.websocket.addEventListener("open", () => {
      console.log("соединение Websocket подключено");

      this.reconnectAttempts = 0;
      this.showNotification("Соединение с сервером установлено");

      // Сообщаем серверу, какой пользователь связан с этим WebSocket-соединением.
      // Это нужно, чтобы сервер смог удалить пользователя при закрытии вкладки.
      if (this.currentUser) {
        this.websocket.send(
          JSON.stringify({
            type: "enter",
            user: this.currentUser,
          })
        );
      }
    });

    this.websocket.addEventListener("message", (event) => {
      let data;

      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error("Сервер прислал некорректный JSON:", event.data);
        this.showNotification("Ошибка: сервер прислал некорректные данные");
        return;
      }

      if (Array.isArray(data)) {
        this.renderUsers(data);
        return;
      }

      if (data.type === "send") {
        this.renderMessage(data);
      }
    });

    this.websocket.addEventListener("close", () => {
      console.log("соединение Websocket разорвано");

      this.showNotification("Соединение потеряно. Пробую переподключиться...");
      this.reconnectWebSocket();
    });

    this.websocket.addEventListener("error", () => {
      console.error("Ошибка WebSocket-соединения");

      this.showNotification("Ошибка соединения с сервером");

      if (this.websocket) {
        this.websocket.close();
      }
    });
  }

  reconnectWebSocket() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showNotification("Не удалось восстановить соединение. Обновите страницу.");
      return;
    }

    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, this.reconnectDelay);
  }

  sendMessage() {
    const text = this.messageInput.value.trim();

    if (!text) {
      return;
    }

    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.showNotification("Нет соединения с сервером. Сообщение не отправлено.");
      return;
    }

    this.websocket.send(
      JSON.stringify({
        type: "send",
        user: this.currentUser,
        message: text,
      })
    );

    this.messageInput.value = "";
  }

  renderUsers(arrayUsers) {
    this.usersContainer.innerHTML = "";

    arrayUsers.forEach((user) => {
      const userEl = document.createElement("div");
      userEl.classList.add("chat__user");

      userEl.textContent = user.name === this.currentUser.name ? "You" : user.name;

      this.usersContainer.appendChild(userEl);
    });
  }

  renderMessage(objMessage) {
    const messContainerEl = document.createElement("div");
    const messHeaderEl = document.createElement("div");

    messHeaderEl.classList.add("message__header");

    if (objMessage.user.name === this.currentUser.name) {
      messContainerEl.classList.add(
        "message__container",
        "message__container-yourself"
      );
      messHeaderEl.textContent = `You ${this.timeStamp()}`;
    } else {
      messContainerEl.classList.add(
        "message__container",
        "message__container-interlocutor"
      );
      messHeaderEl.textContent = `${objMessage.user.name} ${this.timeStamp()}`;
    }

    const messEl = document.createElement("div");
    messEl.classList.add("message__text");
    messEl.textContent = objMessage.message;

    messContainerEl.append(messHeaderEl, messEl);
    this.chatContainer.append(messContainerEl);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  showNotification(message) {
    let notificationEl = document.querySelector(".chat__notification");

    if (!notificationEl) {
      notificationEl = document.createElement("div");
      notificationEl.classList.add("chat__notification");

      this.container.prepend(notificationEl);
    }

    notificationEl.textContent = message;

    setTimeout(() => {
      notificationEl.textContent = "";
    }, 3000);
  }

  timeStamp() {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const crDate = date.toLocaleString();

    return crDate;
  }
}