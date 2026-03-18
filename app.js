

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

      if(doc.exists && doc.data().nombre){

        const data = doc.data();

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
  console.log("Archivo seleccionado:", archivo);
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