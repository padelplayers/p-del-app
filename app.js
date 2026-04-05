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

const selectNivel = document.getElementById("nivelManual");
const btnTest = document.getElementById("btnTestNivel");

if (btnTest) {
  let avisoTestMostrado = false;

btnTest.onclick = function(){

  if (!avisoTestMostrado) {
    alert("El nivel no se podrá cambiar después. Elige correctamente antes de continuar");
    avisoTestMostrado = true;
  }

  mostrar("testNivel");
};
}


let avisoNivelMostrado = false;

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "nivelManual") {

    if (!avisoNivelMostrado) {
      alert("El nivel no se podrá cambiar después. Elige correctamente antes de continuar");
      avisoNivelMostrado = true;
    }

  }
});



function abrirTest(){
  mostrar("testNivel");
}
