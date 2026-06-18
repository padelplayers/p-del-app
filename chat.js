const chatState = {
  inicializado: false,
  chatActivo: "general",
  ultimoChatRenderizado: null,
  listenerActivo: null,
  chatListenerActivo: null,
  listenerResumenGeneral: null,
  listenersResumenPartidas: [],
  listenerResumenPrivados: null,
  listenerUsuariosOnline: null,
  ultimoResumenGeneralAt: null,
  ultimosResumenPartidasAt: {},
  ultimosResumenPrivadosAt: {},
  titulosPartidasCache: {},
  fechasAltaUsuariosCache: {},
  chats: {
    general: {
      titulo: "General",
      tipo: "general",
      estado: "Chat del club",
      noLeidos: false,
      oculto: false,
      mensajes: []
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
  if (auth.currentUser) {
    cargarUsuariosSidebar();
  }
}

async function cambiarChatTab(chatId) {
  if (!chatState.chats[chatId]) return;

  chatState.chatActivo = chatId;
  chatState.chats[chatId].noLeidos = false;
  chatState.chats[chatId].oculto = false;

  const mensajesRef = obtenerMensajesChatRef(chatId);
  if (mensajesRef) {
    let query = mensajesRef.orderBy("at", "desc").limit(30);
    if (chatId === "general") {
      const user = auth.currentUser;
      const fechaAlta = user ? await obtenerFechaAltaUsuarioChat(user.uid) : null;
      if (chatState.chatActivo !== chatId) return;
      if (fechaAlta) {
        query = mensajesRef.where("at", ">=", fechaAlta).orderBy("at", "desc").limit(30);
        chatState.chats.general.mensajes = [];
        if (chatState.chatActivo === "general") {
          const mensajes = document.getElementById("chatMensajes");
          if (mensajes) mensajes.replaceChildren();
          chatState.ultimoChatRenderizado = null;
        }
      }
    }
    gestionarListenerChat(chatId, query);
  } else if (chatState.chatListenerActivo) {
    limpiarListenersChat();
  }

  actualizarTabsChat();
  renderChatActivo();

  if (chatId === "general") {
    marcarGeneralLeido();
  } else if (chatState.chats[chatId].tipo === "partida") {
    marcarPartidaLeida(chatId);
  } else if (chatState.chats[chatId].tipo === "privado") {
    marcarPrivadoLeido(chatId);
  }
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
        const tituloTab = chat.tituloCorto || chat.titulo;
        let textNode = Array.from(btn.childNodes).find(n => n.nodeType === 3);
        if (!textNode) {
            textNode = document.createTextNode(tituloTab);
            btn.prepend(textNode);
        } else {
            if (textNode.textContent !== tituloTab) {
                textNode.textContent = tituloTab;
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

function obtenerTituloCortoChatPartida(titulo) {
  const texto = (titulo || "").trim();
  const separadores = [" - ", " -- ", " | "];
  for (const separador of separadores) {
    if (texto.includes(separador)) {
      return texto.split(separador)[0].trim() || texto;
    }
  }
  return texto;
}

async function obtenerTituloChatPartidaResumen(partidaId, partida) {
  if (chatState.titulosPartidasCache[partidaId]) return chatState.titulosPartidasCache[partidaId];

  let titulo = normalizarTituloChatPartida(
    partida && (partida.titulo || partida.nombrePista || partida.pistaNombre || partida.localidad),
    partida && partida.fecha
  );

  if (titulo === "Partida" && partida && partida.pistaId) {
    try {
      const pistaDoc = await db.collection("pistas").doc(partida.pistaId).get();
      if (pistaDoc.exists) {
        const pista = pistaDoc.data() || {};
        const nombre = (pista.nombre || "").trim();
        const localidad = (pista.localidad || "").trim();
        titulo = nombre && localidad ? nombre + " - " + localidad : (nombre || localidad || titulo);
      }
    } catch (e) {
      console.warn("[CHAT] No se pudo leer titulo de pista para chat de partida:", e.message);
    }
  }

  chatState.titulosPartidasCache[partidaId] = titulo;
  return titulo;
}

function usuarioPuedeEntrarChatPartida(partida, uid) {
  if (!partida || !uid) return false;
  const jugadores = Array.isArray(partida.jugadores) ? partida.jugadores : [];
  const reservas = Array.isArray(partida.reservas) ? partida.reservas : [];
  return jugadores.includes(uid) || reservas.includes(uid);
}

function actualizarBotonPartidaNoLeido(chatId) {
  const btn = document.querySelector('.partidaChatBtn[data-partida-id="' + chatId + '"]');
  if (!btn || !chatState.chats[chatId]) return;
  btn.classList.toggle("hasUnread", !!chatState.chats[chatId].noLeidos);
}

function asegurarChatPartidaResumen(chatId, partida, titulo) {
  if (!chatState.chats[chatId]) {
    chatState.chats[chatId] = {
      titulo: titulo,
      tituloCorto: obtenerTituloCortoChatPartida(titulo),
      tipo: "partida",
      estado: "",
      mensajes: [],
      noLeidos: false,
      oculto: false
    };
  } else {
    chatState.chats[chatId].titulo = chatState.chats[chatId].titulo || titulo;
    chatState.chats[chatId].tituloCorto = chatState.chats[chatId].tituloCorto || obtenerTituloCortoChatPartida(titulo);
    chatState.chats[chatId].tipo = "partida";
    chatState.chats[chatId].estado = chatState.chats[chatId].estado || "";
    chatState.chats[chatId].oculto = false;
  }

  asegurarTabChat(chatId);
  actualizarBotonPartidaNoLeido(chatId);
}

function construirChatPrivadoId(uidA, uidB) {
  return "privado_" + [uidA, uidB].sort().join("_");
}

function obtenerOtroUidPrivado(participantes, uid) {
  if (!Array.isArray(participantes)) return null;
  return participantes.find(function(participanteUid) {
    return participanteUid && participanteUid !== uid;
  }) || null;
}

async function obtenerNombreUsuarioChat(uid) {
  if (!uid) return "Jugador";
  if (chatNombresUsuarios[uid]) return chatNombresUsuarios[uid];

  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    if (doc.exists) {
      const data = doc.data() || {};
      if (data.nombre) {
        chatNombresUsuarios[uid] = data.nombre;
        return data.nombre;
      }
    }
  } catch (e) {
    console.warn("[CHAT] No se pudo leer nombre de usuario:", e.message);
  }

  return "Jugador";
}

function asegurarChatPrivado(chatId, otroUid, nombre) {
  const titulo = nombre || "Jugador";

  if (!chatState.chats[chatId]) {
    chatState.chats[chatId] = {
      id: chatId,
      titulo: titulo,
      tituloCorto: titulo,
      tipo: "privado",
      estado: "Chat privado",
      mensajes: [],
      noLeidos: false,
      oculto: false,
      otroUid: otroUid
    };
  } else {
    chatState.chats[chatId].id = chatId;
    chatState.chats[chatId].titulo = titulo;
    chatState.chats[chatId].tituloCorto = titulo;
    chatState.chats[chatId].tipo = "privado";
    chatState.chats[chatId].estado = "Chat privado";
    chatState.chats[chatId].oculto = false;
    chatState.chats[chatId].otroUid = otroUid;
  }

  asegurarTabChat(chatId);
}

async function asegurarDocumentoChatPrivado(chat) {
  const user = auth.currentUser;
  if (!user || !chat || chat.tipo !== "privado" || !chat.id || !chat.otroUid) return;

  const participantes = [user.uid, chat.otroUid].sort();
  const participantesMap = {};
  participantesMap[user.uid] = true;
  participantesMap[chat.otroUid] = true;

  await db.collection("chatsPrivados").doc(chat.id).set({
    participantes: participantes,
    participantesMap: participantesMap,
    actualizadoAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

function asegurarTabChat(chatId) {
  const tabs = document.getElementById("chatTabs");
  if (!tabs || document.querySelector('#chatTabs [data-chat-tab="' + chatId + '"]')) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chatTab";
  btn.dataset.chatTab = chatId;
  btn.textContent = chatState.chats[chatId]?.tituloCorto || chatState.chats[chatId]?.titulo || "Partida";
  tabs.appendChild(btn);
}

const chatNombresUsuarios = {};

function obtenerMensajesChatRef(chatId) {
  const chat = chatState.chats[chatId];
  if (!chat) return null;

  if (chat.tipo === "general" && chatId === "general") {
    return db.collection("chats").doc("general").collection("mensajes");
  }

  if (chat.tipo === "partida" && chatId !== "partida-demo") {
    return db.collection("partidas").doc(chatId).collection("mensajes");
  }

  if (chat.tipo === "privado" && chatId !== "privado-demo") {
    return db.collection("chatsPrivados").doc(chatId).collection("mensajes");
  }

  return null;
}

function obtenerMensajesGeneralRef() {
  return db.collection("chats").doc("general").collection("mensajes");
}

function crearDocIdMensajeSistema(dedupeKey) {
  const base = String(dedupeKey || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 150);
  return base || ("system_" + Date.now());
}

function crearOMantenerMensajeSistemaGeneral(config) {
  if (!config || !config.dedupeKey || !config.texto) return Promise.resolve(null);

  const mensajesRef = obtenerMensajesGeneralRef();
  const docId = crearDocIdMensajeSistema(config.dedupeKey);
  const msgRef = mensajesRef.doc(docId);
  const generalRef = db.collection("chats").doc("general");

  return db.runTransaction(function(transaction) {
    return transaction.get(msgRef).then(function(doc) {
      if (doc.exists) return doc.id;

      const ahora = firebase.firestore.FieldValue.serverTimestamp();
      const payload = {
        u: "sistema",
        n: "Sistema",
        t: config.texto,
        at: ahora,
        type: "system",
        system: true,
        origin: config.origin || "partidas",
        partidaId: config.partidaId || null,
        eventType: config.eventType || null,
        dedupeKey: config.dedupeKey,
        action: config.action || "abrir_partida",
        valid: true,
        createdAt: ahora
      };

      transaction.set(msgRef, payload);
      transaction.set(generalRef, {
        lastMessage: config.texto,
        lastActivity: ahora,
        lastSender: "sistema",
        lastSenderName: "Sistema",
        lastMessageType: "system"
      }, { merge: true });

      return docId;
    });
  }).catch(function(error) {
    console.warn("[CHAT] No se pudo crear mensaje Sistema:", error.message);
    return null;
  });
}

function resolverMensajeSistemaGeneral(dedupeKey) {
  if (!dedupeKey) return Promise.resolve(false);

  const msgRef = obtenerMensajesGeneralRef().doc(crearDocIdMensajeSistema(dedupeKey));
  return msgRef.get().then(function(doc) {
    if (!doc.exists) return false;
    const data = doc.data() || {};
    if (data.system !== true && data.type !== "system") return false;
    return msgRef.delete().then(function() { return true; });
  }).catch(function(error) {
    console.warn("[CHAT] No se pudo resolver mensaje Sistema:", error.message);
    return false;
  });
}

function resolverMensajesSistemaPorPartida(partidaId, opciones) {
  if (!partidaId) return Promise.resolve(0);
  opciones = opciones || {};
  const dedupeKeys = Array.isArray(opciones.dedupeKeys) ? opciones.dedupeKeys : null;
  const eventTypes = Array.isArray(opciones.eventTypes) ? opciones.eventTypes : null;

  return obtenerMensajesGeneralRef().where("partidaId", "==", partidaId).get()
    .then(function(snapshot) {
      const batch = db.batch();
      let contador = 0;

      snapshot.forEach(function(doc) {
        const data = doc.data() || {};
        const esSistema = data.system === true || data.type === "system";
        if (!esSistema) return;
        if (dedupeKeys && !dedupeKeys.includes(data.dedupeKey)) return;
        if (eventTypes && !eventTypes.includes(data.eventType)) return;

        batch.delete(doc.ref);
        contador++;
      });

      if (!contador) return 0;
      return batch.commit().then(function() { return contador; });
    }).catch(function(error) {
      console.warn("[CHAT] No se pudieron resolver mensajes Sistema de la partida:", error.message);
      return 0;
    });
}

function abrirPartidaDesdeChatGeneral(partidaId) {
  if (!partidaId) return;

  window.partidaPendienteDestacar = partidaId;
  if (typeof mostrar === "function") {
    mostrar("partidas");
  }

  if (typeof cargarPartidas === "function") {
    cargarPartidas();
  }

  let intentos = 0;
  const intentarDestacar = function() {
    intentos++;
    if (typeof window.destacarPartidaEnLista === "function" && window.destacarPartidaEnLista(partidaId)) {
      window.partidaPendienteDestacar = null;
      return;
    }
    if (intentos < 8) {
      setTimeout(intentarDestacar, 250);
    }
  };

  setTimeout(intentarDestacar, 250);
}

async function obtenerNombreAutorChat(user) {
  if (!user) return "Jugador";
  if (chatNombresUsuarios[user.uid]) return chatNombresUsuarios[user.uid];

  try {
    const doc = await db.collection("usuarios").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data() || {};
      if (data.nombre) {
        chatNombresUsuarios[user.uid] = data.nombre;
        return data.nombre;
      }
    }

    if (user.email) {
      const snap = await db.collection("usuarios")
        .where("email", "==", user.email)
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data() || {};
        if (data.nombre) {
          chatNombresUsuarios[user.uid] = data.nombre;
          return data.nombre;
        }
      }
    }
  } catch (e) {
    console.warn("[CHAT] No se pudo leer el nombre del usuario:", e.message);
  }

  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "Jugador";
}

const CHAT_PRESENCIA_MAX_AGE_MS = 120000;

function obtenerMillisLastSeenChat(valor) {
  if (!valor) return 0;
  if (typeof valor.toMillis === "function") return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number") return valor;
  return 0;
}

function usuarioOnlineVigenteChat(usuario) {
  if (!usuario || usuario.online !== true) return false;

  const lastSeenMs = obtenerMillisLastSeenChat(usuario.lastSeen);
  if (!lastSeenMs) return false;

  return Date.now() - lastSeenMs <= CHAT_PRESENCIA_MAX_AGE_MS;
}

function cargarUsuariosSidebar() {
  const lista = document.querySelector(".chatUserList");
  if (!lista) return;
  if (!auth.currentUser) return;

  if (typeof chatState.listenerUsuariosOnline === "function") {
    chatState.listenerUsuariosOnline();
    chatState.listenerUsuariosOnline = null;
  }

  chatState.listenerUsuariosOnline = db.collection("usuarios").where("online", "==", true).onSnapshot(snapshot => {
    const fragment = document.createDocumentFragment();

    snapshot.forEach(doc => {
      const u = doc.data();
      if (doc.id === auth.currentUser?.uid) {
        return;
      } // No mostrarse a sí mismo

      if (!usuarioOnlineVigenteChat(u)) return;

      const div = document.createElement("div");
      div.className = "chatUserItem";
      div.style.cursor = "pointer";
      div.onclick = function() {
        abrirChatPrivado(doc.id, u.nombre || "Jugador");
      };

      const dot = document.createElement("div");
      dot.className = "chatOnlineDot";

      const name = document.createElement("span");
      name.textContent = u.nombre || "Jugador";
      
      div.appendChild(dot);
      div.appendChild(name);
      fragment.appendChild(div);
    });

    lista.replaceChildren(fragment);
  }, error => {
    console.warn("[CHAT] No se pudo cargar usuarios online:", error.message);
  });
}

function limpiarListenerUsuariosOnline() {
  if (typeof chatState.listenerUsuariosOnline === "function") {
    chatState.listenerUsuariosOnline();
  }

  chatState.listenerUsuariosOnline = null;
}

/**
 * Crea un nodo de mensaje DOM sin inyectarlo.
 * Arquitectura atómica para permitir actualizaciones futuras (reacciones, edición).
 */
function crearNodoMensaje(msg) {
  const esSistema = msg && (msg.system === true || msg.type === "system");
  const div = document.createElement("div");
  div.className = "chatMessage" + (!esSistema && msg.propio ? " mine" : "") + (esSistema ? " chatMessageSistema" : "");
  div.dataset.msgId = msg.id; // Identificador persistente

  if (esSistema) {
    const puedeAbrirPartida = msg.action === "abrir_partida" && !!msg.partidaId;
    const header = document.createElement("div");
    header.className = "chatSistemaHeader";

    const logo = document.createElement("img");
    logo.className = "chatSistemaLogo";
    logo.src = "logo.png";
    logo.alt = "";
    logo.setAttribute("aria-hidden", "true");

    const name = document.createElement("div");
    name.className = "chatMessageName chatSistemaAutor";
    name.textContent = "Sistema";

    const text = document.createElement("div");
    text.className = "chatSistemaTexto";
    text.textContent = msg.texto || "";

    const meta = document.createElement("div");
    meta.className = "chatMessageMeta chatSistemaMeta";
    meta.textContent = msg.hora || "";

    header.appendChild(logo);
    header.appendChild(name);
    div.appendChild(header);
    div.appendChild(text);

    if (puedeAbrirPartida) {
      const accion = document.createElement("button");
      accion.type = "button";
      accion.className = "chatSistemaAccion";
      accion.textContent = "Abrir partida";
      accion.onclick = function(event) {
        event.stopPropagation();
        abrirPartidaDesdeChatGeneral(msg.partidaId);
      };

      div.classList.add("chatMessageActionable");
      div.tabIndex = 0;
      div.onclick = function() {
        abrirPartidaDesdeChatGeneral(msg.partidaId);
      };
      div.onkeydown = function(event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrirPartidaDesdeChatGeneral(msg.partidaId);
        }
      };

      div.appendChild(accion);
    }

    div.appendChild(meta);
    return div;
  }

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
  if (typeof chatState.listenerActivo === "function") {
    chatState.listenerActivo();
    chatState.listenerActivo = null;
    chatState.chatListenerActivo = null;
  }

  const chatInicial = chatState.chats[chatId];
  if (chatInicial) {
    chatInicial.mensajes = [];
    if (chatId === chatState.chatActivo) {
      const mensajes = document.getElementById("chatMensajes");
      if (mensajes) mensajes.replaceChildren();
      chatState.ultimoChatRenderizado = null;
    }
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
        autor: (data.system === true || data.type === "system") ? "Sistema" : (data.n || "Jugador"),
        texto: data.t || "",
        at_val: atMillis,
        hora: data.at ? new Date(atMillis).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "...",
        propio: !(data.system === true || data.type === "system") && data.u === auth.currentUser?.uid,
        type: data.type || "text",
        system: data.system === true,
        partidaId: data.partidaId || null,
        action: data.action || null,
        eventType: data.eventType || null,
        dedupeKey: data.dedupeKey || null
      };

      if (change.type === "added" || change.type === "modified") {
        const idx = chat.mensajes.findIndex(m => m.id === doc.id);
        if (idx > -1) chat.mensajes[idx] = msgObj;
        else chat.mensajes.push(msgObj);

        if (change.type === "modified" && chatId === chatState.chatActivo) {
          const el = document.querySelector(`[data-msg-id="${doc.id}"]`);
          if (el) el.replaceWith(crearNodoMensaje(msgObj));
        }
        
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

  chatState.listenerActivo = unsubscribe;
  chatState.chatListenerActivo = chatId;
}

/**
 * Cleanup Total REAL: Firestore, Listeners, Memoria y DOM.
 */
window.eliminarChatTotal = async function(chatId) {
  // 1. Unsubscribe
  if (chatState.chatListenerActivo === chatId && typeof chatState.listenerActivo === "function") {
    chatState.listenerActivo();
    chatState.listenerActivo = null;
    chatState.chatListenerActivo = null;
  }

  // 2. Borrar subcolección en Firestore (Batch)
  try {
    const snap = await db.collection("partidas").doc(chatId).collection("mensajes").get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (e) {
    console.warn("[CHAT] No se pudo borrar la subcolección:", e.message);
    return false;
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
  return true;
};

async function limpiarMensajesAntiguos(chatId) {
  try {
    const mensajesRef = obtenerMensajesChatRef(chatId);
    if (!mensajesRef) return;

    let quedanPorBorrar = true;
    while (quedanPorBorrar) {
      const snap = await mensajesRef.orderBy("at", "desc").get();

      if (snap.size <= 100) return;

      const batch = db.batch();
      let contador = 0;
      let borrados = 0;

      snap.forEach(function(doc) {
        contador++;
        if (contador > 100 && borrados < 450) {
          batch.delete(doc.ref);
          borrados++;
        }
      });

      if (!borrados) {
        quedanPorBorrar = false;
      } else {
        await batch.commit();
      }
    }
  } catch (e) {
    console.warn("[CHAT] No se pudo limpiar mensajes antiguos:", e.message);
  }
}

async function prepararEnvioChat() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  const chatId = chatState.chatActivo;
  const user = auth.currentUser;
  const chat = chatState.chats[chatId];
  if (!user || !chat) return;

  if (
    chat.tipo !== "partida" &&
    typeof window.validarAccionPorFiabilidad === "function" &&
    !(await window.validarAccionPorFiabilidad("chat"))
  ) {
    return;
  }

  const mensajesRef = obtenerMensajesChatRef(chatId);
  if (mensajesRef) {
    try {
      if (chat.tipo === "privado") {
        await asegurarDocumentoChatPrivado(chat);
      }

      const batch = db.batch();
      const msgRef = mensajesRef.doc();
      const nombreAutor = await obtenerNombreAutorChat(user);

      batch.set(msgRef, {
        u: user.uid,
        n: nombreAutor,
        t: texto,
        at: firebase.firestore.FieldValue.serverTimestamp(),
        type: "text"
      });

      if (chatId === "general") {
        const generalRef = db.collection("chats").doc("general");
        batch.set(generalRef, {
          lastMessage: texto,
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          lastSender: user.uid,
          lastSenderName: nombreAutor
        }, { merge: true });
      }

      if (chat.tipo === "partida") {
        const partidaRef = db.collection("partidas").doc(chatId);
        batch.update(partidaRef, {
          lastMessage: texto,
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          lastSender: user.uid,
          lastSenderName: nombreAutor
        });
      }

      if (chat.tipo === "privado") {
        const privadoRef = db.collection("chatsPrivados").doc(chatId);
        const otroUid = chat.otroUid;
        const participantesMap = {};
        participantesMap[user.uid] = true;
        participantesMap[otroUid] = true;
        batch.set(privadoRef, {
          participantes: [user.uid, otroUid].sort(),
          participantesMap: participantesMap,
          actualizadoAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessage: texto,
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          lastSender: user.uid,
          lastSenderName: nombreAutor
        }, { merge: true });
      }

      await batch.commit();
      await limpiarMensajesAntiguos(chatId);
      input.value = "";
    } catch (e) {
      console.error("[CHAT] Error enviando mensaje:", e);
      alert("No se pudo enviar el mensaje. Intentalo de nuevo.");
    }
  }
}

function marcarChatNoLeido(chatId) {
  if (!chatState.chats[chatId]) return;
  if (chatId === chatState.chatActivo && estaPantallaChatVisible()) return;

  chatState.chats[chatId].noLeidos = true;
  chatState.chats[chatId].oculto = false; // Reaparece si estaba cerrada
  actualizarTabsChat();
  actualizarIndicadorMenuChat();
  actualizarBotonPartidaNoLeido(chatId);
}

function actualizarIndicadorMenuChat() {
  const btn = document.getElementById("btnMenuChat");
  if (!btn) return;

  const hayNoLeidos = Object.keys(chatState.chats).some(function(chatId) {
    return !!chatState.chats[chatId].noLeidos;
  });

  btn.classList.toggle("hasUnread", hayNoLeidos);
}

function estaPantallaChatVisible() {
  const chat = document.getElementById("chat");
  return !!(
    chat &&
    (document.body.classList.contains("chatAbierto") || chat.style.display !== "none")
  );
}

async function obtenerLecturaChat(uid, chatId) {
  try {
    const doc = await db.collection("usuarios").doc(uid)
      .collection("chatLeidos").doc(chatId).get();

    if (!doc.exists) return null;
    return (doc.data() || {}).lastReadAt || null;
  } catch (e) {
    console.warn("[CHAT] No se pudo leer estado de lectura:", e.message);
    return null;
  }
}

async function obtenerFechaAltaUsuarioChat(uid) {
  if (!uid) return null;
  if (Object.prototype.hasOwnProperty.call(chatState.fechasAltaUsuariosCache, uid)) {
    return chatState.fechasAltaUsuariosCache[uid];
  }

  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    const data = doc.exists ? (doc.data() || {}) : {};
    const fechaAlta = data.fechaAlta || data.createdAt || null;
    chatState.fechasAltaUsuariosCache[uid] = fechaAlta;
    return fechaAlta;
  } catch (e) {
    console.warn("[CHAT] No se pudo leer fechaAlta del usuario:", e.message);
    chatState.fechasAltaUsuariosCache[uid] = null;
    return null;
  }
}

function timestampMayor(a, b) {
  if (!a) return false;
  if (!b) return true;

  const aMs = typeof a.toMillis === "function" ? a.toMillis() : new Date(a).getTime();
  const bMs = typeof b.toMillis === "function" ? b.toMillis() : new Date(b).getTime();
  return aMs > bMs;
}

async function evaluarResumenGeneral(data, uid) {
  if (!data || !data.lastActivity || data.lastSender === uid) return "procesado";
  if (chatState.chatActivo === "general" && estaPantallaChatVisible()) return "visible";

  const fechaAlta = await obtenerFechaAltaUsuarioChat(uid);
  if (fechaAlta && !timestampMayor(data.lastActivity, fechaAlta)) return "procesado";

  const lastReadAt = await obtenerLecturaChat(uid, "general");
  if (chatState.chatActivo === "general" && estaPantallaChatVisible()) return "visible";
  if (!timestampMayor(data.lastActivity, lastReadAt)) return "procesado";

  chatState.chats.general.noLeidos = true;
  actualizarTabsChat();
  actualizarIndicadorMenuChat();
  return "procesado";
}

function iniciarListenerResumenGeneral(uid) {
  if (typeof chatState.listenerResumenGeneral === "function") {
    chatState.listenerResumenGeneral();
    chatState.listenerResumenGeneral = null;
  }

  chatState.listenerResumenGeneral = db.collection("chats").doc("general")
    .onSnapshot(function(doc) {
      if (!doc.exists) return;

      const data = doc.data() || {};
      const at = data.lastActivity;
      const atMs = at && typeof at.toMillis === "function" ? at.toMillis() : null;
      if (atMs && atMs === chatState.ultimoResumenGeneralAt) return;

      evaluarResumenGeneral(data, uid).then(function(resultado) {
        if (resultado !== "visible") {
          chatState.ultimoResumenGeneralAt = atMs;
        }
      });
    });
}

function limpiarListenersResumenPartidas() {
  chatState.listenersResumenPartidas.forEach(function(unsubscribe) {
    if (typeof unsubscribe === "function") unsubscribe();
  });
  chatState.listenersResumenPartidas = [];
  chatState.ultimosResumenPartidasAt = {};
}

function procesarCambioResumenPartida(change, uid) {
  if (!change || change.type === "removed") return;

  const doc = change.doc;
  const data = doc.data() || {};
  const at = data.lastActivity;
  const atMs = at && typeof at.toMillis === "function" ? at.toMillis() : null;
  const cacheKey = doc.id + ":" + (atMs || "sinActividad");

  if (chatState.ultimosResumenPartidasAt[doc.id] === cacheKey) return;
  chatState.ultimosResumenPartidasAt[doc.id] = cacheKey;

  evaluarResumenPartida(doc, uid);
}

function iniciarListenersResumenPartidas(uid) {
  limpiarListenersResumenPartidas();

  const queries = [
    db.collection("partidas").where("jugadores", "array-contains", uid),
    db.collection("partidas").where("reservas", "array-contains", uid)
  ];

  chatState.listenersResumenPartidas = queries.map(function(query) {
    return query.onSnapshot(function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        procesarCambioResumenPartida(change, uid);
      });
    }, function(error) {
      console.warn("Error listener resumen partidas:", error);
    });
  });
}

function limpiarListenerResumenPrivados() {
  if (typeof chatState.listenerResumenPrivados === "function") {
    chatState.listenerResumenPrivados();
  }

  chatState.listenerResumenPrivados = null;
  chatState.ultimosResumenPrivadosAt = {};
}

function procesarCambioResumenPrivado(change, uid) {
  if (!change || change.type === "removed") return;

  const doc = change.doc;
  const data = doc.data() || {};
  const at = data.lastActivity;
  const atMs = at && typeof at.toMillis === "function" ? at.toMillis() : null;
  const cacheKey = doc.id + ":" + (atMs || "sinActividad");

  if (chatState.ultimosResumenPrivadosAt[doc.id] === cacheKey) return;
  chatState.ultimosResumenPrivadosAt[doc.id] = cacheKey;

  evaluarResumenPrivado(doc, uid);
}

function iniciarListenerResumenPrivados(uid) {
  limpiarListenerResumenPrivados();

  chatState.listenerResumenPrivados = db.collection("chatsPrivados")
    .where("participantesMap." + uid, "==", true)
    .onSnapshot(function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        procesarCambioResumenPrivado(change, uid);
      });
    }, function(error) {
      console.warn("Error listener resumen privados:", error);
    });
}

async function marcarGeneralLeido() {
  const user = auth.currentUser;
  if (!user) return;
  if (!estaPantallaChatVisible()) return;

  chatState.chats.general.noLeidos = false;
  actualizarTabsChat();
  actualizarIndicadorMenuChat();

  try {
    await db.collection("usuarios").doc(user.uid)
      .collection("chatLeidos").doc("general")
      .set({
        lastReadAt: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: "general",
        titulo: "General"
      }, { merge: true });

    chatState.chats.general.noLeidos = false;
    actualizarTabsChat();
    actualizarIndicadorMenuChat();
  } catch (e) {
    console.warn("[CHAT] No se pudo marcar General como leido:", e.message);
  }
}

async function marcarPartidaLeida(chatId) {
  const user = auth.currentUser;
  const chat = chatState.chats[chatId];
  if (!user || !chat || chat.tipo !== "partida") return;
  if (!estaPantallaChatVisible()) return;

  chat.noLeidos = false;
  actualizarTabsChat();
  actualizarIndicadorMenuChat();
  actualizarBotonPartidaNoLeido(chatId);

  try {
    await db.collection("usuarios").doc(user.uid)
      .collection("chatLeidos").doc(chatId)
      .set({
        lastReadAt: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: "partida",
        titulo: chat.titulo || "Partida"
      }, { merge: true });

    chat.noLeidos = false;
    actualizarTabsChat();
    actualizarIndicadorMenuChat();
    actualizarBotonPartidaNoLeido(chatId);
  } catch (e) {
    console.warn("[CHAT] No se pudo marcar la partida como leida:", e.message);
  }
}

async function evaluarResumenPartida(doc, uid) {
  if (!doc || !doc.exists) return;

  const chatId = doc.id;
  const data = doc.data() || {};
  if (!data.lastActivity || data.lastSender === uid) return;
  if (!usuarioPuedeEntrarChatPartida(data, uid)) return;

  if (chatState.chatActivo === chatId && estaPantallaChatVisible()) {
    marcarPartidaLeida(chatId);
    return;
  }

  const lastReadAt = await obtenerLecturaChat(uid, chatId);
  if (chatState.chatActivo === chatId && estaPantallaChatVisible()) return;
  if (!timestampMayor(data.lastActivity, lastReadAt)) return;

  const titulo = await obtenerTituloChatPartidaResumen(chatId, data);
  asegurarChatPartidaResumen(chatId, data, titulo);
  marcarChatNoLeido(chatId);
}

async function marcarPrivadoLeido(chatId) {
  const user = auth.currentUser;
  const chat = chatState.chats[chatId];
  if (!user || !chat || chat.tipo !== "privado") return;
  if (!estaPantallaChatVisible()) return;

  chat.noLeidos = false;
  actualizarTabsChat();
  actualizarIndicadorMenuChat();

  try {
    await db.collection("usuarios").doc(user.uid)
      .collection("chatLeidos").doc(chatId)
      .set({
        lastReadAt: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: "privado",
        titulo: chat.titulo || "Chat privado"
      }, { merge: true });

    chat.noLeidos = false;
    actualizarTabsChat();
    actualizarIndicadorMenuChat();
  } catch (e) {
    console.warn("[CHAT] No se pudo marcar el privado como leido:", e.message);
  }
}

async function evaluarResumenPrivado(doc, uid) {
  if (!doc || !doc.exists) {
    return;
  }

  const chatId = doc.id;
  const data = doc.data() || {};
  const participantes = Array.isArray(data.participantes) ? data.participantes : [];
  if (!data.lastActivity) {
    return;
  }
  if (data.lastSender === uid) {
    return;
  }
  if (!participantes.includes(uid)) {
    return;
  }

  const otroUid = obtenerOtroUidPrivado(participantes, uid);
  if (!otroUid) {
    return;
  }

  if (chatState.chatActivo === chatId && estaPantallaChatVisible()) {
    marcarPrivadoLeido(chatId);
    return;
  }

  const lastReadAt = await obtenerLecturaChat(uid, chatId);
  if (chatState.chatActivo === chatId && estaPantallaChatVisible()) {
    return;
  }
  if (!timestampMayor(data.lastActivity, lastReadAt)) {
    return;
  }

  const nombre = await obtenerNombreUsuarioChat(otroUid);
  asegurarChatPrivado(chatId, otroUid, nombre);
  marcarChatNoLeido(chatId);
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
  const tituloCorto = obtenerTituloCortoChatPartida(tituloChat);

  if (!chatState.chats[id]) {
    chatState.chats[id] = {
      titulo: tituloChat,
      tituloCorto: tituloCorto,
      tipo: "partida",
      estado: "",
      mensajes: [],
      oculto: false
    };
  } else {
    chatState.chats[id].titulo = tituloChat;
    chatState.chats[id].tituloCorto = tituloCorto;
    chatState.chats[id].estado = chatState.chats[id].estado || "";
    chatState.chats[id].oculto = false;
  }
  asegurarTabChat(id);
  cambiarChatTab(id);
  mostrar("chat");
};

window.abrirChatPrivado = async function(otroUid, nombre) {
  const user = auth.currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  if (!otroUid || otroUid === user.uid) return;

  const chatId = construirChatPrivadoId(user.uid, otroUid);
  const titulo = nombre || await obtenerNombreUsuarioChat(otroUid);

  asegurarChatPrivado(chatId, otroUid, titulo);
  try {
    await asegurarDocumentoChatPrivado(chatState.chats[chatId]);
  } catch (e) {
    console.error("[CHAT] No se pudo preparar el chat privado:", e);
  }

  cambiarChatTab(chatId);
  mostrar("chat");
};

function limpiarListenersChat() {
  if (typeof chatState.listenerActivo === "function") {
    chatState.listenerActivo();
  }

  chatState.listenerActivo = null;
  chatState.chatListenerActivo = null;
}

window.notificarEntradaSeccionChat = function() {
  const chatId = chatState.chatActivo || "general";
  if (chatState.chatListenerActivo !== chatId) {
    cambiarChatTab(chatId);
  } else {
    renderChatActivo();
  }

  if (chatId === "general") {
    marcarGeneralLeido();
  } else if (chatState.chats[chatId] && chatState.chats[chatId].tipo === "partida") {
    marcarPartidaLeida(chatId);
  } else if (chatState.chats[chatId] && chatState.chats[chatId].tipo === "privado") {
    marcarPrivadoLeido(chatId);
  }
};

window.abrirChatGeneral = function() {
  cambiarChatTab("general");
  mostrar("chat");
};

window.iniciarListenersChatsPartidas = function(uid) {
  iniciarListenerResumenGeneral(uid);
  iniciarListenersResumenPartidas(uid);
  iniciarListenerResumenPrivados(uid);
  cargarUsuariosSidebar();
  if (chatState.chatActivo === "general") {
    cambiarChatTab("general");
  }
};

window.limpiarTodoChat = function() {
  limpiarListenersChat();
  limpiarListenersResumenPartidas();
  limpiarListenerResumenPrivados();
  limpiarListenerUsuariosOnline();

  if (typeof chatState.listenerResumenGeneral === "function") {
    chatState.listenerResumenGeneral();
  }

  chatState.listenerResumenGeneral = null;
  chatState.ultimoResumenGeneralAt = null;
  chatState.titulosPartidasCache = {};
  chatState.fechasAltaUsuariosCache = {};
  Object.keys(chatState.chats).forEach(function(chatId) {
    chatState.chats[chatId].noLeidos = false;
    actualizarBotonPartidaNoLeido(chatId);
  });
  actualizarTabsChat();
  actualizarIndicadorMenuChat();
};

window.initChat = initChat;
window.cambiarChatTab = cambiarChatTab;
window.marcarChatNoLeido = marcarChatNoLeido;
window.limpiarListenersChat = limpiarListenersChat;
window.cerrarChatTab = cerrarChatTab;
window.gestionarListenerChat = gestionarListenerChat;
window.crearDocIdMensajeSistema = crearDocIdMensajeSistema;
window.crearOMantenerMensajeSistemaGeneral = crearOMantenerMensajeSistemaGeneral;
window.resolverMensajeSistemaGeneral = resolverMensajeSistemaGeneral;
window.resolverMensajesSistemaPorPartida = resolverMensajesSistemaPorPartida;
window.abrirPartidaDesdeChatGeneral = abrirPartidaDesdeChatGeneral;
window.chatPartidaTieneNoLeidos = function(chatId) {
  return !!(chatState.chats[chatId] && chatState.chats[chatId].noLeidos);
};

document.addEventListener("DOMContentLoaded", initChat);
