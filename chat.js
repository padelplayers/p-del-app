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
      oculto: false,
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
      noLeidos: false,
      oculto: true,
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
      titulo: "Carlos",
      tipo: "privado",
      estado: "Estructura para chat privado",
      noLeidos: false,
      oculto: true,
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
  chatState.chats[chatId].oculto = false;

  actualizarTabsChat();
  renderChatActivo();
}

function actualizarTabsChat() {
  const botones = document.querySelectorAll("#chat [data-chat-tab]");

  botones.forEach(function(btn) {
    const id = btn.dataset.chatTab;
    const chat = chatState.chats[id];
    if (!chat) return;

    // Lógica Dinámica: General siempre visible. Otros si tienen mensajes, son activos y no están ocultos.
    const esGeneral = id === "general";
    const esActivo = id === chatState.chatActivo;
    const tieneMensajes = chat.mensajes && chat.mensajes.length > 0;
    const visible = esGeneral || esActivo || (tieneMensajes && !chat.oculto);

    // Única fuente de verdad para visibilidad
    const visible = esGeneral || esActivo || chat.noLeidos || !chat.oculto;

    btn.style.display = visible ? "flex" : "none";
    if (visible && !esGeneral && btn.classList.contains('chatTab')) {
        // Añadir X de cierre si no existe y es una pestaña (no un item de sidebar)
        if (!btn.querySelector('.chatTabClose')) {
            btn.innerHTML = chat.titulo + '<span class="chatTabClose" onclick="event.stopPropagation(); cerrarChatTab(\''+id+'\')">✕</span>';

    if (visible && btn.classList.contains('chatTab')) {
        // Manipulación segura del DOM: Solo actualizamos si el nodo de texto es distinto
        let textNode = Array.from(btn.childNodes).find(n => n.nodeType === 3);
        if (!textNode) {
            textNode = document.createTextNode(chat.titulo);
            btn.prepend(textNode);
        } else {
            if (textNode.textContent !== chat.titulo) {
                textNode.textContent = chat.titulo;
            }
        }

        // Gestionar botón de cierre (X) sin destruir listeners
        if (!esGeneral && !btn.querySelector('.chatTabClose')) {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'chatTabClose';
            closeBtn.textContent = '✕';
            closeBtn.onclick = function(e) {
                e.stopPropagation();
                cerrarChatTab(id);
            };
            btn.appendChild(closeBtn);
        }
    }

    btn.classList.toggle("active", id === chatState.chatActivo);
    btn.classList.toggle("hasUnread", chat.noLeidos && id !== chatState.chatActivo);
  });
}

function cerrarChatTab(chatId) {
  if (chatId === "general") return;
  if (chatState.chats[chatId]) {
    chatState.chats[chatId].oculto = true;
    if (chatState.chatActivo === chatId) {
      cambiarChatTab("general");
    } else {
      actualizarTabsChat();
    }
  }
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
  chatState.chats[chatId].oculto = false; // Reaparece si estaba cerrada
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
window.cerrarChatTab = cerrarChatTab;

document.addEventListener("DOMContentLoaded", initChat);
