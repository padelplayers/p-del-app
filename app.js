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

  await db.collection("usuarios").doc(auth.currentUser.uid).set({
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
    admin: false

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
  .then(user => {
    console.log("LOGIN OK", user);
  })
  .catch(e => {
    console.log("ERROR LOGIN", e);
    alert(e.message);
  });

}

function logout(){
auth.signOut();
}

auth.onAuthStateChanged(user => {

  if (user) {

    db.collection("usuarios").doc(user.uid).get()
    .then(doc => {

      if (doc.exists) {

        const data = doc.data();

        document.getElementById("saludo").innerText =
          "Hola " + data.nombre;

        document.getElementById("seguidores").innerText =
          Array.isArray(data.seguidores) ? data.seguidores.length : 0;

        document.getElementById("seguidos").innerText =
          Array.isArray(data.siguiendo) ? data.siguiendo.length : 0;

        mostrar("menu");

      } else {
        avisoNivelMostrado = false;
        mostrar("perfilCompletar");
      }

    });

    return;
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

function mostrar(seccion){
  console.log("MOSTRAR:", seccion);

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
    "mediaCenter",
    "instrucciones",
    "partidas",
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

 if (seccion === "pistas"){
  cargarPistas();
}

  if (seccion === "partidas"){
    setTimeout(function(){
      cargarPistasParaPartida();
    }, 100); // ← cambio aquí
  }

  const btnNueva = document.getElementById("btnNuevaPista");

if (btnNueva) {
  btnNueva.style.display = window.modoSeleccionPista ? "none" : "inline-block";
}
}

function abrirTest(){
  alert("Elige bien tu nivel. No podrás cambiarlo después.");
  mostrar("testNivel");
}

function crearPartida(jugadores) {
  return db.collection("partidas").add({
    jugadores: jugadores,
    resultado: null,
    fecha: new Date()
  });
}