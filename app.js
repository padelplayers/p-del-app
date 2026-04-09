let archivo = null;
let otroUid = null;

let unsubscribePistas = null;


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

auth.createUserWithEmailAndPassword(email,pass)
.then(()=>{
alert("Usuario creado");
})
.catch(e=>{
alert(e.message);
});

}

function guardarPerfilRegistro(){

  console.log("CLICK GUARDAR PERFIL");


  document.getElementById("msgPerfil").innerText = "";

  const user = auth.currentUser;

  if(!user){
    document.getElementById("msgPerfil").innerText = "Error de sesión";
    return;
  }

  

  const nombre = document.getElementById("nombre").value.trim().toLowerCase();
  const sexo = document.getElementById("sexo").value;
  const nivel = document.getElementById("nivelManual").value;

  const mano = document.getElementById("mano").value;
  const posicion = document.getElementById("posicion").value;

 if(!nombre || !mano || !posicion){
  document.getElementById("msgPerfil").innerText = "Completa los campos";
  return;
}

if(!nivel){
  document.getElementById("msgPerfil").innerText = "Debes elegir o calcular tu nivel";
  return;
}

  db.collection("usuarios")
    .where("nombre", "==", nombre)
    .get()
    .then(query=>{

      console.log("Usuarios encontrados:", query.size);

      if(!query.empty){
        document.getElementById("msgPerfil").innerText = "Nombre ya en uso";
        return;
      }

      let fotoDefault = "";

      if(sexo === "hombre"){
        fotoDefault = "imagen/hombre.jpeg";
      }else{
        fotoDefault = "imagen/mujer.jpeg";
      }

      if (archivo) {

        const storageRef = firebase.storage().ref();
        const ruta = "perfiles/" + user.uid;

        storageRef.child(ruta).put(archivo)
        .then(snapshot => snapshot.ref.getDownloadURL())
        .then(url => {

          db.collection("usuarios").doc(user.uid).set({
            nombre: nombre,
            sexo: sexo,
            nivel: parseFloat(nivel),
            mano: mano,
            posicion: posicion,
            fotoPerfil: url,
            seguidores: [],
            siguiendo: [],
            partidos: 0,
          })
          .then(()=>{
            location.reload();
          });

        });

      } else {

        db.collection("usuarios").doc(user.uid).set({
          nombre: nombre,
          sexo: sexo,
          nivel: parseFloat(nivel),
          mano: mano,
          posicion: posicion,
          fotoPerfil: fotoDefault,
          seguidores: [],
          siguiendo: [],
          partidos: 0,
        })
        .then(()=>{
          location.reload();
        });

      }

    })
    .catch(e=>{
      console.log(e);
      document.getElementById("msgPerfil").innerText = "Error";
    });

}

function login(){

let emailInput = document.getElementById("email");
let passInput = document.getElementById("pass");

if(!emailInput || !passInput){
alert("Error: inputs no encontrados");
return;
}

let email = emailInput.value;
let pass = passInput.value;

auth.signInWithEmailAndPassword(email,pass)
.catch(e=>{
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
  document.getElementById("inputFoto").click();
}

document.getElementById("inputFoto").addEventListener("change", async function(e){

  const file = e.target.files[0];
  if (!file) return;

  const user = auth.currentUser;
  if (!user) return;

  // PREVISUALIZACIÓN INSTANTÁNEA
  const previewURL = URL.createObjectURL(file);

  const imgEditar = document.getElementById("fotoPerfilEditar");
  if (imgEditar) imgEditar.src = previewURL;

  const imgPerfil = document.getElementById("fotoPerfil");
  if (imgPerfil) imgPerfil.src = previewURL;

  const docRef = db.collection("usuarios").doc(user.uid);
  const doc = await docRef.get();
  const data = doc.data();

  // borrar anterior
  if (data && data.fotoPerfil) {
    await borrarImagen(data.fotoPerfil);
  }

  // subir nueva
  const ruta = "perfiles/" + user.uid + "_" + Date.now();
  const url = await subirImagen(ruta, file);

  // guardar en BD
  await docRef.update({
    fotoPerfil: url
  });

});

function mostrar(seccion){

  console.log("SECCION:", seccion);

  // ocultar botón cambiar foto siempre al cambiar de pantalla
  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "none";

  // ocultar TODAS las secciones
  document.getElementById("login").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("perfilCompletar").style.display = "none";
  document.getElementById("perfil").style.display = "none";
  document.getElementById("perfilEditar") && (document.getElementById("perfilEditar").style.display = "none");
  document.getElementById("jugadores").style.display = "none";
  document.getElementById("pistas") && (document.getElementById("pistas").style.display = "none");
  document.getElementById("testNivel") && (document.getElementById("testNivel").style.display = "none");

  // mostrar sección
  if(seccion === "perfil"){
    document.getElementById("perfil").style.display = "block";
  }else{
    document.getElementById(seccion).style.display = "block";
  }

  // cargar pistas SOLO cuando toca
  if (seccion === "pistas") {
    cargarPistas();
  }

}



function abrirTest(){
  mostrar("testNivel");
}

function crearPartida(jugadores) {
  return db.collection("partidas").add({
    jugadores: jugadores, // array de uid
    resultado: null,
    fecha: new Date()
  });
}

const btnNuevaPista = document.getElementById("btnNuevaPista");
const formPista = document.getElementById("formPista");
const btnGuardarPista = document.getElementById("guardarPista");

if (btnNuevaPista) {
  btnNuevaPista.onclick = () => {
    formPista.style.display = "block";
  };
}

if (btnGuardarPista) {
  btnGuardarPista.onclick = async () => {

    const nombre = document.getElementById("nombrePista").value;
    const localidad = document.getElementById("localidadPista").value;

    const tipo = document.getElementById("tipoPista").value;
const indoor = document.getElementById("indoor").value;
const outdoor = document.getElementById("outdoor").value;
const precioManana = document.getElementById("precioManana").value;
const precioTarde = document.getElementById("precioTarde").value;
const precioFestivo = document.getElementById("precioFestivo").value;
const lat = document.getElementById("lat").value;
const lng = document.getElementById("lng").value;
const reserva = document.getElementById("reserva").value;

let fotoBase64 = "";

const inputFoto = document.getElementById("fotoPista");
if (inputFoto.files.length > 0) {
  const file = inputFoto.files[0];

  fotoBase64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

if (
  !nombre ||
  !localidad ||
  !tipo ||
  indoor === "" ||
  outdoor === "" ||
  precioManana === "" ||
  precioTarde === "" ||
  precioFestivo === "" ||

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

    if (existe) {
      alert("Esta pista ya existe");
      return;
    }

    await db.collection("pistas").add({
  nombre: nombre,
  nombreNorm: nombreNorm,
  localidad: localidad,
  localidadNorm: localidadNorm,
  direccion: document.getElementById("direccionPista").value,
  tipo: tipo,

  indoor: Number(indoor),
  outdoor: Number(outdoor),

  precioManana: Number(precioManana),
  precioTarde: Number(precioTarde),
  precioFestivo: Number(precioFestivo),

  lat: Number(lat),
  lng: Number(lng),

  reserva: reserva,
  foto: fotoBase64,

  creadaPor: auth.currentUser.uid,
  verificada: false
});

    alert("Pista guardada");
    formPista.style.display = "none";

    document.getElementById("nombrePista").value = "";
document.getElementById("localidadPista").value = "";
document.getElementById("direccionPista").value = "";
document.getElementById("tipoPista").value = "";
document.getElementById("indoor").value = "";
document.getElementById("outdoor").value = "";
document.getElementById("precioManana").value = "";
document.getElementById("precioTarde").value = "";
document.getElementById("precioFestivo").value = "";
document.getElementById("lat").value = "";
document.getElementById("lng").value = "";
document.getElementById("reserva").value = "";
document.getElementById("inputFoto").value = "";


    cargarPistas();

  };
}

function cargarPistas() {
  console.log("CARGANDO PISTAS");


  const lista = document.getElementById("listaPistas");
  if (!lista) return;

  // limpiar listener anterior si existe
  if (unsubscribePistas) unsubscribePistas();

  // escuchar cambios en tiempo real
  unsubscribePistas = db.collection("pistas")
    .onSnapshot(snapshot => {

      lista.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();

        const div = document.createElement("div");
        div.className = "cardPista";

        div.innerHTML =
          (data.foto ? '<img src="' + data.foto + '" style="width:100%; border-radius:10px; margin-bottom:8px;">' : '') +
          "<strong>" + (data.nombre || "") + "</strong><br>" +
          (data.localidad || "") + "<br>" +
          (data.tipo || "") + "<br>" +
          "Indoor: " + (data.indoor || 0) + " | Outdoor: " + (data.outdoor || 0) + "<br>" +
          (data.precioManana || 0) + "€ mañana / " +
          (data.precioTarde || 0) + "€ tarde / " +
          (data.precioFestivo || 0) + "€ festivo";

        lista.appendChild(div);
      });

    }, error => {
      console.error("Error cargando pistas:", error);
    });

}

async function subirImagen(ruta, archivo) {

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