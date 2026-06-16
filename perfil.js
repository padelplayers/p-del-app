let unsubscribePerfil = null;
let unsubscribeUser = null;

function obtenerTotalPerfil(valor) {
  if (Array.isArray(valor)) return valor.length;
  if (typeof valor === "number") return valor;
  return 0;
}

function existeValorNivelPerfil(valor) {
  return valor !== undefined && valor !== null && valor !== "";
}

function normalizarNumeroNivelPerfil(valor, fallback) {
  if (!existeValorNivelPerfil(valor)) return fallback;
  const numero = Number(String(valor).replace(",", "."));
  return isNaN(numero) ? fallback : numero;
}

function formatearNivelPerfil(valor) {
  const numero = Number(valor);
  if (isNaN(numero)) return "";
  return numero.toFixed(2);
}

function calcularMediaValoracionPerfil(clasificacion, campoTotal) {
  const valoracionesRecibidas = Number((clasificacion && clasificacion.valoracionesRecibidas) || 0);
  if (!valoracionesRecibidas || valoracionesRecibidas <= 0) return 0;

  const total = Number((clasificacion && clasificacion[campoTotal]) || 0);
  if (isNaN(total)) return 0;

  return total / valoracionesRecibidas;
}

function crearEstrellasValoracionPerfil(media) {
  const contenedor = document.createElement("span");
  contenedor.className = "clasificacionEstrellas perfilEstrellasValoracion";

  const numero = Number(media);
  const valor = isNaN(numero) ? 0 : numero;

  for (let i = 1; i <= 5; i++) {
    const estrella = document.createElement("span");
    estrella.className = "clasificacionEstrella";
    estrella.textContent = "★";

    if (valor >= i) {
      estrella.classList.add("llena");
    } else if (valor >= i - 0.5) {
      estrella.classList.add("media");
    } else {
      estrella.classList.add("vacia");
    }

    contenedor.appendChild(estrella);
  }

  return contenedor;
}

function renderizarFilaValoracionPerfil(id, nombre, media) {
  const fila = document.getElementById(id);
  if (!fila) return;

  const valor = Number(media) || 0;
  fila.replaceChildren();

  const etiqueta = document.createElement("span");
  etiqueta.className = "perfilValoracionNombre";
  etiqueta.textContent = nombre;

  const estrellas = crearEstrellasValoracionPerfil(valor);

  const numero = document.createElement("strong");
  numero.className = "perfilValoracionNumero";
  numero.textContent = valor.toFixed(1);

  fila.appendChild(etiqueta);
  fila.appendChild(estrellas);
  fila.appendChild(numero);
}

function renderizarValoracionesPerfil(clasificacion) {
  clasificacion = clasificacion || {};

  renderizarFilaValoracionPerfil(
    "valoracionPuntualidadPerfil",
    "Puntualidad",
    calcularMediaValoracionPerfil(clasificacion, "puntualidadTotal")
  );

  renderizarFilaValoracionPerfil(
    "valoracionActitudPerfil",
    "Actitud",
    calcularMediaValoracionPerfil(clasificacion, "actitudTotal")
  );

  renderizarFilaValoracionPerfil(
    "valoracionCompromisoPerfil",
    "Compromiso",
    calcularMediaValoracionPerfil(clasificacion, "compromisoTotal")
  );
}

function renderizarEvolucionNivelPerfil(data) {
  let nivelActualNum = normalizarNumeroNivelPerfil(data && data.nivel, null);
  const nivelInicialNum = normalizarNumeroNivelPerfil(data && data.nivelInicial, nivelActualNum);
  if (nivelActualNum === null && nivelInicialNum !== null) nivelActualNum = nivelInicialNum;

  const nivelActual = nivelActualNum === null ? "0.00" : formatearNivelPerfil(nivelActualNum);
  const nivelInicial = nivelInicialNum === null ? "0.00" : formatearNivelPerfil(nivelInicialNum);

  let delta = normalizarNumeroNivelPerfil(data && data.nivelDelta, null);
  if (delta === null) delta = (nivelActualNum || 0) - (nivelInicialNum || 0);
  if (Math.abs(delta) < 0.005) delta = 0;

  const nivelPerfil = document.getElementById("nivelPerfil");
  if (nivelPerfil) nivelPerfil.innerText = nivelActual + " nivel";

  const nivelInicialPerfil = document.getElementById("nivelInicialPerfil");
  if (nivelInicialPerfil) nivelInicialPerfil.innerText = nivelInicial;

  const nivelActualPerfil = document.getElementById("nivelActualPerfil");
  if (nivelActualPerfil) nivelActualPerfil.innerText = nivelActual;

  const nivelDeltaPerfil = document.getElementById("nivelDeltaPerfil");
  if (nivelDeltaPerfil) {
    nivelDeltaPerfil.classList.remove("nivelDeltaSube", "nivelDeltaBaja", "nivelDeltaIgual");
    if (delta > 0) {
      nivelDeltaPerfil.innerText = "▲ +" + delta.toFixed(2);
      nivelDeltaPerfil.classList.add("nivelDeltaSube");
    } else if (delta < 0) {
      nivelDeltaPerfil.innerText = "▼ " + delta.toFixed(2);
      nivelDeltaPerfil.classList.add("nivelDeltaBaja");
    } else {
      nivelDeltaPerfil.innerText = "0.00";
      nivelDeltaPerfil.classList.add("nivelDeltaIgual");
    }
  }
}

function obtenerFotoVisualPerfil(data, usarFallbackSexo) {
  data = data || {};
  if (usarFallbackSexo) {
    return data.fotoPerfil && data.fotoPerfil.startsWith("http")
      ? data.fotoPerfil
      : (data.sexo === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg");
  }

  return data.fotoPerfil || "imagen/hombre.jpeg";
}

function renderizarDatosVisualesPerfil(data, opciones) {
  data = data || {};
  opciones = opciones || {};

  const nombrePerfil = document.getElementById("nombrePerfil");
  if (nombrePerfil) nombrePerfil.innerText = data.nombre || "";

  renderizarEvolucionNivelPerfil(data);

  const fotoPerfil = document.getElementById("fotoPerfil");
  if (fotoPerfil) fotoPerfil.src = obtenerFotoVisualPerfil(data, opciones.usarFallbackSexo === true);

  const manoPerfil = document.getElementById("manoPerfil");
  if (manoPerfil) manoPerfil.innerText = data.mano || "-";

  const posicionPerfil = document.getElementById("posicionPerfil");
  if (posicionPerfil) posicionPerfil.innerText = data.posicion || "-";

  if (opciones.actualizarStats !== false) {
    const clasificacion = data.clasificacion || {};
    const partidasCount = document.getElementById("partidasCount");
    if (partidasCount) partidasCount.innerText = obtenerTotalPerfil(clasificacion.partidos);

    renderizarValoracionesPerfil(clasificacion);

    const seguidores = document.getElementById("seguidores");
    if (seguidores) seguidores.innerText = obtenerTotalPerfil(data.seguidores);

    const seguidos = document.getElementById("seguidos");
    if (seguidos) seguidos.innerText = obtenerTotalPerfil(data.siguiendo);
  }

  const manoSelect = document.getElementById("manoEditar");
  const posicionSelect = document.getElementById("posicionEditar");

  if (manoSelect && data.mano) manoSelect.value = data.mano;
  if (posicionSelect && data.posicion) posicionSelect.value = data.posicion;
}

function configurarBotonChatPrivadoPerfil(uid) {
  const user = auth.currentUser;
  const botones = document.querySelector("#perfil .perfil-botones");
  if (!user || !botones) return;

  let btn = document.getElementById("btnChatPrivadoPerfil");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnChatPrivadoPerfil";
    btn.type = "button";
    btn.className = "btnBlue";
    btn.textContent = "Chat privado";
    botones.appendChild(btn);
  }

  const esPerfilAjeno = uid && uid !== user.uid;
  btn.style.display = esPerfilAjeno ? "block" : "none";
  btn.onclick = esPerfilAjeno ? function() {
    const nombre = document.getElementById("nombrePerfil")?.innerText || "Jugador";
    if (typeof window.abrirChatPrivado === "function") {
      window.abrirChatPrivado(uid, nombre);
    }
  } : null;
}

async function resolverPartidasActivasAntesDeEliminarPerfil(uid) {
  if (!uid) return;

  if (typeof ejecutarSalirDePartidaTransaccional !== "function") {
    throw new Error("No esta disponible la salida transaccional de partidas.");
  }

  const consultas = await Promise.all([
    db.collection("partidas").where("jugadores", "array-contains", uid).get(),
    db.collection("partidas").where("reservas", "array-contains", uid).get()
  ]);

  const partidasActivas = {};

  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      if (p.estado !== "abierta" && p.estado !== "confirmada") return;
      partidasActivas[doc.id] = doc.ref;
    });
  });

  const ids = Object.keys(partidasActivas);
  for (let i = 0; i < ids.length; i++) {
    const partidaId = ids[i];
    await ejecutarSalirDePartidaTransaccional(partidaId, partidasActivas[partidaId], uid, {
      confirmarCreador: false,
      refrescar: false,
      silencioso: true,
      propagarError: true
    });
  }
}

async function borrarSnapshotEnBatchesPerfil(snapshot) {
  if (!snapshot || snapshot.empty) return;

  let batch = db.batch();
  let contador = 0;
  const commits = [];

  snapshot.forEach(function(doc) {
    batch.delete(doc.ref);
    contador++;

    if (contador >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });

  if (contador > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function borrarMensajesQueryPerfil(query) {
  const snapshot = await query.get();
  await borrarSnapshotEnBatchesPerfil(snapshot);
}

async function recalcularUltimoMensajeChatPerfil(parentRef, mensajesRef) {
  const snapshot = await mensajesRef.orderBy("at", "desc").limit(1).get();

  if (!snapshot.empty) {
    const mensaje = snapshot.docs[0].data() || {};
    await parentRef.set({
      lastMessage: mensaje.t || "",
      lastActivity: mensaje.at || null,
      lastSender: mensaje.u || null,
      lastSenderName: mensaje.n || ""
    }, { merge: true });
    return;
  }

  await parentRef.set({
    lastMessage: "",
    lastActivity: null,
    lastSender: null,
    lastSenderName: ""
  }, { merge: true });
}

async function eliminarMensajesGeneralUsuarioPerfil(uid) {
  const generalRef = db.collection("chats").doc("general");
  const mensajesRef = generalRef.collection("mensajes");
  const generalDoc = await generalRef.get();
  const debeRecalcular = generalDoc.exists && (generalDoc.data() || {}).lastSender === uid;

  await borrarMensajesQueryPerfil(mensajesRef.where("u", "==", uid));

  if (debeRecalcular) {
    await recalcularUltimoMensajeChatPerfil(generalRef, mensajesRef);
  }
}

async function eliminarChatsPrivadosUsuarioPerfil(uid) {
  const snapshot = await db.collection("chatsPrivados")
    .where("participantesMap." + uid, "==", true)
    .get();

  for (let i = 0; i < snapshot.docs.length; i++) {
    const privadoRef = snapshot.docs[i].ref;
    const mensajesSnap = await privadoRef.collection("mensajes").get();
    await borrarSnapshotEnBatchesPerfil(mensajesSnap);
    await privadoRef.delete();
  }
}

async function obtenerPartidasCandidatasMensajesUsuarioPerfil(uid) {
  const consultas = await Promise.all([
    db.collection("partidas").where("jugadores", "array-contains", uid).get(),
    db.collection("partidas").where("reservas", "array-contains", uid).get(),
    db.collection("partidas").where("creadaPor", "==", uid).get(),
    db.collection("partidas").where("creador", "==", uid).get()
  ]);

  const partidas = {};
  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      partidas[doc.id] = doc.ref;
    });
  });

  return Object.keys(partidas).map(function(id) {
    return partidas[id];
  });
}

async function eliminarMensajesPartidasUsuarioPerfil(uid) {
  const partidasRefs = await obtenerPartidasCandidatasMensajesUsuarioPerfil(uid);

  for (let i = 0; i < partidasRefs.length; i++) {
    const partidaRef = partidasRefs[i];
    const partidaDoc = await partidaRef.get();
    if (!partidaDoc.exists) continue;

    const partida = partidaDoc.data() || {};
    const mensajesRef = partidaRef.collection("mensajes");
    const debeRecalcular = partida.lastSender === uid;

    await borrarMensajesQueryPerfil(mensajesRef.where("u", "==", uid));

    if (debeRecalcular) {
      await recalcularUltimoMensajeChatPerfil(partidaRef, mensajesRef);
    }
  }
}

async function eliminarMensajesUsuarioAntesDeEliminarPerfil(uid) {
  if (!uid) return;

  await eliminarMensajesGeneralUsuarioPerfil(uid);
  await eliminarChatsPrivadosUsuarioPerfil(uid);
  await eliminarMensajesPartidasUsuarioPerfil(uid);
}

async function eliminarPerfil() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  try {
    alert("Vas a eliminar tu cuenta. Esta accion no se puede deshacer.");

    const confirmacion = prompt("Escribe ELIMINAR para confirmar el borrado definitivo de tu cuenta");
    if (confirmacion !== "ELIMINAR") {
      alert("Eliminacion cancelada");
      return;
    }

    if (!user.email || !firebase.auth.EmailAuthProvider) {
      alert("No se puede reautenticar esta cuenta desde la app");
      return;
    }

    const password = prompt("Introduce tu contrasena actual para confirmar la eliminacion");
    if (!password) {
      alert("Eliminacion cancelada");
      return;
    }

    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    try {
      await user.reauthenticateWithCredential(credential);
    } catch (errorReauth) {
      console.error(errorReauth);
      alert("No se pudo confirmar tu identidad. No se ha borrado nada.");
      return;
    }

    const userRef = db.collection("usuarios").doc(uid);
    const userDoc = await userRef.get();
    const datosPerfil = userDoc.exists ? (userDoc.data() || {}) : {};
    const fotoPerfil = datosPerfil.fotoPerfil || "";

    await eliminarMensajesUsuarioAntesDeEliminarPerfil(uid);

    await resolverPartidasActivasAntesDeEliminarPerfil(uid);

    // 1. borrar subcoleccion chatLeidos del propio usuario
    const chatLeidosSnap = await userRef.collection("chatLeidos").get();
    if (!chatLeidosSnap.empty) {
      const batchChatLeidos = db.batch();
      chatLeidosSnap.forEach(doc => batchChatLeidos.delete(doc.ref));
      await batchChatLeidos.commit();
    }

    // 2. limpiar referencias sociales
    const snapshot = await db.collection("usuarios").get();

    const updates = [];

    snapshot.forEach(doc => {
      if (doc.id === uid) return;

      const data = doc.data();

      if (data.siguiendo && data.siguiendo.includes(uid)) {
        updates.push(
          db.collection("usuarios").doc(doc.id).update({
            siguiendo: data.siguiendo.filter(id => id !== uid)
          })
        );
      }

      if (data.seguidores && data.seguidores.includes(uid)) {
        updates.push(
          db.collection("usuarios").doc(doc.id).update({
            seguidores: data.seguidores.filter(id => id !== uid)
          })
        );
      }
    });

    await Promise.all(updates);

    // 3. borrar foto de Storage si existe y la utilidad esta disponible
    if (
      fotoPerfil &&
      fotoPerfil.includes("firebasestorage") &&
      typeof borrarImagen === "function"
    ) {
      await borrarImagen(fotoPerfil);
    }

    // 4. borrar Firestore
    await userRef.delete();

    // 5. borrar Auth
    await user.delete();

    alert("Cuenta eliminada");
    await auth.signOut();
    mostrar("login");

  } catch (error) {

    console.error(error);

    if (error.code === "auth/requires-recent-login") {
      alert("Vuelve a iniciar sesión para eliminar la cuenta");
      await auth.signOut();
    } else {
      alert("No se pudo eliminar la cuenta. No se ha completado el borrado.");
    }

  }
}

function verPerfil(uid = auth.currentUser?.uid){

  document.getElementById("btnCambiarFoto").style.display = "none";

  const user = auth.currentUser;
  if (!user || !uid) return;

  // limpiar listeners anteriores
 if (typeof unsubscribePerfil === "function") unsubscribePerfil();
if (typeof unsubscribeUser === "function") unsubscribeUser();

  mostrar("perfil");

  // guardar uid activo
  const perfilEl = document.getElementById("perfil");
  if (perfilEl) perfilEl.dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");
  configurarBotonChatPrivadoPerfil(uid);

  // control botones
  if (editarBtn) editarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (eliminarBtn) eliminarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (btnSeguir) {
    btnSeguir.style.display = (user.uid !== uid) ? "block" : "none";
    btnSeguir.onclick = toggleSeguir;
  }

  if (btnSeguir && user.uid !== uid) {
  db.collection("usuarios").doc(user.uid).get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];

    if (siguiendo.includes(uid)) {
      btnSeguir.innerText = "Dejar de seguir";
      btnSeguir.classList.remove("btnSeguir");
      btnSeguir.classList.add("btnSiguiendo");
    } else {
      btnSeguir.innerText = "Seguir";
      btnSeguir.classList.remove("btnSiguiendo");
      btnSeguir.classList.add("btnSeguir");
    }

  });
}

  // LISTENER PERFIL
  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

if (!doc.exists) {
  console.log("NO EXISTE DOC");
  return;
}

const data = doc.data();
console.log("DATA:", data);

    renderizarDatosVisualesPerfil(data, { usarFallbackSexo: true });
    console.log("FOTO PERFIL:", data.fotoPerfil);

  });

  // LISTENER USUARIO (estado seguir)
  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    if (!miDoc.exists) return;

    const perfilActual = document.getElementById("perfil").dataset.uid;
    if (!perfilActual) return;

    if (perfilActual === user.uid) {
      if (btnSeguir) {
        btnSeguir.style.display = "none";
        btnSeguir.onclick = null;
      }
      return;
    }

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(perfilActual);

    if (btnSeguir) {
      btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
      btnSeguir.classList.toggle("btnYellow", !sigo);
    }

  });

}

function editarPerfil(){

  if (typeof unsubscribePerfil === "function") unsubscribePerfil();


  const user = auth.currentUser;
  if (!user) return;

  const imgEditar = document.getElementById("fotoPerfilEditar");

if (imgEditar && auth.currentUser) {
  db.collection("usuarios").doc(auth.currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();

      let defaultImg = data.sexo === "mujer"
        ? "imagen/mujer.jpeg"
        : "imagen/hombre.jpeg";

      imgEditar.src = (data.fotoPerfil || defaultImg) + "?t=" + Date.now();
    }
  });
}

  mostrar("perfilEditar");

  const manoEl = document.getElementById("mano");
  const posicionEl = document.getElementById("posicion");

  if (manoEl) manoEl.disabled = false;
  if (posicionEl) posicionEl.disabled = false;

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "block";

  // ESCUCHA EN TIEMPO REAL (igual que perfil)
  db.collection("usuarios").doc(user.uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      const foto = document.getElementById("fotoPerfilEditar");
      if (foto) foto.src = data.fotoPerfil || "imagen/hombre.jpeg";

      if (manoEl) manoEl.value = data.mano || "";
      if (posicionEl) posicionEl.value = data.posicion || "";

    });

}


function toggleSeguir(){

 

  const btnSeguir = document.getElementById("btnSeguir");
  if (btnSeguir) btnSeguir.disabled = true;

  const user = auth.currentUser;
  if (!user) return;

  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  return miRef.get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(uid);

    if (btnSeguir) {
  if (!sigo) {
  // vas a empezar a seguir
  btnSeguir.innerText = "Dejar de seguir";
  btnSeguir.classList.remove("btnSeguir");
  btnSeguir.classList.add("btnSiguiendo");
} else {
  // vas a dejar de seguir
  btnSeguir.innerText = "Seguir";
  btnSeguir.classList.remove("btnSiguiendo");
  btnSeguir.classList.add("btnSeguir");
}
}

    if (sigo) {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      ]);

    } else {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      ]);

    }

  }).finally(() => {
    if (btnSeguir) btnSeguir.disabled = false;
  });

}

function guardarPerfil(){

  console.log("CLICK GUARDAR");

  const user = auth.currentUser;
  if (!user) return;

  const manoEl = document.getElementById("manoEditar");
  const posicionEl = document.getElementById("posicionEditar");

  if (!manoEl || !posicionEl) return;

  const mano = manoEl.value;
  const posicion = posicionEl.value;

  if (!mano || !posicion) return;

  db.collection("usuarios").doc(user.uid).update({
    mano: mano,
    posicion: posicion
  })
  .then(() => {

    mostrar("perfil");

  })
  .catch(err => {
    console.error(err);
  });

}


function cargarPerfil(uid){

  unsubscribePerfil && unsubscribePerfil();
  configurarBotonChatPrivadoPerfil(uid);

  const user = auth.currentUser;
  const esPerfilPropio = !!(user && uid === user.uid);
  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  if (btnSeguir) {
    btnSeguir.style.display = esPerfilPropio ? "none" : "block";
    btnSeguir.onclick = esPerfilPropio ? null : toggleSeguir;
  }
  if (editarBtn) editarBtn.style.display = esPerfilPropio ? "block" : "none";
  if (eliminarBtn) eliminarBtn.style.display = esPerfilPropio ? "block" : "none";

  unsubscribePerfil = db.collection("usuarios")
    .doc(uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      renderizarDatosVisualesPerfil(data, {
        actualizarStats: document.getElementById("perfil").style.display === "block"
      });

    });
}


function irPerfil(){
  const user = auth.currentUser;
  if (!user) return;

  mostrar("perfil");
  cargarPerfil(user.uid);
}
