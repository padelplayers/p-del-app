let archivo = null;
let otroUid = null;

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

document.getElementById("inputFoto").addEventListener("change", function(e){
  archivo = e.target.files[0];

  if (archivo) {
    const url = URL.createObjectURL(archivo);
    document.getElementById("fotoPerfil").src = url;
  }
});

function mostrar(seccion){

  document.getElementById("login").style.display = "none";
  document.getElementById("menu").style.display = "none";
  document.getElementById("perfilCompletar").style.display = "none";
  document.getElementById("perfil").style.display = "none";
  document.getElementById("jugadores").style.display = "none";


  if(seccion === "perfil"){
    document.getElementById("perfil").style.display = "block";
  }else{
    document.getElementById(seccion).style.display = "block";
  }
if (seccion === "pistas") {
  cargarPistas();
}

}


document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("inputFoto").addEventListener("change", function(e){

    archivo = e.target.files[0];

    if (archivo) {
      const url = URL.createObjectURL(archivo);
      document.getElementById("fotoPerfil").src = url;
    }

  });

  });

  let avisoNivelGlobalMostrado = false;

const selectNivel = document.getElementById("nivelManual");
const btnTest = document.getElementById("btnTestNivel");

if (btnTest) {

  btnTest.onclick = function(){

    if (!avisoNivelGlobalMostrado) {
      alert("El nivel no se podrá cambiar después. Elige correctamente antes de continuar");
      avisoNivelGlobalMostrado = true;
    }

    mostrar("testNivel");
  };
}


document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "nivelManual") {

    if (!avisoNivelGlobalMostrado) {
      alert("El nivel no se podrá cambiar después. Elige correctamente antes de continuar, puedes ayudarte del test pulsando descubre mi nivel");
      avisoNivelGlobalMostrado = true;
    }

  }
});



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
const lat = document.getElementById("lat").value;
const lng = document.getElementById("lng").value;
const reserva = document.getElementById("reserva").value;

if (
  !nombre ||
  !localidad ||
  !tipo ||
  indoor === "" ||
  outdoor === "" ||
  precioManana === "" ||
  precioTarde === "" ||
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

  lat: Number(lat),
  lng: Number(lng),

  reserva: reserva,

  creadaPor: auth.currentUser.uid,
  verificada: false
});

    alert("Pista guardada");
    formPista.style.display = "none";

  };
}

async function cargarPistas() {

  const lista = document.getElementById("listaPistas");
  if (!lista) return;

  lista.innerHTML = "";

  try {

    const snapshot = await db.collection("pistas").get();

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
  (data.precioManana || 0) + "€ mañana / " + (data.precioTarde || 0) + "€ tarde";

      lista.appendChild(div);
    });

  } catch (error) {
    console.error("Error cargando pistas:", error);
  }

}