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
let revisionCancelaciones5hSesionUid = null;

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

    if (typeof window.asegurarRestriccionFiabilidadUsuario === "function") {
      await window.asegurarRestriccionFiabilidadUsuario(user.uid, data || {}).catch(function(error) {
        console.warn("No se pudo revisar la restriccion por fiabilidad:", error.message);
      });
    }

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
  alert("Debes confirmar que eres mayor de 16 años y que aceptas la Política de Privacidad y los Términos y Condiciones.");
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

      if (
        revisionCancelaciones5hSesionUid !== user.uid &&
        typeof window.revisarLimitesCancelacionClubPartidas === "function"
      ) {
        revisionCancelaciones5hSesionUid = user.uid;
        window.revisarLimitesCancelacionClubPartidas();
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
  revisionCancelaciones5hSesionUid = null;
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

function crearDatoIconoClasificacion(src, texto, valor, className) {
  const fila = document.createElement("div");
  fila.className = "clasificacionDatoIconoFila " + className;

  const icono = document.createElement("img");
  icono.className = "clasificacionDatoIcono";
  icono.src = src;
  icono.alt = texto;

  const contenido = document.createElement("span");
  contenido.className = "clasificacionDatoTexto";
  contenido.textContent = texto + ": " + valor;

  fila.appendChild(icono);
  fila.appendChild(contenido);

  return fila;
}

function crearCardClasificacion(jugador, posicion) {
  const card = document.createElement("div");
  card.className = "clasificacionCard";

  const puesto = document.createElement("div");
  puesto.className = "clasificacionPuesto";

  if (posicion === 1 || posicion === 2 || posicion === 3) {
    const logoTop = document.createElement("img");
    logoTop.className = "clasificacionLogoTop";

    if (posicion === 1) {
      logoTop.src = "logo-oro.png";
    } else if (posicion === 2) {
      logoTop.src = "logo-plata.png";
    } else {
      logoTop.src = "logo-bronce.png";
    }

    logoTop.alt = "Puesto " + posicion;
    puesto.appendChild(logoTop);
  }

  const pos = crearTextoClasificacion(String(posicion), "clasificacionPos");
  puesto.appendChild(pos);

  const foto = document.createElement("img");
  foto.className = "clasificacionFoto";
  foto.src = jugador.foto;
  foto.alt = jugador.nombre;

  const info = document.createElement("div");
  info.className = "clasificacionInfo";

  const nombre = crearTextoClasificacion(jugador.nombre, "clasificacionNombre");

  const reputacion = document.createElement("div");
  reputacion.className = "clasificacionInfoFila";
  reputacion.appendChild(crearTextoClasificacion("Reputación:", "clasificacionInfoEtiqueta"));
  reputacion.appendChild(crearTextoClasificacion(jugador.puntos + " pts", "clasificacionInfoValor"));

  const partidos = document.createElement("div");
  partidos.className = "clasificacionInfoFila";
  partidos.appendChild(crearTextoClasificacion("Partidos:", "clasificacionInfoEtiqueta"));
  partidos.appendChild(crearTextoClasificacion(String(jugador.partidos), "clasificacionInfoValor"));

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
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/fiabilidad.png",
      "Fiabilidad",
      jugador.fiabilidad + "%",
      "fiabilidad"
    )
  );

  datos.appendChild(
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/abandono.png",
      "Abandonos",
      String(jugador.abandonos),
      "abandonos"
    )
  );

  datos.appendChild(
    crearDatoIconoClasificacion(
      "imagenes app/clasificacion/penalizacion.png",
      "Penalizaciones activas",
      String(jugador.penalizacionesActivas),
      "penalizaciones"
    )
  );

  card.appendChild(puesto);
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
      const recalculosPendientes = [];

      snapshot.forEach(function(doc) {
        const data = doc.data() || {};
        const c = data.clasificacion || {};
        const puntos = Number(c.puntos || 0);
        const partidos = Number(c.partidos || 0);
        const valoracionesRecibidas = Number(c.valoracionesRecibidas || 0);
        const abandonos = Number(c.abandonos || 0);
        const resumenPenalizaciones = resumenPenalizacionesFiabilidad(data.penalizaciones || []);
        const penalizacionesActivas = resumenPenalizaciones.penalizacionesActivas;
        const fiabilidad = resumenPenalizaciones.fiabilidad;
        const fiabilidadGuardada = c.fiabilidad === undefined || c.fiabilidad === null
          ? 100
          : Number(c.fiabilidad);
        const nombre = data.nombre || "Jugador";

        if (
          Number(c.penalizacionesActivas || 0) !== penalizacionesActivas ||
          fiabilidadGuardada !== fiabilidad
        ) {
          recalculosPendientes.push(doc.ref.update({
            "clasificacion.penalizacionesActivas": penalizacionesActivas,
            "clasificacion.fiabilidad": fiabilidad
          }).catch(function(error) {
            console.warn("No se pudo recalcular la fiabilidad de " + doc.id + ":", error.message);
          }));
        }

        jugadores.push({
          uid: doc.id,
          nombre: nombre,
          nombreOrden: normalizarTexto(nombre),
          foto: obtenerFotoClasificacion(data),
          puntos: puntos,
          partidos: partidos,
          abandonos: abandonos,
          penalizacionesActivas: penalizacionesActivas,
          fiabilidad: fiabilidad,
          mediaPuntualidad: formatearMediaClasificacion(c.puntualidadTotal, valoracionesRecibidas),
          mediaActitud: formatearMediaClasificacion(c.actitudTotal, valoracionesRecibidas),
          mediaCompromiso: formatearMediaClasificacion(c.compromisoTotal, valoracionesRecibidas)
        });
      });

      if (recalculosPendientes.length > 0) {
        Promise.all(recalculosPendientes).catch(function(error) {
          console.warn("No se pudieron guardar todos los recalculos de fiabilidad:", error.message);
        });
      }

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

if (seccion === "instrucciones") {
  cargarGuiaUso();
}

  const btnNueva = document.getElementById("btnNuevaPista");

if (btnNueva) {
  btnNueva.style.display = window.modoSeleccionPista ? "none" : "inline-block";
}
}

const documentosGuiaUso = [
  {
    titulo: "Cómo funcionan las partidas",
    archivo: "guia%20de%20uso/1.Partidas.txt"
  },
  {
    titulo: "Reservas y sustituciones",
    archivo: "guia%20de%20uso/2.Reservas_y_Sustituciones.txt"
  },
  {
    titulo: "Partidas amistosas",
    archivo: "guia%20de%20uso/3.Partidas_Amistosas.txt"
  },
  {
    titulo: "Partidas ranking",
    archivo: "guia%20de%20uso/4.Partidas_Ranking.txt"
  },
  {
    titulo: "Incidencia de no presentado",
    archivo: "guia%20de%20uso/5.Incidencia_No_Presentado.txt"
  },
  {
    titulo: "Reputación y clasificación",
    archivo: "guia%20de%20uso/6.Reputacion_y_Clasificacion.txt"
  },
  {
    titulo: "Penalizaciones y fiabilidad",
    archivo: "guia%20de%20uso/7.Penalizaciones_y_Fiabilidad.txt"
  },
  {
    titulo: "Chat",
    archivo: "guia%20de%20uso/8.Chat.txt"
  },
  {
    titulo: "Logros",
    archivo: "guia%20de%20uso/9.Logros.txt"
  },
  {
    titulo: "Pistas",
    archivo: "guia%20de%20uso/10.Pistas.txt"
  },
  {
    titulo: "Contacto y sugerencias",
    archivo: "guia%20de%20uso/11.Contacto_y_Sugerencias.txt"
  },
  {
    titulo: "Notificaciones",
    archivo: "guia%20de%20uso/12.Notificaciones.txt"
  },
  {
    titulo: "Aviso Legal, Términos y Condiciones de Uso y Política de Privacidad",
    archivo: "guia%20de%20uso/13.Aviso_Legal_Terminos_Condiciones_y_Privacidad.txt"
  }
];

let guiaUsoBloquePendiente = null;

function cargarGuiaUso() {
  const contenedor = document.getElementById("guiaUsoLista");
  if (!contenedor) return;

  contenedor.textContent = "Cargando Guía de Uso...";

  Promise.all(documentosGuiaUso.map(function(documento) {
    return fetch(documento.archivo, { cache: "no-cache" })
      .then(function(respuesta) {
        if (!respuesta.ok) {
          throw new Error("No se pudo cargar " + documento.archivo);
        }
        return respuesta.text();
      })
      .then(function(texto) {
        return {
          titulo: documento.titulo,
          texto: texto
        };
      });
  }))
    .then(function(documentos) {
      const fragment = document.createDocumentFragment();

      documentos.forEach(function(documento, indice) {
        const abierto = indice === 0;
        const bloque = document.createElement("section");
        bloque.className = abierto ? "guiaUsoBloque abierto" : "guiaUsoBloque";
        bloque.dataset.guiaUsoIndice = String(indice);

        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "guiaUsoTitulo";
        boton.setAttribute("aria-expanded", abierto ? "true" : "false");

        const flecha = document.createElement("span");
        flecha.className = "guiaUsoFlecha";
        flecha.textContent = abierto ? "▼" : "▶";

        const titulo = document.createElement("span");
        titulo.textContent = documento.titulo;

        const contenido = document.createElement("div");
        contenido.className = "guiaUsoContenido";
        contenido.appendChild(formatearContenidoGuiaUso(documento.texto));

        boton.append(flecha, titulo);
        boton.addEventListener("click", function() {
          alternarBloqueGuiaUso(bloque, boton, flecha);
        });

        bloque.append(boton, contenido);
        fragment.appendChild(bloque);
      });

      contenedor.replaceChildren(fragment);

      if (guiaUsoBloquePendiente !== null) {
        abrirBloqueGuiaUsoPorIndice(guiaUsoBloquePendiente);
        guiaUsoBloquePendiente = null;
      }
    })
    .catch(function(error) {
      console.error("Error cargando Guía de Uso:", error);
      contenedor.textContent = "No se pudo cargar la Guía de Uso.";
    });
}

function alternarBloqueGuiaUso(bloque, boton, flecha) {
  const abierto = bloque.classList.toggle("abierto");
  boton.setAttribute("aria-expanded", abierto ? "true" : "false");
  flecha.textContent = abierto ? "▼" : "▶";
}

function abrirAvisoLegalGuiaUso(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  guiaUsoBloquePendiente = 12;
  mostrar("instrucciones");
}

function abrirBloqueGuiaUsoPorIndice(indice) {
  const bloques = document.querySelectorAll("#guiaUsoLista .guiaUsoBloque");
  let bloqueDestino = null;

  bloques.forEach(function(bloque) {
    const esDestino = Number(bloque.dataset.guiaUsoIndice) === indice;
    const boton = bloque.querySelector(".guiaUsoTitulo");
    const flecha = bloque.querySelector(".guiaUsoFlecha");

    bloque.classList.toggle("abierto", esDestino);

    if (boton) {
      boton.setAttribute("aria-expanded", esDestino ? "true" : "false");
    }

    if (flecha) {
      flecha.textContent = esDestino ? "▼" : "▶";
    }

    if (esDestino) {
      bloqueDestino = bloque;
    }
  });

  if (bloqueDestino) {
    setTimeout(function() {
      bloqueDestino.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}

function formatearContenidoGuiaUso(texto) {
  const fragment = document.createDocumentFragment();
  const lineas = texto.split(/\r?\n/);
  let tituloPrincipalAplicado = false;

  lineas.forEach(function(linea) {
    const elemento = document.createElement("div");
    const textoLinea = linea.trim();

    if (!textoLinea) {
      elemento.className = "guiaUsoLineaVacia";
    } else if (!tituloPrincipalAplicado) {
      elemento.className = "guiaUsoTituloPrincipal";
      elemento.textContent = linea;
      tituloPrincipalAplicado = true;
    } else if (/^\d+\.\s+/.test(textoLinea)) {
      elemento.className = "guiaUsoApartado";
      elemento.textContent = linea;
    } else if (esBloqueEspecialGuiaUso(textoLinea)) {
      elemento.className = "guiaUsoBloqueEspecial";
      elemento.textContent = linea;
    } else {
      elemento.className = "guiaUsoTexto";
      elemento.textContent = linea;
    }

    fragment.appendChild(elemento);
  });

  return fragment;
}

function esBloqueEspecialGuiaUso(texto) {
  if (texto.length > 60) return false;
  if (/^\d+\./.test(texto)) return false;
  return texto === texto.toUpperCase() && /[A-ZÁÉÍÓÚÜÑ]/.test(texto);
}

function abrirTest(){
  alert("Elige bien tu nivel. No podrás cambiarlo después.");
  
  ("testNivel");
}

