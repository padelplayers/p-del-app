window.modoSeleccionPista = false;
window.partidaCreando = {};

window.subirImagen = async function(ruta, archivo) {

  const ref = firebase.storage().ref().child(ruta);

  await ref.put(archivo);

  const url = await ref.getDownloadURL();

  return url;
}

let avisoNivelMostrado = false;



function mostrarAvisoNivel(){
  if (!avisoNivelMostrado) {
    avisoNivelMostrado = true;
    alert("Elige bien tu nivel. No podrás cambiarlo después.");
    return true;
  }
  return false;
}

let archivo = null;
let otroUid = null;

let esAdmin = false;

let unsubscribePistas = null;
let presenciaInterval = null;
let presenciaUidActual = null;
let presenciaEventosRegistrados = false;

const PRESENCIA_HEARTBEAT_MS = 30000;


// FUNCIONES GLOBALES

window.subirImagen = async function(ruta, archivo) {

  const ref = firebase.storage().ref().child(ruta);

  await ref.put(archivo);

  const url = await ref.getDownloadURL();

  return url;
}

async function borrarImagen(url) {

  if (!url) return;

  try {
    const ref = firebase.storage().refFromURL(url);
    await ref.delete();
  } catch (e) {
    console.log("No se pudo borrar");
  }

}


auth.onAuthStateChanged(async user => {
  if (user) {

    const doc = await db.collection("usuarios").doc(user.uid).get();
    const data = doc.data();

    esAdmin = data && data.rol === "admin";

    mostrar("menu");

  } else {
    mostrar("login");
  }
});

function normalizarTexto(texto){
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function actualizarPresenciaUsuario(uid, online) {
  if (!uid) return;

  try {
    await db.collection("usuarios").doc(uid).set({
      online: online,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    throw error;
  }
}

function registrarEventosPresenciaAvanzada() {
  if (presenciaEventosRegistrados) return;
  presenciaEventosRegistrados = true;

  window.addEventListener("pagehide", function() {
    const user = auth.currentUser;
    if (user) actualizarPresenciaUsuario(user.uid, false).catch(function() {});
  });

  window.addEventListener("beforeunload", function() {
    const user = auth.currentUser;
    if (user) actualizarPresenciaUsuario(user.uid, false).catch(function() {});
  });

  document.addEventListener("visibilitychange", function() {
    const user = auth.currentUser;
    if (!user) return;

    if (document.visibilityState === "visible") {
      iniciarPresenciaAvanzada(user.uid);
    }
  });
}

function detenerPresenciaAvanzada(uid, marcarOffline) {
  if (presenciaInterval) {
    clearInterval(presenciaInterval);
    presenciaInterval = null;
  }

  const uidSalida = uid || presenciaUidActual;
  presenciaUidActual = null;

  if (marcarOffline && uidSalida) {
    return actualizarPresenciaUsuario(uidSalida, false);
  }

  return Promise.resolve();
}

function iniciarPresenciaAvanzada(uid) {
  if (!uid) return Promise.resolve();

  registrarEventosPresenciaAvanzada();
  presenciaUidActual = uid;

  if (presenciaInterval) clearInterval(presenciaInterval);

  presenciaInterval = setInterval(function() {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      detenerPresenciaAvanzada(null, false);
      return;
    }

    actualizarPresenciaUsuario(uid, true).catch(function(error) {
      console.warn("No se pudo renovar presencia:", error.message);
    });
  }, PRESENCIA_HEARTBEAT_MS);

  return actualizarPresenciaUsuario(uid, true);
}

function recuperarPassword() {
  const email = document.getElementById("email").value.trim();

  if (!email) {
   alert("Introduce tu email");
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      alert("Te hemos enviado un correo para restablecer la contraseña. Revisa tu bandeja de entrada o spam");
    })
    .catch((error) => {
      console.log(error);
      alert(error.code);
    });
}

function registro(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

const checkEdad = document.getElementById("checkEdad");

if (!checkEdad || !checkEdad.checked) {
  alert("Debes ser mayor de 14 años");
  return;
}

auth.createUserWithEmailAndPassword(email, pass)
  .then(user => {
    console.log("REGISTRO OK", user);
  })
  .catch(e => {
    console.log("ERROR REGISTRO", e);
    alert(e.message);
  });

}


// REGISTRO PERFIL

async function guardarPerfilRegistro(){

  const nombre = document.getElementById("nombre").value.trim();
  const sexo = document.getElementById("sexo").value;
  const nivel = document.getElementById("nivelManual").value;
  const mano = document.getElementById("mano").value;
  const posicion = document.getElementById("posicion").value;

  const inputFoto = document.getElementById("inputFotoRegistro");
  const archivo = inputFoto ? inputFoto.files[0] : null;

  if (!nombre || !mano || !posicion) {
    document.getElementById("msgPerfil").innerText = "Completa los campos";
    return;
  }

  if (!nivel) {
    document.getElementById("msgPerfil").innerText = "Debes elegir o calcular tu nivel";
    return;
  }

  // BLOQUEO NOMBRE DUPLICADO
  const nombreNormalizado = normalizarTexto(nombre);

  const snapshot = await db.collection("usuarios")
    .where("nombreNormalizado", "==", nombreNormalizado)
    .get();

  if (!snapshot.empty) {
    document.getElementById("msgPerfil").innerText = "Nombre ya en uso";
    return;
  }

  let fotoURL = sexo === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg";

  if (archivo) {
    const ruta = "usuarios/" + auth.currentUser.uid + "/foto_" + Date.now() + ".jpg";

    subirImagen(ruta, archivo).then(url => {
      db.collection("usuarios").doc(auth.currentUser.uid).update({
        fotoPerfil: url
      });
    });
  }

  const userRef = db.collection("usuarios").doc(auth.currentUser.uid);
  const userDoc = await userRef.get();
  const datosUsuarioExistente = userDoc.exists ? (userDoc.data() || {}) : {};
  const datosPerfil = {
    nombre: nombre,
    nombreNormalizado: nombreNormalizado,
    email: auth.currentUser.email,
    sexo: sexo,
    nivel: nivel,
    mano: mano,
    posicion: posicion,
    fotoPerfil: fotoURL,

    // estructura base obligatoria
    partidos: 0,
    seguidores: [],
    siguiendo: [],
    admin: false,
    online: true,
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()

  };

  if (!datosUsuarioExistente.fechaAlta) {
    datosPerfil.fechaAlta = firebase.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(datosPerfil, { merge: true });
  await iniciarPresenciaAvanzada(auth.currentUser.uid);

  await userRef.collection("chatLeidos").doc("general").set({
    lastReadAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    tipo: "general",
    titulo: "General"
  }, { merge: true });

  mostrar("menu");
}


// ======================

function login(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

auth.signInWithEmailAndPassword(email, pass)
  .then(async cred => {
    const uid = cred && cred.user ? cred.user.uid : auth.currentUser?.uid;
    if (uid) {
      try {
        await actualizarPresenciaUsuario(uid, true);
      } catch (error) {
      }
    }
    console.log("LOGIN OK", cred);
  })
  .catch(e => {
    console.log("ERROR LOGIN", e);
    alert(e.message);
  });

}

async function logout(){
  if (typeof window.limpiarTodoChat === "function") {
    window.limpiarTodoChat();
  }

  const user = auth.currentUser;
  if (user) {
    const uid = user.uid;
    try {
      await detenerPresenciaAvanzada(uid, true);
    } catch (error) {
      console.warn("No se pudo marcar usuario offline:", error.message);
    }
  }

  auth.signOut();
}

auth.onAuthStateChanged(async user => {

  if (user) {

    const doc = await db.collection("usuarios").doc(user.uid).get();

    if (doc.exists) {

      const data = doc.data();
      esAdmin = data && (data.admin === true || data.rol === "admin");

      try {
        await iniciarPresenciaAvanzada(user.uid);
      } catch (error) {
        throw error;
      }

      document.getElementById("saludo").innerText =
        "Hola " + (data.nombre || "");

      document.getElementById("seguidores").innerText =
        Array.isArray(data.seguidores) ? data.seguidores.length : 0;

      document.getElementById("seguidos").innerText =
        Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

      if (typeof window.iniciarListenersChatsPartidas === "function") {
        window.iniciarListenersChatsPartidas(user.uid);
      }

      if (typeof window.escucharNotificaciones === "function") {
        window.escucharNotificaciones(user.uid);
      }

      if (typeof window.mostrarAvisoPwaSiProcede === "function") {
        window.mostrarAvisoPwaSiProcede();
      }

      mostrar("menu");

    } else {
      esAdmin = false;
      avisoNivelMostrado = false;
      mostrar("perfilCompletar");
    }

    return;
  }

  esAdmin = false;
  detenerPresenciaAvanzada(null, false);
  if (typeof window.limpiarTodoChat === "function") {
    window.limpiarTodoChat();
  }
  if (typeof window.limpiarListenersChat === "function") {
    window.limpiarListenersChat();
  }
  if (typeof window.detenerNotificacionesInternas === "function") {
    window.detenerNotificacionesInternas();
  }
  mostrar("login");

});

function cambiarFoto(){
  document.getElementById("inputFotoEditar").click();
}

const inputFotoGlobal = document.getElementById("inputFotoEditar");

if (inputFotoGlobal) {
  inputFotoGlobal.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    const previewURL = URL.createObjectURL(file);

    const imgEditar = document.getElementById("fotoPerfilEditar");
    if (imgEditar) imgEditar.src = previewURL;

    const imgPerfil = document.getElementById("fotoPerfil");
    if (imgPerfil) imgPerfil.src = previewURL;

    try {
      const docRef = db.collection("usuarios").doc(user.uid);
      const doc = await docRef.get();
      const data = doc.data();
    
      if (data && data.fotoPerfil && data.fotoPerfil.includes("firebasestorage")) {
        await borrarImagen(data.fotoPerfil);
      }

      const ruta = "usuarios/" + user.uid + "/foto_" + Date.now() + ".jpg";
      const url = await subirImagen(ruta, file);

      await docRef.update({
        fotoPerfil: url
      });
    } finally {
      URL.revokeObjectURL(previewURL);
    }

  });
}

function togglePass(){
  const input = document.getElementById("pass");
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}



// ======================

function crearTextoClasificacion(texto, className) {
  const el = document.createElement("div");

  if (className) {
    el.className = className;
  }

  el.textContent = texto;

  return el;
}

function formatearMediaClasificacion(total, valoracionesRecibidas) {
  if (!valoracionesRecibidas || valoracionesRecibidas <= 0) return "-";
  const media = Number(total || 0) / valoracionesRecibidas;
  return media.toFixed(1);
}

function obtenerFotoClasificacion(data) {
  if (data.fotoPerfil) return data.fotoPerfil;

  const sexo = String(data.sexo || "").toLowerCase().trim();
  if (sexo === "femenino" || sexo === "mujer") return "imagen/mujer.jpeg";
  return "imagen/hombre.jpeg";
}

function crearEstrellasClasificacion(valor) {
  const contenedor = document.createElement("span");
  contenedor.className = "clasificacionEstrellas";

  const numero = Number(valor);
  const media = isNaN(numero) ? 0 : numero;

  for (let i = 1; i <= 5; i++) {
    const estrella = document.createElement("span");
    estrella.className = "clasificacionEstrella";

    if (media >= i) {
      estrella.textContent = "★";
      estrella.classList.add("llena");
    } else if (media >= i - 0.5) {
      estrella.textContent = "★";
      estrella.classList.add("media");
    } else {
      estrella.textContent = "★";
      estrella.classList.add("vacia");
    }

    contenedor.appendChild(estrella);
  }

  return contenedor;
}

function crearFilaValoracionClasificacion(nombre, valor) {
  const fila = document.createElement("div");
  fila.className = "clasificacionValoracion";

  const etiqueta = crearTextoClasificacion(nombre, "clasificacionValoracionNombre");
  const estrellas = crearEstrellasClasificacion(valor);
  const numero = crearTextoClasificacion(valor, "clasificacionValoracionNumero");

  fila.appendChild(etiqueta);
  fila.appendChild(estrellas);
  fila.appendChild(numero);

  return fila;
}

function crearCardClasificacion(jugador, posicion) {
  const card = document.createElement("div");
  card.className = "clasificacionCard";

  const pos = crearTextoClasificacion(String(posicion), "clasificacionPos");

  const foto = document.createElement("img");
  foto.className = "clasificacionFoto";
  foto.src = jugador.foto;
  foto.alt = jugador.nombre;

  const info = document.createElement("div");
  info.className = "clasificacionInfo";

  const nombre = crearTextoClasificacion(jugador.nombre, "clasificacionNombre");

  const reputacion = crearTextoClasificacion(
    "Reputación: " + jugador.puntos + " pts",
    "clasificacionReputacion"
  );

  const partidos = crearTextoClasificacion(
    jugador.partidos + " partidos",
    "clasificacionPartidos"
  );

  info.appendChild(nombre);
  info.appendChild(reputacion);
  info.appendChild(partidos);

  const stats = document.createElement("div");
  stats.className = "clasificacionStats";

  stats.appendChild(
    crearFilaValoracionClasificacion("Puntualidad", jugador.mediaPuntualidad)
  );

  stats.appendChild(
    crearFilaValoracionClasificacion("Actitud", jugador.mediaActitud)
  );

  stats.appendChild(
    crearFilaValoracionClasificacion("Compromiso", jugador.mediaCompromiso)
  );

  const datos = document.createElement("div");
  datos.className = "clasificacionDatos";

  datos.appendChild(
    crearTextoClasificacion("Fiabilidad: -", "clasificacionDato fiabilidad")
  );

  datos.appendChild(
    crearTextoClasificacion("Abandonos: -", "clasificacionDato abandonos")
  );

  datos.appendChild(
    crearTextoClasificacion("Penalizaciones activas: -", "clasificacionDato penalizaciones")
  );

  card.appendChild(pos);
  card.appendChild(foto);
  card.appendChild(info);
  card.appendChild(stats);
  card.appendChild(datos);

  return card;
}

function cargarClasificacionComunitaria() {
  const contenedor = document.getElementById("listaClasificacion");
  if (!contenedor) return;

  contenedor.replaceChildren(crearTextoClasificacion("Cargando..."));

  db.collection("usuarios").get()
    .then(function(snapshot) {
      const jugadores = [];

      snapshot.forEach(function(doc) {
        const data = doc.data() || {};
        const c = data.clasificacion || {};
        const puntos = Number(c.puntos || 0);
        const partidos = Number(c.partidos || 0);
        const valoracionesRecibidas = Number(c.valoracionesRecibidas || 0);
        const nombre = data.nombre || "Jugador";

        jugadores.push({
          uid: doc.id,
          nombre: nombre,
          nombreOrden: normalizarTexto(nombre),
          foto: obtenerFotoClasificacion(data),
          puntos: puntos,
          partidos: partidos,
          mediaPuntualidad: formatearMediaClasificacion(c.puntualidadTotal, valoracionesRecibidas),
          mediaActitud: formatearMediaClasificacion(c.actitudTotal, valoracionesRecibidas),
          mediaCompromiso: formatearMediaClasificacion(c.compromisoTotal, valoracionesRecibidas)
        });
      });

      jugadores.sort(function(a, b) {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.partidos !== a.partidos) return b.partidos - a.partidos;
        return a.nombreOrden.localeCompare(b.nombreOrden);
      });

      if (jugadores.length === 0) {
        contenedor.replaceChildren(crearTextoClasificacion("No hay jugadores"));
        return;
      }

      const fragment = document.createDocumentFragment();
      jugadores.forEach(function(jugador, index) {
        fragment.appendChild(crearCardClasificacion(jugador, index + 1));
      });

      contenedor.replaceChildren(fragment);
    })
    .catch(function(error) {
      console.error("Error cargando clasificación:", error);
      contenedor.replaceChildren(crearTextoClasificacion("No se pudo cargar la clasificación"));
    });
}

function mostrar(seccion){
  console.log("MOSTRAR:", seccion);
  const abriendoChat = seccion === "chat";
  const chatPantalla = document.getElementById("chat");
  const saliendoChat = !abriendoChat && (
    document.body.classList.contains("chatAbierto") ||
    (chatPantalla && chatPantalla.style.display !== "none")
  );

  if (saliendoChat && typeof window.limpiarListenersChat === "function") {
    window.limpiarListenersChat();
  }

  document.body.classList.toggle("chatAbierto", abriendoChat);
  if (chatPantalla) {
    chatPantalla.classList.toggle("chatFullscreen", abriendoChat);
  }

  if (abriendoChat && typeof window.notificarEntradaSeccionChat === "function") {
    window.notificarEntradaSeccionChat();
  }

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "none";

  const secciones = [
    "login",
    "menu",
    "perfilCompletar",
    "perfil",
    "perfilEditar",
    "jugadores",
    "pistas",
    "editarPista",
    "testNivel",
    "crearPista",
    "chat",
    "instrucciones",
    "partidas",
    "crearPartida",
    "buscarPartida",
    "clasificacion"
  ];

  secciones.forEach(function(id){
    const el = document.getElementById(id);
    if (el){
      el.style.display = "none";
    }
  });

  const actual = document.getElementById(seccion);
  if (actual){
    actual.style.display = "block";
  }

  if (abriendoChat && chatPantalla) {
    requestAnimationFrame(function() {
      const layout = chatPantalla.querySelector(".chatLayout");
      const main = chatPantalla.querySelector(".chatMain");
      const messages = chatPantalla.querySelector(".chatMessages");
      const composer = chatPantalla.querySelector(".chatComposer");

      
    });
  }

  if (seccion === "crearPartida") {

  const tipoNivel = document.getElementById("nivelTipo");
  const rango = document.getElementById("nivelRango");
  const desde = document.getElementById("nivelDesde");
  const hasta = document.getElementById("nivelHasta");

  // mostrar / ocultar rango
  if (tipoNivel && rango) {
    tipoNivel.onchange = function () {
      rango.style.display = this.value === "rango" ? "block" : "none";
    };
  }

  // generar niveles solo una vez
  if (desde && hasta && desde.options.length === 0) {

    const opcionDesde = document.createElement("option");
    opcionDesde.value = "";
    opcionDesde.textContent = "Desde";
    desde.appendChild(opcionDesde);
    let htmlDesde = '<option value="">Desde</option>';
    let htmlHasta = '<option value="">Hasta</option>';

    const opcionHasta = document.createElement("option");
    opcionHasta.value = "";
    opcionHasta.textContent = "Hasta";
    hasta.appendChild(opcionHasta);

    for (let i = 0.5; i <= 7; i += 0.25) {
      let val = Math.round(i * 100) / 100;
      const optDesde = document.createElement("option");
      optDesde.value = String(val);
      optDesde.textContent = String(val);
      desde.appendChild(optDesde);
      htmlDesde += '<option value="' + val + '">' + val + '</option>';
      htmlHasta += '<option value="' + val + '">' + val + '</option>';

      const optHasta = document.createElement("option");
      optHasta.value = String(val);
      optHasta.textContent = String(val);
      hasta.appendChild(optHasta);
    }
    desde.innerHTML = htmlDesde;
    hasta.innerHTML = htmlHasta;
  }

 }

if (seccion === "pistas"){
  cargarPistas();
}

if (seccion === "crearPartida") {
  initCrearPartida();
}

if (seccion === "partidas") {
  
if (!window.vieneDeBusqueda) {
  delete window.filtrosPartidas;
}

window.vieneDeBusqueda = false;

console.log("ENTRANDO EN PARTIDAS");
cambiarModoPartidas("proximas");
console.log("CAMBIAR MODO EJECUTADO");
}

if (seccion === "buscarPartida") {

  if (typeof window.resetearBusquedaPartidas === "function") {
    window.resetearBusquedaPartidas();
  } else {
    delete window.filtrosPartidas;
  }
}

if (seccion === "clasificacion") {
  cargarClasificacionComunitaria();
}

  const btnNueva = document.getElementById("btnNuevaPista");

if (btnNueva) {
  btnNueva.style.display = window.modoSeleccionPista ? "none" : "inline-block";
}
}

function abrirTest(){
  alert("Elige bien tu nivel. No podrás cambiarlo después.");
  
  ("testNivel");
}

