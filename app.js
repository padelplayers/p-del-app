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

      db.collection("usuarios").doc(user.uid).set({
        nombre: nombre,
        sexo: sexo,
        nivel: parseFloat(nivel),
        mano: mano,
        posicion: posicion
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