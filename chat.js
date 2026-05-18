const chatState = {
  inicializado: false,
  chatActivo: "general",
  listeners: {},
  chats: {
    general: {
      titulo: "General",
      tipo: "general",
      estado: "Preparado para integrar Firebase",
      noLeidos: false,
      mensajes: [
        {
          autor: "Sistema",
          texto: "Chat general preparado.",
          hora: "Ahora",
          propio: false
        }
      ]
    },
    "partida-demo": {
      titulo: "Partida martes",
      tipo: "partida",
      estado: "Estructura para chat de partida",
      noLeidos: true,
      mensajes: [
        {
          autor: "Sistema",
          texto: "Aqui se cargaran los mensajes de la partida.",
          hora: "Pendiente",
          propio: false
        }
      ]
    },
    "privado-demo": {
      titulo: "Privado",
      tipo: "privado",
      estado: "Estructura para chat privado",
      noLeidos: false,
      mensajes: [
        {
          autor: "Sistema",
          texto: "Aqui se cargaran los mensajes privados.",
          hora: "Pendiente",
          propio: false
        }
      ]
    }
  }
};

function initChat() {
  if (chatState.inicializado) return;

  const chat = document.getElementById("chat");
  if (!chat) return;

  const tabs = document.getElementById("chatTabs");
  const recientes = document.getElementById("chatRecientes");
  const form = document.getElementById("chatForm");

  if (tabs) {
    tabs.addEventListener("click", function(e) {
      const btn = e.target.closest("[data-chat-tab]");
      if (!btn) return;
      cambiarChatTab(btn.dataset.chatTab);
    });
  }

  if (recientes) {
    recientes.addEventListener("click", function(e) {
      const btn = e.target.closest("[data-chat-tab]");
      if (!btn) return;
      cambiarChatTab(btn.dataset.chatTab);
    });
  }

  if (form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      prepararEnvioChat();
    });
  }

  chatState.inicializado = true;
  cambiarChatTab(chatState.chatActivo);
}

function cambiarChatTab(chatId) {
  if (!chatState.chats[chatId]) return;

  chatState.chatActivo = chatId;
  chatState.chats[chatId].noLeidos = false;

  actualizarTabsChat();
  renderChatActivo();
}

function actualizarTabsChat() {
  const botones = document.querySelectorAll("#chat [data-chat-tab]");

  botones.forEach(function(btn) {
    const id = btn.dataset.chatTab;
    const chat = chatState.chats[id];

    btn.classList.toggle("active", id === chatState.chatActivo);
    btn.classList.toggle("hasUnread", !!chat && chat.noLeidos && id !== chatState.chatActivo);
  });
}

function renderChatActivo() {
  const chat = chatState.chats[chatState.chatActivo];
  if (!chat) return;

  const titulo = document.getElementById("chatTituloActivo");
  const estado = document.getElementById("chatEstadoActivo");
  const tipo = document.getElementById("chatTipoActivo");
  const mensajes = document.getElementById("chatMensajes");

  if (titulo) titulo.innerText = chat.titulo;
  if (estado) estado.innerText = chat.estado;
  if (tipo) tipo.innerText = chat.tipo;

  if (!mensajes) return;

  if (!chat.mensajes || chat.mensajes.length === 0) {
    mensajes.innerHTML = '<div class="chatEmpty">Sin mensajes todavia</div>';
    return;
  }

  mensajes.innerHTML = chat.mensajes.map(function(mensaje) {
    return (
      '<div class="chatMessage' + (mensaje.propio ? " mine" : "") + '">' +
        '<div class="chatMessageName">' + escaparHtml(mensaje.autor || "Jugador") + '</div>' +
        '<div>' + escaparHtml(mensaje.texto || "") + '</div>' +
        '<div class="chatMessageMeta">' + escaparHtml(mensaje.hora || "") + '</div>' +
      '</div>'
    );
  }).join("");

  mensajes.scrollTop = mensajes.scrollHeight;
}

function prepararEnvioChat() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  console.log("[CHAT] envio preparado, pendiente de Firebase", {
    chatId: chatState.chatActivo,
    texto: texto
  });

  input.value = "";
}

function marcarChatNoLeido(chatId) {
  if (!chatState.chats[chatId]) return;
  if (chatId === chatState.chatActivo) return;

  chatState.chats[chatId].noLeidos = true;
  actualizarTabsChat();
}

function registrarListenerChat(chatId, cancelarListener) {
  if (chatState.listeners[chatId] && typeof chatState.listeners[chatId] === "function") {
    chatState.listeners[chatId]();
  }

  chatState.listeners[chatId] = cancelarListener;
}

function limpiarListenersChat() {
  Object.keys(chatState.listeners).forEach(function(chatId) {
    const cancelar = chatState.listeners[chatId];
    if (typeof cancelar === "function") cancelar();
  });

  chatState.listeners = {};
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.initChat = initChat;
window.cambiarChatTab = cambiarChatTab;
window.marcarChatNoLeido = marcarChatNoLeido;
window.registrarListenerChat = registrarListenerChat;
window.limpiarListenersChat = limpiarListenersChat;

document.addEventListener("DOMContentLoaded", initChat);
