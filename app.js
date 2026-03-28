let archivo = null;
let otroUid = null;

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

function guardarPerfil(){

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

  if(!nombre || !nivel || !mano || !posicion){
    document.getElementById("msgPerfil").innerText = "Completa los campos";
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

        document.getElementById("nombrePerfil").innerText = data.nombre;

        document.getElementById("puntosPerfil").innerText =
          data.nivel + " nivel";

        document.getElementById("fotoPerfil").src = data.fotoPerfil;

        document.getElementById("seguidores").innerText =
          (data.seguidores || []).length;

        

        mostrar("perfil");

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

  if(seccion === "perfil"){
    document.getElementById("perfil").style.display = "block";
  }else{
    document.getElementById(seccion).style.display = "block";
  }

}


function toggleSeguir(){

  const user = auth.currentUser;
  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  miRef.get().then(miDoc => {

    const sigo = ((miDoc.data() && miDoc.data().siguiendo) || []).includes(uid);

    let promesas = [];

    if (sigo) {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      );

    } else {

      promesas.push(
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        })
      );

      promesas.push(
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      );

    }

    Promise.all(promesas).then(() => {

      const btn = document.getElementById("btnSeguir");
      btn.innerText = sigo ? "Dejar de seguir" : "Seguir";

      verPerfil(uid);

    });

  });

}

function verPerfil(uid){

  db.collection("usuarios").doc(uid).get().then(doc => {

    if (!doc.exists) return;

    const data = doc.data();

document.getElementById("perfil").dataset.uid = uid;


    document.getElementById("nombrePerfil").innerText = data.nombre;
    document.getElementById("puntosPerfil").innerText = data.nivel + " nivel";
    document.getElementById("fotoPerfil").src = data.fotoPerfil;

    const seguidores = data.seguidores || [];
    document.getElementById("seguidores").innerText =
  Array.isArray(data.seguidores) ? data.seguidores.length : 0;


    otroUid = uid;

    const user = auth.currentUser;

db.collection("usuarios").doc(user.uid).get().then(miDoc => {

  const sigo = ((miDoc.data() && miDoc.data().siguiendo) || []).includes(uid);

  const btnSeguir = document.getElementById("btnSeguir");
  const botones = document.querySelector(".perfil-botones");

  if (uid === user.uid) {
    btnSeguir.style.display = "none";
    botones.style.display = "flex";
  } else {
    btnSeguir.style.display = "block";
    botones.style.display = "none";
    btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
  }

  mostrar("perfil");

});

  });

}



function cargarJugadores(){

  const contenedor = document.getElementById("listaJugadores");
  contenedor.innerHTML = "";

  db.collection("usuarios").get().then(snapshot => {

    snapshot.forEach(doc => {

      const data = doc.data();

      const div = document.createElement("div");
      div.className = "jugadorCard";

      div.innerHTML = `
  <div>
    <img src="${data.fotoPerfil || 'imagen/hombre.jpeg'}" width="50" />
    <span>${data.nombre}</span>
  </div>
`;

      div.onclick = () => verPerfil(doc.id);

      contenedor.appendChild(div);

    });

  });

}

function abrirJugadores(){
  mostrar("jugadores");
  cargarJugadores();
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

function volverMiPerfil(){
  const user = auth.currentUser;
  verPerfil(user.uid);
}