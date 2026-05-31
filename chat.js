const chatState = {
  inicializado: false,
  chatActivo: "general",
  ultimoChatRenderizado: null,
  listeners: {},
  listenersPartidas: [],
  listenerGeneral: null,
  uidPartidas: null,
  nombresUsuarios: {},
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
  chatState.chats[chatId].oculto = false;
  marcarChatLeido(chatId);

  // Iniciar listener si es partida real y no tiene uno activo
  if (chatState.chats[chatId].tipo === "partida" && chatId !== "partida-demo") {
    const query = db.collection("partidas").doc(chatId)
      .collection("mensajes").orderBy("at", "asc").limit(100);
    gestionarListenerChat(chatId, query);
  }

  actualizarTabsChat();
  renderChatActivo();
}

function actualizarAvisoMenuChat() {
  const btn = document.getElementById("btnMenuChat");
  if (!btn) return;

  const hayNoLeidos = Object.keys(chatState.chats).some(function(chatId) {
    const chat = chatState.chats[chatId];
    return chat && chat.noLeidos;
  });

  btn.classList.toggle("hasUnread", hayNoLeidos);
}

function estaSeccionChatAbierta() {
  const chat = document.getElementById("chat");
  return !!(chat && chat.style.display !== "none");
}

function marcarChatLeido(chatId) {
  if (!chatState.chats[chatId]) return;
  chatState.chats[chatId].noLeidos = false;
  actualizarTabsChat();
  actualizarAvisoMenuChat();
}

function notificarEntradaSeccionChat() {
  marcarChatLeido(chatState.chatActivo);
}

async function obtenerNombreUsuario(uid) {
  if (!uid) return "Jugador";
  if (chatState.nombresUsuarios[uid]) return chatState.nombresUsuarios[uid];

  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    const nombre = doc.exists ? (doc.data().nombre || "Jugador") : "Jugador";
    chatState.nombresUsuarios[uid] = nombre;
    return nombre;
  } catch (e) {
    return "Jugador";
  }
}

async function obtenerNombreUsuarioActual() {
  const user = auth.currentUser;
  if (!user) return "Jugador";
  return obtenerNombreUsuario(user.uid);
}

function completarNombreMensaje(chatId, msgId, uid) {
  if (!uid) return;

  obtenerNombreUsuario(uid).then(function(nombre) {
    const chat = chatState.chats[chatId];
    if (!chat) return;

    const msg = chat.mensajes.find(m => m.id === msgId);
    if (!msg) return;

    msg.autor = nombre;
    const nodo = document.querySelector('[data-msg-id="' + msgId + '"]');
    const nombreNodo = nodo ? nodo.querySelector(".chatMessageName") : null;
    if (nombreNodo) nombreNodo.textContent = nombre;
  });
}

function construirTituloPartida(data, pistaNombre) {
  return [pistaNombre || data.pistaNombre || "Pista", data.fecha || "", data.hora || ""]
    .filter(Boolean)
    .join(" - ");
}

function actualizarTituloPartida(chatId, data) {
  const chat = chatState.chats[chatId];
  if (!chat) return;

  chat.titulo = construirTituloPartida(data || {}, null);
  asegurarEntradaChat(chatId);
  actualizarTabsChat();

  if (data && data.pistaId) {
    db.collection("pistas").doc(data.pistaId).get().then(function(pistaDoc) {
      const chatActual = chatState.chats[chatId];
      if (!chatActual || !pistaDoc.exists) return;

      const pista = pistaDoc.data() || {};
      chatActual.titulo = construirTituloPartida(data, pista.nombre || "Pista");
      asegurarEntradaChat(chatId);
      actualizarTabsChat();
      if (chatId === chatState.chatActivo) renderChatActivo();
    });
  }
}

function iniciarListenerChatGeneral() {
  if (typeof chatState.listenerGeneral === "function") return;

  const query = db.collection("chat_general")
    .orderBy("at", "asc")
    .limit(100);

  chatState.listenerGeneral = query.onSnapshot({ includeMetadataChanges: true }, snapshot => {
    const chat = chatState.chats.general;
    if (!chat) return;

    snapshot.docChanges().forEach(change => {
      const doc = change.doc;
      const data = doc.data({ serverTimestamps: "estimate" });
      const isPending = doc.metadata.hasPendingWrites;
      const atMillis = data.at ? data.at.toMillis() : Date.now();

      const msgObj = {
        id: doc.id,
        autor: data.n || "Jugador",
        texto: data.t || "",
        at_val: atMillis,
        hora: data.at ? new Date(atMillis).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}) : "...",
        propio: data.u === auth.currentUser?.uid
      };
      if ((!data.n || data.n === "Jugador") && data.u) {
        completarNombreMensaje("general", doc.id, data.u);
      }

      if (change.type === "added" || change.type === "modified") {
        const idx = chat.mensajes.findIndex(m => m.id === doc.id);
        if (idx > -1) chat.mensajes[idx] = msgObj;
        else chat.mensajes.push(msgObj);

        if (!isPending && change.type === "added" && data.u !== auth.currentUser?.uid) {
          if (chatState.chatActivo !== "general" || !estaSeccionChatAbierta()) marcarChatNoLeido("general");
        }
      } else if (change.type === "removed") {
        chat.mensajes = chat.mensajes.filter(m => m.id !== doc.id);
        const el = document.querySelector('[data-msg-id="' + doc.id + '"]');
        if (el) el.remove();
      }
    });

    chat.mensajes.sort((a, b) => (a.at_val || 0) - (b.at_val || 0) || a.id.localeCompare(b.id));

    if (chatState.chatActivo === "general") renderChatActivo();
    actualizarTabsChat();
    actualizarAvisoMenuChat();
  }, error => {
    console.error("[CHAT] Listener general error:", error);
  });
}

function limpiarListenerChatGeneral() {
  if (typeof chatState.listenerGeneral === "function") {
    chatState.listenerGeneral();
  }
  chatState.listenerGeneral = null;
}

function crearChatPartidaDesdeDoc(doc) {
  const data = doc.data() || {};

  if (!data.lastActivity && !data.lastMessage) return;

  const chatId = doc.id;

  if (!chatState.chats[chatId]) {
    chatState.chats[chatId] = {
      titulo: construirTituloPartida(data, null),
      tipo: "partida",
      estado: data.lastMessage || "Chat de partida",
      noLeidos: chatId !== chatState.chatActivo,
      oculto: false,
      mensajes: []
    };
  } else {
    chatState.chats[chatId].titulo = construirTituloPartida(data, null);
    chatState.chats[chatId].estado = data.lastMessage || "Chat de partida";
    chatState.chats[chatId].oculto = false;
  }

  actualizarTituloPartida(chatId, data);

  asegurarEntradaChat(chatId);

  if (typeof chatState.listeners[chatId] !== "function") {
    const query = db.collection("partidas").doc(chatId)
      .collection("mensajes").orderBy("at", "asc").limit(100);
    gestionarListenerChat(chatId, query);
  }

  if (chatId !== chatState.chatActivo || !estaSeccionChatAbierta()) {
    marcarChatNoLeido(chatId);
  }

  actualizarTabsChat();
}

function procesarPartidasChat(snapshot) {
  snapshot.docChanges().forEach(function(change) {
    if (change.type === "removed") {
      eliminarChatLocal(change.doc.id);
      return;
    }
    crearChatPartidaDesdeDoc(change.doc);
  });
}

function iniciarListenersChatsPartidas(uid) {
  if (!uid) return;
  iniciarListenerChatGeneral();
  if (chatState.uidPartidas === uid && chatState.listenersPartidas.length > 0) return;

  limpiarListenersPartidas();
  chatState.uidPartidas = uid;

  const jugadoresQuery = db.collection("partidas").where("jugadores", "array-contains", uid);
  const reservasQuery = db.collection("partidas").where("reservas", "array-contains", uid);

  chatState.listenersPartidas = [
    jugadoresQuery.onSnapshot(procesarPartidasChat, function(error) {
      console.error("[CHAT] Error escuchando partidas como jugador:", error);
    }),
    reservasQuery.onSnapshot(procesarPartidasChat, function(error) {
      console.error("[CHAT] Error escuchando partidas como reserva:", error);
    })
  ];
}

function limpiarListenersPartidas() {
  chatState.listenersPartidas.forEach(function(cancelar) {
    if (typeof cancelar === "function") cancelar();
  });
  chatState.listenersPartidas = [];
  chatState.uidPartidas = null;
}

function eliminarChatLocal(chatId) {
  if (typeof chatState.listeners[chatId] === "function") {
    chatState.listeners[chatId]();
    delete chatState.listeners[chatId];
  }

  delete chatState.chats[chatId];

  document.querySelectorAll('#chat [data-chat-tab="' + chatId + '"]').forEach(function(el) {
    el.remove();
  });

  if (chatState.ultimoChatRenderizado === chatId) chatState.ultimoChatRenderizado = null;

  if (chatState.chatActivo === chatId) {
    chatState.chatActivo = "general";
    const mensajes = document.getElementById("chatMensajes");
    if (mensajes) mensajes.replaceChildren();
  }

  actualizarTabsChat();
  renderChatActivo();
  actualizarAvisoMenuChat();
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

function asegurarEntradaChat(chatId) {
  const chat = chatState.chats[chatId];
  if (!chat) return;

  const tabs = document.getElementById("chatTabs");
  if (tabs && !tabs.querySelector('[data-chat-tab="' + chatId + '"]')) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "chatTab";
    tab.dataset.chatTab = chatId;
    tab.textContent = chat.titulo || "Chat";
    tabs.appendChild(tab);
  }

  const recientes = document.getElementById("chatRecientes");
  if (recientes) {
    const existente = recientes.querySelector('[data-chat-tab="' + chatId + '"]');
    if (existente) {
      const tituloExistente = existente.querySelector("span");
      const subtituloExistente = existente.querySelector("small");
      if (tituloExistente) tituloExistente.textContent = chat.titulo || "Chat";
      if (subtituloExistente) subtituloExistente.textContent = chat.tipo === "partida" ? "Chat de partida" : "Chat";
      return;
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "chatRecentItem";
    item.dataset.chatTab = chatId;

    const titulo = document.createElement("span");
    titulo.textContent = chat.titulo || "Chat";

    const subtitulo = document.createElement("small");
    subtitulo.textContent = chat.tipo === "partida" ? "Chat de partida" : "Chat";

    item.appendChild(titulo);
    item.appendChild(subtitulo);
    recientes.appendChild(item);
  }
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
      if ((!data.n || data.n === "Jugador") && data.u) {
        completarNombreMensaje(chatId, doc.id, data.u);
      }

      if (change.type === "added" || change.type === "modified") {
        const idx = chat.mensajes.findIndex(m => m.id === doc.id);
        if (idx > -1) chat.mensajes[idx] = msgObj;
        else chat.mensajes.push(msgObj);
        
        // Solo marcar no leído si NO es un envío local pendiente y NO es el chat activo
        if (!isPending && change.type === "added" && data.u !== auth.currentUser?.uid) {
          if (chatId !== chatState.chatActivo || !estaSeccionChatAbierta()) marcarChatNoLeido(chatId);
        }
      } else if (change.type === "removed") {
        chat.mensajes = chat.mensajes.filter(m => m.id !== doc.id);
        const el = document.querySelector(`[data-msg-id="${doc.id}"]`);
        if (el) el.remove();
      }
    });

    chat.mensajes.sort((a, b) => a.at_val - b.at_val || a.id.localeCompare(b.id));

    if (chatId === chatState.chatActivo) renderChatActivo();
  }, error => {
    console.error("[CHAT] Listener error:", error);
    const chat = chatState.chats[chatId];
    if (chat) {
      chat.estado = "Error cargando mensajes";
      if (chatId === chatState.chatActivo) renderChatActivo();
    }
  });

  chatState.listeners[chatId] = unsubscribe;
}

async function borrarMensajesChatFirestore(chatId) {
  const mensajesRef = db.collection("partidas").doc(chatId).collection("mensajes");

  while (true) {
    const snap = await mensajesRef.limit(450).get();
    if (snap.empty) return;

    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
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
    await borrarMensajesChatFirestore(chatId);
  } catch (e) {
    console.warn("[CHAT] No se pudo borrar la subcoleccion:", e.message);
    return false;
  }

  eliminarChatLocal(chatId);
  return true;
};

async function prepararEnvioChat() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  const chatId = chatState.chatActivo;
  const user = auth.currentUser;
  if (!user || !chatState.chats[chatId]) return;
  const nombre = await obtenerNombreUsuarioActual();

  if (chatState.chats[chatId].tipo === "partida" && chatId !== "partida-demo") {
    try {
      const batch = db.batch();
      const partidaRef = db.collection("partidas").doc(chatId);
      const msgRef = partidaRef.collection("mensajes").doc();

      batch.set(msgRef, {
        u: user.uid,
        n: nombre,
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
      return;
    }
  } else if (chatId === "general") {
    try {
      await db.collection("chat_general").add({
        u: user.uid,
        n: nombre,
        t: texto,
        at: firebase.firestore.FieldValue.serverTimestamp(),
        type: "text"
      });
    } catch (e) {
      console.error("[CHAT] Error enviando mensaje general:", e);
      return;
    }
  } else {
    chatState.chats[chatId].mensajes = chatState.chats[chatId].mensajes || [];
    chatState.chats[chatId].mensajes.push({
      id: "local_" + Date.now(),
      autor: nombre,
      texto: texto,
      hora: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      propio: true
    });
    renderChatActivo();
  }

  input.value = "";
}

function marcarChatNoLeido(chatId) {
  if (!chatState.chats[chatId]) return;
  if (chatId === chatState.chatActivo && estaSeccionChatAbierta()) return;

  chatState.chats[chatId].noLeidos = true;
  chatState.chats[chatId].oculto = false; // Reaparece si estaba cerrada
  actualizarTabsChat();
  actualizarAvisoMenuChat();
}

window.abrirChatPartida = function(id, fecha) {
  if (!chatState.chats[id]) {
    chatState.chats[id] = {
      titulo: "Chat " + fecha,
      tipo: "partida",
      estado: "Chat de partida",
      mensajes: [],
      oculto: false
    };
  }
  db.collection("partidas").doc(id).get().then(function(doc) {
    if (doc.exists && chatState.chats[id]) {
      actualizarTituloPartida(id, doc.data() || {});
    }
  });
  asegurarEntradaChat(id);
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

function limpiarTodoChat() {
  limpiarListenersChat();
  limpiarListenersPartidas();
  limpiarListenerChatGeneral();
}

window.initChat = initChat;
window.cambiarChatTab = cambiarChatTab;
window.marcarChatNoLeido = marcarChatNoLeido;
window.limpiarListenersChat = limpiarListenersChat;
window.limpiarTodoChat = limpiarTodoChat;
window.iniciarListenersChatsPartidas = iniciarListenersChatsPartidas;
window.notificarEntradaSeccionChat = notificarEntradaSeccionChat;
window.cerrarChatTab = cerrarChatTab;
window.gestionarListenerChat = gestionarListenerChat;

document.addEventListener("DOMContentLoaded", initChat);
