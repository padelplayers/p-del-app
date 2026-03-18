let fotoPerfil = null;
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

db.collection("usuarios").doc(user.uid).set({
  nombre: nombre,
  sexo: sexo,
  nivel: parseFloat(nivel),
  mano: mano,
  posicion: posicion,
  foto: fotoDefault,
  seguidores: [],
siguiendo: [],
})
      .then(()=>{
        mostrar("menu");
      });

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

auth.onAuthStateChanged(user=>{

  if(user){

    db.collection("usuarios").doc(user.uid).get()
    .then(doc=>{

     if(doc.exists){

        const data = doc.data();

        otroUid = doc.id;

        const user = auth.currentUser;

if(otroUid !== user.uid){
  document.getElementById("btnSeguir").style.display = "block";
}else{
  document.getElementById("btnSeguir").style.display = "none";
}

db.collection("usuarios").doc(user.uid).get().then(miDoc => {

  const sigo = (miDoc.data().siguiendo || []).includes(otroUid);

  document.getElementById("btnSeguir").innerText =
    sigo ? "Dejar de seguir" : "Seguir";

});

document.getElementById("seguidores").innerText =
  (data.seguidores || []).length;

document.getElementById("seguidos").innerText =
  (data.siguiendo || []).length;

        document.getElementById("saludo").innerText =
          "Hola " + data.nombre;

        document.getElementById("nombrePerfil").innerText = data.nombre;
document.getElementById("puntosPerfil").innerText = data.nivel + " nivel";
document.getElementById("fotoPerfil").src = data.foto;
document.getElementById("seguidoresPerfil").innerText =
(data.seguidores || []).length + " seguidores";

mostrar("perfil");

      }else{
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
 const archivo = e.target.files[0];
fotoPerfil = URL.createObjectURL(archivo);
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

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(otroUid);

  miRef.get().then(miDoc => {

    const sigo = (miDoc.data().siguiendo || []).includes(otroUid);

    if(sigo){

      miRef.update({
        siguiendo: firebase.firestore.FieldValue.arrayRemove(otroUid)
      });

      otroRef.update({
        seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
      });

    }else{

      miRef.update({
        siguiendo: firebase.firestore.FieldValue.arrayUnion(otroUid)
      });

      otroRef.update({
        seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
      });

    }

    // refrescar perfil
    verPerfil(otroUid);

  });

}

function verPerfil(uid){

  const user = auth.currentUser;

  db.collection("usuarios").doc(uid).get().then(doc => {

    if(doc.exists){

      const data = doc.data();

      otroUid = uid;

      // botón seguir
      if(uid !== user.uid){
        document.getElementById("btnSeguir").style.display = "block";
      }else{
        document.getElementById("btnSeguir").style.display = "none";
      }

      // estado seguir
      db.collection("usuarios").doc(user.uid).get().then(miDoc => {

        const sigo = (miDoc.data().siguiendo || []).includes(uid);

        document.getElementById("btnSeguir").innerText =
          sigo ? "Dejar de seguir" : "Seguir";

      });

      // pintar datos
      document.getElementById("nombrePerfil").innerText = data.nombre;
      document.getElementById("puntosPerfil").innerText = data.nivel + " nivel";
      document.getElementById("fotoPerfil").src = data.fotoPerfil || "imagen/hombre.jpeg";

      document.getElementById("seguidores").innerText =
        (data.seguidores || []).length;

      document.getElementById("seguidos").innerText =
        (data.siguiendo || []).length;

      mostrar("perfil");

    }

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
  <img src="${data.foto || 'imagen/hombre.jpeg'}" width="50">
  <span>${data.nombre}</span>
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