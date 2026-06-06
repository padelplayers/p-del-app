const chatState = {
  inicializado: false,
  chatActivo: "general",
  ultimoChatRenderizado: null,
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
          id: "msg_gen_1",
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
          id: "msg_part_1",
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
          id: "msg_priv_1",
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
  cargarUsuariosSidebar();
}

function cambiarChatTab(chatId) {
  if (!chatState.chats[chatId]) return;

  chatState.chatActivo = chatId;
  chatState.chats[chatId].noLeidos = false;
  chatState.chats[chatId].oculto = false;

  // Iniciar listener si es partida real y no tiene uno activo
  if (chatState.chats[chatId].tipo === "partida" && chatId !== "partida-demo") {
    const query = db.collection("partidas").doc(chatId)
      .collection("mensajes").orderBy("at", "asc").limit(100);
    gestionarListenerChat(chatId, query);
  }

  actualizarTabsChat();
  renderChatActivo();
}

function actualizarTabsChat() {
  const botones = document.querySelectorAll("#chat [data-chat-tab]");

  botones.forEach(function(btn) {
    const id = btn.dataset.chatTab;
    const chat = chatState.chats[id];
    
    // Cleanup real de tabs huérfanas en el DOM
    if (!chat) {
      btn.remove();
      return;
    }

    const esGeneral = id === "general";
    const esActivo = id === chatState.chatActivo;

    const visible = esGeneral || esActivo || chat.noLeidos || !chat.oculto;

    btn.style.display = visible ? "flex" : "none";

    if (visible && btn.classList.contains('chatTab')) {
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

function normalizarTituloChatPartida(titulo, fecha) {
  const texto = (titulo || "").trim();
  if (texto && texto !== "Cargando pista...") return texto;
  return "Partida";
}

function usuarioPuedeEntrarChatPartida(partida, uid) {
  if (!partida || !uid) return false;
  const jugadores = Array.isArray(partida.jugadores) ? partida.jugadores : [];
  const reservas = Array.isArray(partida.reservas) ? partida.reservas : [];
  return jugadores.includes(uid) || reservas.includes(uid);
}

function asegurarTabChat(chatId) {
  const tabs = document.getElementById("chatTabs");
  if (!tabs || document.querySelector('#chatTabs [data-chat-tab="' + chatId + '"]')) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chatTab";
  btn.dataset.chatTab = chatId;
  btn.textContent = chatState.chats[chatId]?.titulo || "Partida";
  tabs.appendChild(btn);
}

function cargarUsuariosSidebar() {
  const lista = document.querySelector(".chatUserList");
  if (!lista) return;

  // Nota: Actualmente carga usuarios registrados. 
  // Pendiente implementar sistema de presencia real (lastActive) para filtrar "Online".
  db.collection("usuarios").limit(12).get().then(snapshot => {
    const fragment = document.createDocumentFragment();

    snapshot.forEach(doc => {
      const u = doc.data();
      if (doc.id === auth.currentUser?.uid) return; // No mostrarse a sí mismo

      const div = document.createElement("div");
      div.className = "chatUserItem";
      div.style.cursor = "pointer";

      const dot = document.createElement("div");
      dot.className = "chatOnlineDot";

      const name = document.createElement("span");
      name.textContent = u.nombre || "Jugador";
      
      div.appendChild(dot);
      div.appendChild(name);
      fragment.appendChild(div);
    });

    lista.replaceChildren(fragment);
  });
}

/**
 * Crea un nodo de mensaje DOM sin inyectarlo.
 * Arquitectura atómica para permitir actualizaciones futuras (reacciones, edición).
 */
function crearNodoMensaje(msg) {
  const div = document.createElement("div");
  div.className = "chatMessage" + (msg.propio ? " mine" : "");
  div.dataset.msgId = msg.id; // Identificador persistente

  const name = document.createElement("div");
  name.className = "chatMessageName";
  name.textContent = msg.autor || "Jugador";

  const text = document.createElement("div");
  text.textContent = msg.texto || "";

  const meta = document.createElement("div");
  meta.className = "chatMessageMeta";
  meta.textContent = msg.hora || "";

  div.appendChild(name);
  div.appendChild(text);
  div.appendChild(meta);
  return div;
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

  // Detectar cambio de chat para limpieza inicial
  const cambioDeChat = chatState.ultimoChatRenderizado !== chatState.chatActivo;
  if (cambioDeChat) {
    mensajes.replaceChildren(); // Limpiar solo al cambiar de tab
    chatState.ultimoChatRenderizado = chatState.chatActivo;
  }

  if (!chat.mensajes || chat.mensajes.length === 0) {
    if (!mensajes.querySelector('.chatEmpty')) {
      const empty = document.createElement("div");
      empty.className = "chatEmpty";
      empty.textContent = "Sin mensajes todavía";
      mensajes.replaceChildren(empty);
    }
    return;
  } else {
    const emptyDiv = mensajes.querySelector('.chatEmpty');
    if (emptyDiv) emptyDiv.remove();
  }

  const estaAlFinal = mensajes.scrollHeight - mensajes.scrollTop <= mensajes.clientHeight + 50;
  const fragment = document.createDocumentFragment();
  let hayNuevos = false;

  chat.mensajes.forEach(function(msg) {
    if (!mensajes.querySelector('[data-msg-id="' + msg.id + '"]')) {
      fragment.appendChild(crearNodoMensaje(msg));
      hayNuevos = true;
    }
  });

  if (hayNuevos) {
    mensajes.appendChild(fragment);
    if (cambioDeChat || estaAlFinal) {
      mensajes.scrollTop = mensajes.scrollHeight;
    }
  }
}

/**
 * Gestionar Listener Realtime: desuscripción segura y detección de pending writes.
 */
function gestionarListenerChat(chatId, query) {
  // 1. Destruir listener previo si existe para este chat
  if (typeof chatState.listeners[chatId] === "function") {
    chatState.listeners[chatId](); 
  }

  const unsubscribe = query.onSnapshot({ includeMetadataChanges: true }, snapshot => {
    const chat = chatState.chats[chatId];
    if (!chat) return;

    snapshot.docChanges().forEach(change => {
      const doc = change.doc;
      const data = doc.data({ serverTimestamps: 'estimate' });
      const isPending = doc.metadata.hasPendingWrites;
      const atMillis = data.at ? data.at.toMillis() : Date.now();

      const msgObj = {
        id: doc.id,
        autor: data.n || "Jugador",
        texto: data.t || "",
        at_val: atMillis,
        hora: data.at ? new Date(atMillis).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "...",
        propio: data.u === auth.currentUser?.uid
      };

      if (change.type === "added" || change.type === "modified") {
        const idx = chat.mensajes.findIndex(m => m.id === doc.id);
        if (idx > -1) chat.mensajes[idx] = msgObj;
        else chat.mensajes.push(msgObj);
        
        // Solo marcar no leído si NO es un envío local pendiente y NO es el chat activo
        if (!isPending && change.type === "added" && data.u !== auth.currentUser?.uid) {
          if (chatId !== chatState.chatActivo) marcarChatNoLeido(chatId);
        }
      } else if (change.type === "removed") {
        chat.mensajes = chat.mensajes.filter(m => m.id !== doc.id);
        const el = document.querySelector(`[data-msg-id="${doc.id}"]`);
        if (el) el.remove();
      }
    });

    chat.mensajes.sort((a, b) => a.at_val - b.at_val || a.id.localeCompare(b.id));

    if (chatId === chatState.chatActivo) renderChatActivo();
  });

  chatState.listeners[chatId] = unsubscribe;
}

/**
 * Cleanup Total REAL: Firestore, Listeners, Memoria y DOM.
 */
window.eliminarChatTotal = async function(chatId) {
  // 1. Unsubscribe
  if (typeof chatState.listeners[chatId] === "function") {
    chatState.listeners[chatId]();
    delete chatState.listeners[chatId];
  }

  // 2. Borrar subcolección en Firestore (Batch)
  try {
    const snap = await db.collection("partidas").doc(chatId).collection("mensajes").get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (e) {
    console.warn("[CHAT] No se pudo borrar la subcolección:", e.message);
  }

  // 3. Limpiar estado local
  delete chatState.chats[chatId];
  if (chatState.ultimoChatRenderizado === chatId) chatState.ultimoChatRenderizado = null;
  
  if (chatState.chatActivo === chatId) {
    chatState.chatActivo = "general";
    const msgsEl = document.getElementById("chatMessages");
    if (msgsEl) msgsEl.replaceChildren();
  }

  actualizarTabsChat();
  renderChatActivo();
};

async function prepararEnvioChat() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  const chatId = chatState.chatActivo;
  const user = auth.currentUser;
  if (!user || !chatState.chats[chatId]) return;

  if (chatState.chats[chatId].tipo === "partida" && chatId !== "partida-demo") {
    try {
      const batch = db.batch();
      const partidaRef = db.collection("partidas").doc(chatId);
      const msgRef = partidaRef.collection("mensajes").doc();

      batch.set(msgRef, {
        u: user.uid,
        n: user.displayName || "Jugador",
        t: texto,
        at: firebase.firestore.FieldValue.serverTimestamp(),
        type: "text"
      });

      batch.update(partidaRef, {
        lastMessage: texto,
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
    } catch (e) {
      console.error("[CHAT] Error enviando mensaje:", e);
    }
  }

  input.value = "";
}

function marcarChatNoLeido(chatId) {
  if (!chatState.chats[chatId]) return;
  if (chatId === chatState.chatActivo) return;

  chatState.chats[chatId].noLeidos = true;
  chatState.chats[chatId].oculto = false; // Reaparece si estaba cerrada
  actualizarTabsChat();
}

window.abrirChatPartida = async function(id, fecha, titulo) {
  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  let partida = null;
  try {
    const doc = await db.collection("partidas").doc(id).get();
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }
    partida = doc.data() || {};
  } catch (e) {
    console.error("[CHAT] Error comprobando acceso a partida:", e);
    alert("No se pudo abrir el chat de la partida");
    return;
  }

  if (!usuarioPuedeEntrarChatPartida(partida, user.uid)) {
    alert("Solo los jugadores y reservas de esta partida pueden entrar al chat");
    return;
  }

  const tituloChat = normalizarTituloChatPartida(titulo, fecha);

  if (!chatState.chats[id]) {
    chatState.chats[id] = {
      titulo: tituloChat,
      tipo: "partida",
      mensajes: [],
      oculto: false
    };
  } else {
    chatState.chats[id].titulo = tituloChat;
    chatState.chats[id].oculto = false;
  }
  asegurarTabChat(id);
  cambiarChatTab(id);
  mostrar("chat");
};

function limpiarListenersChat() {
  Object.keys(chatState.listeners).forEach(function(chatId) {
    const cancelar = chatState.listeners[chatId];
    if (typeof cancelar === "function") cancelar();
  });

  chatState.listeners = {};
}

window.initChat = initChat;
window.cambiarChatTab = cambiarChatTab;
window.marcarChatNoLeido = marcarChatNoLeido;
window.limpiarListenersChat = limpiarListenersChat;
window.cerrarChatTab = cerrarChatTab;
window.gestionarListenerChat = gestionarListenerChat;

document.addEventListener("DOMContentLoaded", initChat);
