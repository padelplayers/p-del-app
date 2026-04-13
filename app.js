let archivo = null;
let otroUid = null;

let esAdmin = false;

let unsubscribePistas = null;

// ======================
// FUNCIONES GLOBALES
// ======================

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

// ======================

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

function registro(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

auth.createUserWithEmailAndPassword(email, pass)
  .then(user => {
    console.log("REGISTRO OK", user);
  })
  .catch(e => {
    console.log("ERROR REGISTRO", e);
    alert(e.message);
  });

}

// ======================
// REGISTRO PERFIL
// ======================
async function guardarPerfilRegistro(){

  const nombre = document.getElementById("nombre").value.trim().toLowerCase();
  const sexo = document.getElementById("sexo").value;
  const nivel = document.getElementById("nivelManual").value;
  const mano = document.getElementById("mano").value;
  const posicion = document.getElementById("posicion").value;

  const inputFoto = document.getElementById("inputFoto");
  const archivo = inputFoto ? inputFoto.files[0] : null;

  if (!nombre || !mano || !posicion) {
    document.getElementById("msgPerfil").innerText = "Completa los campos";
    return;
  }

  if (!nivel) {
    document.getElementById("msgPerfil").innerText = "Debes elegir o calcular tu nivel";
    return;
  }

  let fotoURL = sexo === "mujer"
    ? "imagen/mujer.jpeg"
    : "imagen/hombre.jpeg";

  if (archivo) {
    const ruta = "usuarios/" + auth.currentUser.uid + "/foto_" + Date.now() + ".jpg";
    fotoURL = await subirImagen(ruta, archivo);
  }

  await db.collection("usuarios").doc(auth.currentUser.uid).set({
    nombre: nombre,
    sexo: sexo,
    nivel: nivel,
    mano: mano,
    posicion: posicion,
    fotoPerfil: fotoURL
  });

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

const inputFotoGlobal = document.getElementById("inputFoto");
if (inputFotoGlobal) {

document.getElementById("inputFoto").addEventListener("change", async function(e){

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

// ======================

function mostrar(seccion){

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "none";

  document.getElementById("login").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("perfilCompletar").style.display = "none";
  document.getElementById("perfil").style.display = "none";
  document.getElementById("perfilEditar") && (document.getElementById("perfilEditar").style.display = "none");
  document.getElementById("jugadores").style.display = "none";
  document.getElementById("pistas") && (document.getElementById("pistas").style.display = "none");
  document.getElementById("testNivel") && (document.getElementById("testNivel").style.display = "none");
  document.getElementById("crearPista").style.display = "none";

  document.getElementById(seccion).style.display = "block";

  if (seccion === "crearPista") {
    cargarPistas();
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

// ======================
// PISTAS (SIN CAMBIOS)
// ======================

const btnNuevaPista = document.getElementById("btnNuevaPista");
const formPista = document.getElementById("formPista");
const btnGuardarPista = document.getElementById("guardarPista");

if (btnNuevaPista) {
  btnNuevaPista.onclick = () => {
    formPista.style.display = "block";
    document.getElementById("listaPistas").style.display = "none";
    document.getElementById("btnNuevaPista").style.display = "none";

    const btnVolver = document.getElementById("btnVolverPistas");
    if (btnVolver) btnVolver.style.display = "none";
  };
}

if (btnGuardarPista) {
  btnGuardarPista.onclick = async () => {

    try {

      const nombre = document.getElementById("nombrePista").value;
      const localidad = document.getElementById("localidadPista").value;

      const tipo = document.getElementById("tipoPista").value;
      const indoor = document.getElementById("indoor").value;
      const outdoor = document.getElementById("outdoor").value;

      const precioManana = Number(document.getElementById("precioManana").value);
      const precioTarde = Number(document.getElementById("precioTarde").value);
      const precioFestivo = Number(document.getElementById("precioFestivo").value);

      const lat = document.getElementById("lat").value;
      const lng = document.getElementById("lng").value;
      const reserva = document.getElementById("reserva").value;

      let urlImagen = "";

      const inputFotoPista = document.getElementById("inputFotoPista");

      if (inputFotoPista.files.length > 0) {
        const file = inputFotoPista.files[0];
        const ruta = "pistas/" + Date.now() + ".jpg";
        urlImagen = await subirImagen(ruta, file);
      }

      if (!urlImagen && window.pistaEditando) {
        const doc = await db.collection("pistas").doc(window.pistaEditando).get();
        const dataActual = doc.data();
        urlImagen = dataActual.imagen || "";
      }

      if (
        !nombre.trim() ||
        !localidad ||
        !tipo ||
        indoor === "" ||
        outdoor === "" ||
        isNaN(precioManana) ||
        isNaN(precioTarde) ||
        isNaN(precioFestivo) ||
        !lat ||
        !lng ||
        !reserva
      ) {
        alert("Todos los campos son obligatorios");
        return;
      }

      const nombreNorm = normalizarTexto(nombre);
      const localidadNorm = normalizarTexto(localidad);

      const snapshot = await db.collection("pistas").get();

      let existe = false;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (
          data.nombreNorm === nombreNorm &&
          data.localidadNorm === localidadNorm
        ) {
          existe = true;
        }
      });

      if (existe && !window.pistaEditando) {
        alert("Esta pista ya existe");
        return;
      }

      const datos = {
        nombre: nombre,
        nombreNorm: nombreNorm,
        localidad: localidad,
        localidadNorm: localidadNorm,
        direccion: document.getElementById("direccionPista").value,
        tipo: tipo,
        indoor: Number(indoor),
        outdoor: Number(outdoor),
        precioManana: precioManana,
        precioTarde: precioTarde,
        precioFestivo: precioFestivo,
        lat: Number(lat),
        lng: Number(lng),
        reserva: reserva,
        creadaPor: auth.currentUser.uid
      };

      if (urlImagen) {
        datos.imagen = urlImagen;
      }

      datos.verificada = esAdmin === true;

      if (window.pistaEditando) {
        await db.collection("pistas").doc(window.pistaEditando).update({
          ...datos,
          verificada: true
        });
        window.pistaEditando = null;
      } else {
        await db.collection("pistas").add({
          ...datos,
          verificada: esAdmin === true
        });
      }

      alert("Pista guardada");
      cargarPistas();

    } catch (error) {
      console.error("ERROR REAL:", error);
    }

  };
}